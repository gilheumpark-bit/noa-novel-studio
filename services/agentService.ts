import { getCurrentProviderConfig, type GenerateOptions } from './aiService';
import type { Message } from '../types';

// ============================================================
// Lightweight AI call for agents (non-streaming, JSON or text)
// ============================================================

export interface AgentCallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  responseFormat?: 'text' | 'json';
}

export async function callAgentAI(options: AgentCallOptions): Promise<string> {
  const { provider, apiKey, model } = getCurrentProviderConfig();
  if (!apiKey) throw new Error('API_KEY_INVALID');

  const {
    systemPrompt,
    userPrompt,
    maxTokens = 2048,
    temperature = 0.7,
    signal,
  } = options;

  switch (provider) {
    case 'gemini':
      return callGeminiAgent(apiKey, model, systemPrompt, userPrompt, maxTokens, temperature, signal);
    case 'openai':
      return callOpenAIAgent(apiKey, model, systemPrompt, userPrompt, maxTokens, temperature, signal);
    case 'claude':
      return callClaudeAgent(apiKey, model, systemPrompt, userPrompt, maxTokens, temperature, signal);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ============================================================
// Gemini (non-streaming)
// ============================================================

async function callGeminiAgent(
  apiKey: string, model: string,
  systemPrompt: string, userPrompt: string,
  maxTokens: number, temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  const { GoogleGenAI } = await import(/* @vite-ignore */ '@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      topP: 0.95,
      maxOutputTokens: maxTokens,
    },
  });

  return response.text || '';
}

// ============================================================
// OpenAI (non-streaming)
// ============================================================

async function callOpenAIAgent(
  apiKey: string, model: string,
  systemPrompt: string, userPrompt: string,
  maxTokens: number, temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI Agent Error (${response.status}): ${err}`);
  }

  try {
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch {
    console.warn('[OpenAI Agent] Failed to parse JSON response');
    return '';
  }
}

// ============================================================
// Claude (non-streaming)
// ============================================================

async function callClaudeAgent(
  apiKey: string, model: string,
  systemPrompt: string, userPrompt: string,
  maxTokens: number, temperature: number,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature,
    }),
    signal,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude Agent Error (${response.status}): ${err}`);
  }

  try {
    const data = await response.json();
    return data.content?.[0]?.text || '';
  } catch {
    console.warn('[Claude Agent] Failed to parse JSON response');
    return '';
  }
}
