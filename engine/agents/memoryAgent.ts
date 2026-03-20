import { callAgentAI } from '../../services/agentService';
import { AgentRole, AgentStatus, AgentOutput, AgentContext, MemoryStore, MemoryEntry, EMPTY_MEMORY_STORE } from './types';

// ============================================================
// Long-term Memory Agent (장기 메모리 에이전트)
// ============================================================
// Responsibilities:
// 1. PRE-GEN: Retrieve relevant memories for the current episode
// 2. POST-GEN: Extract and store new events/facts from generated content
// ============================================================

const MEMORY_SYSTEM_PROMPT = `당신은 소설의 장기 메모리 관리자입니다. 당신의 역할:

1. 이전 에피소드들의 핵심 사건, 관계 변화, 상태 변화를 기억합니다.
2. 현재 에피소드에 관련된 과거 사건들을 우선순위에 따라 제공합니다.
3. 연속성 오류를 방지하기 위해 확정된 사실들을 추적합니다.

기억의 유형:
- event: 주요 사건 (전투, 만남, 발견 등)
- revelation: 비밀 공개, 반전
- relationship: 관계 변화 (동맹, 배신, 사랑 등)
- state_change: 상태 변화 (부상, 능력 획득/상실, 위치 이동)
- death: 캐릭터 사망
- promise: 약속, 맹세, 예언

응답 형식 (JSON):
{
  "relevantMemories": [{"id": "...", "content": "...", "importance": 1-10}],
  "narrativeDirective": "이번 에피소드에서 기억해야 할 핵심 컨텍스트 요약",
  "warnings": ["연속성 관련 주의사항"]
}`;

const EXTRACT_SYSTEM_PROMPT = `당신은 소설의 장기 메모리 추출기입니다. 생성된 텍스트에서 중요한 사건과 정보를 추출하세요.

응답 형식 (JSON array):
[
  {
    "type": "event|revelation|relationship|state_change|death|promise",
    "content": "사건 요약 (1-2문장)",
    "characters": ["관련 캐릭터 이름들"],
    "importance": 1-10
  }
]

중요도 기준:
- 10: 스토리 전체를 바꾸는 사건 (주인공 사망, 세계 멸망 등)
- 7-9: 주요 전환점 (배신, 각성, 핵심 비밀 공개)
- 4-6: 중요한 진전 (전투 결과, 관계 발전)
- 1-3: 소소한 디테일 (분위기, 일상 묘사)

importance 5 이상인 항목만 추출하세요.`;

export async function runMemoryRetrieval(
  ctx: AgentContext,
  memoryStore: MemoryStore,
): Promise<AgentOutput> {
  const start = performance.now();

  try {
    // If no memories yet, return a minimal directive
    if (memoryStore.entries.length === 0 && !memoryStore.summary) {
      return {
        role: AgentRole.MEMORY,
        status: AgentStatus.DONE,
        content: '첫 에피소드 — 이전 기억 없음.',
        directive: '',
        durationMs: Math.round(performance.now() - start),
      };
    }

    // Build memory context for the AI
    const recentMemories = memoryStore.entries
      .filter(e => e.importance >= 5)
      .sort((a, b) => b.importance - a.importance || b.episode - a.episode)
      .slice(0, 20);

    const memoryText = recentMemories
      .map(m => `[EP.${m.episode}] (${m.type}, 중요도:${m.importance}) ${m.content} — 관련: ${m.characters.join(', ')}`)
      .join('\n');

    const userPrompt = `현재 에피소드: ${ctx.config.episode} / ${ctx.config.totalEpisodes}
장르: ${ctx.config.genre}
시점 캐릭터: ${ctx.config.povCharacter}
사용자 지시: ${ctx.draft}

[스토리 요약]
${memoryStore.summary || '아직 요약 없음'}

[저장된 기억 목록]
${memoryText || '없음'}

이번 에피소드 집필에 필요한 관련 기억들을 추출하고, 연속성 주의사항을 알려주세요.`;

    const response = await callAgentAI({
      systemPrompt: MEMORY_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1024,
      temperature: 0.3,
      signal: ctx.config._agentSignal as AbortSignal | undefined,
    });

    // Parse response
    let directive = '';
    let content = response;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        directive = parsed.narrativeDirective || '';
        const warnings = (parsed.warnings || []).join('; ');
        content = `기억 검색 완료. ${parsed.relevantMemories?.length || 0}개 관련 기억 발견.${warnings ? ` 주의: ${warnings}` : ''}`;
      }
    } catch {
      directive = response.slice(0, 500);
    }

    return {
      role: AgentRole.MEMORY,
      status: AgentStatus.DONE,
      content,
      directive: directive ? `[LONG-TERM MEMORY CONTEXT]\n${directive}` : '',
      durationMs: Math.round(performance.now() - start),
    };
  } catch (error: any) {
    return {
      role: AgentRole.MEMORY,
      status: AgentStatus.ERROR,
      content: `메모리 에이전트 오류: ${error.message}`,
      durationMs: Math.round(performance.now() - start),
    };
  }
}

export async function extractMemories(
  generatedText: string,
  ctx: AgentContext,
): Promise<MemoryEntry[]> {
  try {
    const userPrompt = `에피소드 ${ctx.config.episode} 텍스트:
${generatedText.slice(0, 3000)}

등장 캐릭터: ${ctx.config.characters.map(c => c.name).join(', ')}
시점 캐릭터: ${ctx.config.povCharacter}`;

    const response = await callAgentAI({
      systemPrompt: EXTRACT_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1024,
      temperature: 0.2,
      signal: ctx.config._agentSignal as AbortSignal | undefined,
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const items: any[] = JSON.parse(jsonMatch[0]);
    return items
      .filter(item => item.content && item.importance >= 5)
      .map(item => ({
        id: `mem-${crypto.randomUUID()}`,
        episode: ctx.config.episode,
        type: item.type || 'event',
        content: item.content,
        characters: item.characters || [],
        importance: Math.min(10, Math.max(1, item.importance || 5)),
        timestamp: Date.now(),
      }));
  } catch {
    return [];
  }
}

export function updateMemorySummary(
  store: MemoryStore,
  newEntries: MemoryEntry[],
  episode: number,
): MemoryStore {
  const entries = [...store.entries, ...newEntries]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 100); // keep top 100 memories

  // Build incremental summary from high-importance memories
  const highImportance = newEntries
    .filter(e => e.importance >= 7)
    .map(e => e.content);

  const summaryAddition = highImportance.length > 0
    ? `\nEP.${episode}: ${highImportance.join('. ')}`
    : '';

  return {
    entries,
    summary: (store.summary + summaryAddition).slice(-2000), // cap at 2000 chars
    lastUpdatedEpisode: episode,
  };
}
