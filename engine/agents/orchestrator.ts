import { StoryConfig, Message, AppLanguage } from '../../types';
import { EngineReport, PlatformType } from '../types';
import { getCurrentProviderConfig } from '../../services/aiService';
import { postProcessResponse } from '../pipeline';
import {
  AgentRole, AgentStatus, AgentOutput, AgentContext, AgentConfig,
  AgentPipelineState, MemoryStore, CharacterArcStore,
  createEmptyPipelineState, EMPTY_MEMORY_STORE, EMPTY_ARC_STORE,
} from './types';
import { runMemoryRetrieval, extractMemories, updateMemorySummary } from './memoryAgent';
import { runWorldAgent } from './worldAgent';
import { runCharacterAgent, updateCharacterArcs } from './characterAgent';
import { buildAgentEnhancedPrompt, createWritingAgentOutput } from './writingAgent';
import { runQAAgent } from './qaAgent';
import { runEvaluationAgent } from './evaluationAgent';
import {
  runWatchdog, runCheckpoint, createSupervisorState,
  CHECKPOINT_INTERVAL, MIN_TEXT_FOR_CHECKPOINT,
  type SupervisorState, type SupervisorAlert,
} from './supervisorAgent';
import { tensionCurve } from '../models';

// ============================================================
// Agent Orchestrator
// ============================================================
// Pipeline: Memory → World + Character (parallel) → Writer + Supervisor → QA + Evaluator (parallel)
// ============================================================

export interface OrchestratorCallbacks {
  onAgentUpdate: (state: AgentPipelineState) => void;
  onChunk: (text: string) => void;
  onMemoryStoreUpdate: (store: MemoryStore) => void;
  onArcStoreUpdate: (store: CharacterArcStore) => void;
  onSupervisorAlert?: (alert: SupervisorAlert) => void;
}

export interface OrchestratorResult {
  content: string;
  report: EngineReport;
  pipelineState: AgentPipelineState;
}

export async function runAgentPipeline(
  config: StoryConfig,
  draft: string,
  history: Message[],
  language: AppLanguage,
  agentConfig: AgentConfig,
  memoryStore: MemoryStore,
  arcStore: CharacterArcStore,
  callbacks: OrchestratorCallbacks,
  signal?: AbortSignal,
): Promise<OrchestratorResult> {
  const state = createEmptyPipelineState();
  state.isRunning = true;
  state.startedAt = Date.now();

  // Attach signal to config for agents to use
  const configWithSignal = { ...config, _agentSignal: signal } as StoryConfig;

  const baseCtx: AgentContext = {
    config: configWithSignal,
    language,
    draft,
    history,
  };

  const updateAgent = (role: AgentRole, output: AgentOutput) => {
    state.agents[role] = output;
    state.currentAgent = role;
    callbacks.onAgentUpdate({ ...state });
  };

  const skipAgent = (role: AgentRole) => {
    state.agents[role] = {
      role,
      status: AgentStatus.SKIPPED,
      content: '비활성화됨',
      durationMs: 0,
    };
  };

  try {
    // ── Phase 1: Pre-generation agents ──

    // 1a. Memory Agent (sequential — its output feeds others)
    if (agentConfig.agents[AgentRole.MEMORY]) {
      state.currentAgent = AgentRole.MEMORY;
      state.agents[AgentRole.MEMORY].status = AgentStatus.RUNNING;
      callbacks.onAgentUpdate({ ...state });

      const memoryOutput = await runMemoryRetrieval(baseCtx, memoryStore);
      updateAgent(AgentRole.MEMORY, memoryOutput);
    } else {
      skipAgent(AgentRole.MEMORY);
    }

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // 1b. World + Character agents (parallel)
    const preGenPromises: Promise<void>[] = [];

    if (agentConfig.agents[AgentRole.WORLD]) {
      state.agents[AgentRole.WORLD].status = AgentStatus.RUNNING;
      callbacks.onAgentUpdate({ ...state });
      preGenPromises.push(
        runWorldAgent(baseCtx).then(out => updateAgent(AgentRole.WORLD, out))
      );
    } else {
      skipAgent(AgentRole.WORLD);
    }

    if (agentConfig.agents[AgentRole.CHARACTER]) {
      state.agents[AgentRole.CHARACTER].status = AgentStatus.RUNNING;
      callbacks.onAgentUpdate({ ...state });
      preGenPromises.push(
        runCharacterAgent(baseCtx, arcStore).then(out => updateAgent(AgentRole.CHARACTER, out))
      );
    } else {
      skipAgent(AgentRole.CHARACTER);
    }

    await Promise.all(preGenPromises);

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Phase 2: Writing Agent + Supervisor (streaming) ──
    state.currentAgent = AgentRole.WRITER;
    state.agents[AgentRole.WRITER].status = AgentStatus.RUNNING;
    const supervisorEnabled = agentConfig.agents[AgentRole.SUPERVISOR];
    if (supervisorEnabled) {
      state.agents[AgentRole.SUPERVISOR].status = AgentStatus.RUNNING;
    }
    callbacks.onAgentUpdate({ ...state });

    const writeStart = performance.now();

    // Collect directives from pre-gen agents
    const directives = [
      state.agents[AgentRole.MEMORY].directive,
      state.agents[AgentRole.WORLD].directive,
      state.agents[AgentRole.CHARACTER].directive,
    ].filter((d): d is string => !!d && d.length > 0);

    // Build enhanced prompts
    const { systemInstruction, userPrompt } = buildAgentEnhancedPrompt(baseCtx, directives);

    // Supervisor state
    const supervisorState = createSupervisorState();
    let lastWatchdogScan = 0;
    let checkpointCount = 0;
    const targetTension = Math.round(
      tensionCurve(config.episode, config.totalEpisodes ?? 25, config.genre) * 100
    );

    // Use existing streaming infrastructure with enhanced prompts + supervisor
    let fullContent = '';
    const result = await generateStoryStreamWithCustomPrompt(
      config,
      systemInstruction,
      userPrompt,
      history,
      language,
      (chunk) => {
        fullContent += chunk;
        callbacks.onChunk(chunk);

        // ── Supervisor Layer A: Regex Watchdog (every chunk) ──
        if (supervisorEnabled && supervisorState.isActive) {
          const watchResult = runWatchdog(fullContent, lastWatchdogScan, config);
          lastWatchdogScan = watchResult.scannedUpTo;

          for (const alert of watchResult.alerts) {
            supervisorState.alerts.push(alert);
            callbacks.onSupervisorAlert?.(alert);
          }
          supervisorState.totalChunksProcessed++;

          // ── Supervisor Layer B: AI Checkpoint (every ~1000 chars) ──
          const charsSinceCheckpoint = fullContent.length - supervisorState.lastCheckpointAt;
          if (
            fullContent.length >= MIN_TEXT_FOR_CHECKPOINT &&
            charsSinceCheckpoint >= CHECKPOINT_INTERVAL
          ) {
            supervisorState.lastCheckpointAt = fullContent.length;
            checkpointCount++;

            // Run checkpoint asynchronously (non-blocking to stream)
            runCheckpoint(
              fullContent,
              config,
              targetTension,
              supervisorState.alerts,
              signal,
            ).then(cpResult => {
              supervisorState.checkpoints.push(cpResult);
              for (const alert of cpResult.alerts) {
                supervisorState.alerts.push(alert);
                callbacks.onSupervisorAlert?.(alert);
              }

              // Update supervisor agent output with latest info
              const alertCount = supervisorState.alerts.length;
              const critCount = supervisorState.alerts.filter(a => a.type === 'critical').length;
              const latestEos = cpResult.eosEstimate;

              state.agents[AgentRole.SUPERVISOR] = {
                role: AgentRole.SUPERVISOR,
                status: AgentStatus.RUNNING,
                content: `감시 중 — ${alertCount}건 경고 (치명적: ${critCount}), EOS: ${latestEos}, 긴장도: ${cpResult.tensionLevel}`,
                metadata: {
                  alertCount,
                  criticalCount: critCount,
                  eosEstimate: latestEos,
                  tensionLevel: cpResult.tensionLevel,
                  checkpointCount,
                  interventions: cpResult.shouldIntervene ? 1 : 0,
                },
                durationMs: Math.round(performance.now() - writeStart),
              };
              callbacks.onAgentUpdate({ ...state });
            }).catch(() => {});
          }
        }
      },
      signal,
    );

    const writeDuration = Math.round(performance.now() - writeStart);
    updateAgent(AgentRole.WRITER, createWritingAgentOutput(writeDuration, true));

    // Finalize supervisor
    if (supervisorEnabled) {
      const totalAlerts = supervisorState.alerts.length;
      const critAlerts = supervisorState.alerts.filter(a => a.type === 'critical').length;
      const warnAlerts = supervisorState.alerts.filter(a => a.type === 'warning').length;
      const lastCp = supervisorState.checkpoints[supervisorState.checkpoints.length - 1];
      const finalEos = lastCp?.eosEstimate ?? 0;

      updateAgent(AgentRole.SUPERVISOR, {
        role: AgentRole.SUPERVISOR,
        status: critAlerts > 0 ? AgentStatus.ERROR : AgentStatus.DONE,
        content: `감독 완료 — 경고 ${totalAlerts}건 (치명적: ${critAlerts}, 주의: ${warnAlerts}), 체크포인트: ${checkpointCount}회, 최종 EOS 추정: ${finalEos}`,
        metadata: {
          alertCount: totalAlerts,
          criticalCount: critAlerts,
          warningCount: warnAlerts,
          eosEstimate: finalEos,
          tensionLevel: lastCp?.tensionLevel || 'unknown',
          checkpointCount,
          alerts: supervisorState.alerts.slice(-10), // keep last 10 for UI
        },
        durationMs: Math.round(performance.now() - writeStart),
      });
    } else {
      skipAgent(AgentRole.SUPERVISOR);
    }

    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Phase 3: Post-generation agents (parallel) ──
    const postCtx: AgentContext = {
      ...baseCtx,
      generatedContent: result.content,
      report: result.report,
    };

    const postGenPromises: Promise<void>[] = [];

    if (agentConfig.agents[AgentRole.QA]) {
      state.agents[AgentRole.QA].status = AgentStatus.RUNNING;
      callbacks.onAgentUpdate({ ...state });
      postGenPromises.push(
        runQAAgent(postCtx).then(out => updateAgent(AgentRole.QA, out))
      );
    } else {
      skipAgent(AgentRole.QA);
    }

    if (agentConfig.agents[AgentRole.EVALUATOR]) {
      state.agents[AgentRole.EVALUATOR].status = AgentStatus.RUNNING;
      callbacks.onAgentUpdate({ ...state });
      postGenPromises.push(
        runEvaluationAgent(postCtx).then(out => updateAgent(AgentRole.EVALUATOR, out))
      );
    } else {
      skipAgent(AgentRole.EVALUATOR);
    }

    await Promise.all(postGenPromises);

    // ── Phase 4: Update stores (background, non-blocking) ──
    if (agentConfig.agents[AgentRole.MEMORY]) {
      extractMemories(result.content, baseCtx).then(newEntries => {
        const updated = updateMemorySummary(memoryStore, newEntries, config.episode);
        callbacks.onMemoryStoreUpdate(updated);
      }).catch(() => {});
    }

    if (agentConfig.agents[AgentRole.CHARACTER]) {
      updateCharacterArcs(result.content, baseCtx, arcStore).then(updated => {
        callbacks.onArcStoreUpdate(updated);
      }).catch(() => {});
    }

    // ── Done ──
    state.isRunning = false;
    state.currentAgent = null;
    state.completedAt = Date.now();
    callbacks.onAgentUpdate({ ...state });

    return {
      content: result.content,
      report: result.report,
      pipelineState: state,
    };
  } catch (error: any) {
    state.isRunning = false;
    state.currentAgent = null;
    state.completedAt = Date.now();
    callbacks.onAgentUpdate({ ...state });
    throw error;
  }
}

// ============================================================
// Custom streaming call with pre-built system instruction
// ============================================================

async function generateStoryStreamWithCustomPrompt(
  config: StoryConfig,
  systemInstruction: string,
  userPrompt: string,
  history: Message[],
  language: AppLanguage,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<{ content: string; report: EngineReport }> {
  const { provider, apiKey, model } = getCurrentProviderConfig();
  if (!apiKey) throw new Error('API_KEY_INVALID');

  const platform = config.platform ?? PlatformType.MOBILE;
  const temperature = parseFloat(localStorage.getItem('noa_temperature') || '0.9');

  let fullContent = '';

  // Build history messages (reuse logic from aiService)
  const recentHistory = history.slice(-20);
  const hasHistory = recentHistory.filter(m => m.content).length > 0;

  switch (provider) {
    case 'gemini': {
      const { GoogleGenAI } = await import(/* @vite-ignore */ '@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const contents = hasHistory
        ? buildHistoryForGemini(recentHistory, userPrompt)
        : userPrompt;

      const responseStream = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction,
          temperature,
          topP: 0.95,
        },
      });

      for await (const chunk of responseStream) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (chunk.text) {
          fullContent += chunk.text;
          onChunk(chunk.text);
        }
      }
      break;
    }
    case 'openai': {
      const messages: any[] = [{ role: 'system', content: systemInstruction }];
      if (hasHistory) {
        messages.push(...buildHistoryForOpenAI(recentHistory, userPrompt));
      } else {
        messages.push({ role: 'user', content: userPrompt });
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature, stream: true }),
        signal,
      });
      if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
      fullContent = await readSSEStream(response, onChunk, signal, 'openai');
      break;
    }
    case 'claude': {
      const messages: any[] = [];
      if (hasHistory) {
        messages.push(...buildHistoryForOpenAI(recentHistory, userPrompt));
      } else {
        messages.push({ role: 'user', content: userPrompt });
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model, max_tokens: 8192, system: systemInstruction, messages, temperature, stream: true }),
        signal,
      });
      if (!response.ok) throw new Error(`Claude error: ${response.status}`);
      fullContent = await readSSEStream(response, onChunk, signal, 'claude');
      break;
    }
  }

  const { content, report } = postProcessResponse(fullContent, config, language, platform);
  return { content, report };
}

// ============================================================
// Helpers
// ============================================================

function buildHistoryForGemini(history: Message[], userPrompt: string): any[] {
  const messages: any[] = [];
  for (const msg of history) {
    if (msg.role === 'assistant' && !msg.content) continue;
    let text = msg.content;
    if (msg.role === 'assistant') {
      text = text.replace(/```json\n[\s\S]*?\n```/g, '').trim();
      if (!text) continue;
    }
    messages.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text }] });
  }
  messages.push({ role: 'user', parts: [{ text: userPrompt }] });
  return messages;
}

function buildHistoryForOpenAI(history: Message[], userPrompt: string): any[] {
  const messages: any[] = [];
  for (const msg of history) {
    if (msg.role === 'assistant' && !msg.content) continue;
    let text = msg.content;
    if (msg.role === 'assistant') {
      text = text.replace(/```json\n[\s\S]*?\n```/g, '').trim();
      if (!text) continue;
    }
    messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: text });
  }
  messages.push({ role: 'user', content: userPrompt });
  return messages;
}

async function readSSEStream(
  response: Response,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  provider: 'openai' | 'claude' = 'openai',
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') break;

      try {
        const parsed = JSON.parse(data);
        let delta: string | undefined;
        if (provider === 'openai') {
          delta = parsed.choices?.[0]?.delta?.content;
        } else {
          if (parsed.type === 'content_block_delta') {
            delta = parsed.delta?.text;
          }
        }
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
      } catch {}
    }
  }
  return fullContent;
}
