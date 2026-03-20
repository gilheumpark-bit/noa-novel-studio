import { AIProvider, StoryConfig, Character, AppLanguage, Message } from '../types';
import { PlatformType } from '../engine/types';
import { buildSystemInstruction, buildUserPrompt, postProcessResponse } from '../engine/pipeline';
import type { EngineReport } from '../engine/types';

// ============================================================
// Constants
// ============================================================

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-flash-preview-05-20',
  openai: 'gpt-4o',
  claude: 'claude-sonnet-4-20250514',
};

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  claude: 'Anthropic Claude',
};

export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  gemini: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
  claude: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514'],
};

// ============================================================
// Storage helpers
// ============================================================

export function getStoredProvider(): AIProvider {
  return (sessionStorage.getItem('noa_ai_provider') as AIProvider) || 'gemini';
}

export function getStoredApiKey(provider: AIProvider): string {
  return sessionStorage.getItem(`noa_api_key_${provider}`) || '';
}

export function getStoredModel(provider: AIProvider): string {
  return sessionStorage.getItem(`noa_ai_model_${provider}`) || DEFAULT_MODELS[provider];
}

export function setStoredProvider(provider: AIProvider): void {
  sessionStorage.setItem('noa_ai_provider', provider);
}

export function setStoredApiKey(provider: AIProvider, key: string): void {
  sessionStorage.setItem(`noa_api_key_${provider}`, key);
}

export function setStoredModel(provider: AIProvider, model: string): void {
  sessionStorage.setItem(`noa_ai_model_${provider}`, model);
}

export function clearAllApiKeys(): void {
  sessionStorage.removeItem('noa_ai_provider');
  sessionStorage.removeItem('noa_api_key_gemini');
  sessionStorage.removeItem('noa_api_key_openai');
  sessionStorage.removeItem('noa_api_key_claude');
  sessionStorage.removeItem('noa_ai_model_gemini');
  sessionStorage.removeItem('noa_ai_model_openai');
  sessionStorage.removeItem('noa_ai_model_claude');
}

export function hasAnyApiKey(): boolean {
  return !!(
    sessionStorage.getItem('noa_api_key_gemini') ||
    sessionStorage.getItem('noa_api_key_openai') ||
    sessionStorage.getItem('noa_api_key_claude')
  );
}

export function getCurrentProviderConfig(): { provider: AIProvider; apiKey: string; model: string } {
  const provider = getStoredProvider();
  return {
    provider,
    apiKey: getStoredApiKey(provider),
    model: getStoredModel(provider),
  };
}

// ============================================================
// Interfaces
// ============================================================

export interface GenerateOptions {
  previousContent?: string;
  language?: AppLanguage;
  signal?: AbortSignal;
  platform?: PlatformType;
  history?: Message[];
  temperature?: number;
}

export interface GenerateResult {
  content: string;
  report: EngineReport;
}

// ============================================================
// History builder (shared across providers)
// ============================================================

function buildHistoryMessages(
  history: Message[],
  currentUserPrompt: string,
  format: 'gemini' | 'openai-claude'
): any[] {
  const recent = history.slice(-20);
  const messages: any[] = [];

  for (const msg of recent) {
    if (msg.role === 'assistant' && !msg.content) continue;
    let text = msg.content;
    if (msg.role === 'assistant') {
      text = text.replace(/```json\n[\s\S]*?\n```/g, '').trim();
      if (!text) continue;
    }

    if (format === 'gemini') {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text }],
      });
    } else {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: text,
      });
    }
  }

  if (format === 'gemini') {
    messages.push({ role: 'user', parts: [{ text: currentUserPrompt }] });
  } else {
    messages.push({ role: 'user', content: currentUserPrompt });
  }

  return messages;
}

// ============================================================
// Gemini Adapter
// ============================================================

async function generateStreamGemini(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
  history: Message[],
  onChunk: (text: string) => void,
  options: GenerateOptions
): Promise<string> {
  const { GoogleGenAI } = await import(/* @vite-ignore */ '@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const temperature = options.temperature ?? parseFloat(localStorage.getItem('noa_temperature') || '0.9');
  const hasHistory = history.filter(m => m.content).length > 0;
  const contents = hasHistory
    ? buildHistoryMessages(history, userPrompt, 'gemini')
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

  let fullContent = '';
  for await (const chunk of responseStream) {
    if (options.signal?.aborted) {
      throw new DOMException('Generation cancelled', 'AbortError');
    }
    if (chunk.text) {
      fullContent += chunk.text;
      onChunk(chunk.text);
    }
  }
  return fullContent;
}

async function generateJSONGemini(
  apiKey: string,
  model: string,
  prompt: string
): Promise<any> {
  const { GoogleGenAI, Type } = await import(/* @vite-ignore */ '@google/genai');
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            traits: { type: Type.STRING },
            appearance: { type: Type.STRING },
            dna: { type: Type.NUMBER }
          },
          required: ["name", "role", "traits", "appearance", "dna"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
}

// ============================================================
// OpenAI Adapter
// ============================================================

async function generateStreamOpenAI(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
  history: Message[],
  onChunk: (text: string) => void,
  options: GenerateOptions
): Promise<string> {
  const temperature = options.temperature ?? parseFloat(localStorage.getItem('noa_temperature') || '0.9');
  const hasHistory = history.filter(m => m.content).length > 0;

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemInstruction },
  ];

  if (hasHistory) {
    messages.push(...buildHistoryMessages(history, userPrompt, 'openai-claude'));
  } else {
    messages.push({ role: 'user', content: userPrompt });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

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
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return fullContent;
}

async function generateJSONOpenAI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt + '\n\nRespond in valid JSON array format.' }],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || '[]';
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : parsed.characters || [];
}

// ============================================================
// Claude (Anthropic) Adapter
// ============================================================

async function generateStreamClaude(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userPrompt: string,
  history: Message[],
  onChunk: (text: string) => void,
  options: GenerateOptions
): Promise<string> {
  const temperature = options.temperature ?? parseFloat(localStorage.getItem('noa_temperature') || '0.9');
  const hasHistory = history.filter(m => m.content).length > 0;

  const messages: Array<{ role: string; content: string }> = [];

  if (hasHistory) {
    messages.push(...buildHistoryMessages(history, userPrompt, 'openai-claude'));
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
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: systemInstruction,
      messages,
      temperature,
      stream: true,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorBody}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);

      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          fullContent += parsed.delta.text;
          onChunk(parsed.delta.text);
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return fullContent;
}

async function generateJSONClaude(
  apiKey: string,
  model: string,
  prompt: string
): Promise<any> {
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
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt + '\n\nRespond with a valid JSON array only.' }],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const data = await response.json();
  const text = data.content?.[0]?.text || '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
}

// ============================================================
// Public API: generateStoryStream
// ============================================================

export async function generateStoryStream(
  config: StoryConfig,
  draft: string,
  onChunk: (text: string) => void,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const { provider, apiKey, model } = getCurrentProviderConfig();
  if (!apiKey) throw new Error("API_KEY_INVALID");

  const language = options.language ?? 'KO';
  const platform = options.platform ?? config.platform ?? PlatformType.MOBILE;

  const systemInstruction = buildSystemInstruction(config, language, platform);
  const userPrompt = buildUserPrompt(config, draft, {
    previousContent: options.previousContent,
    language,
  });

  const history = options.history ?? [];

  let fullContent: string;

  try {
    switch (provider) {
      case 'gemini':
        fullContent = await generateStreamGemini(apiKey, model, systemInstruction, userPrompt, history, onChunk, options);
        break;
      case 'openai':
        fullContent = await generateStreamOpenAI(apiKey, model, systemInstruction, userPrompt, history, onChunk, options);
        break;
      case 'claude':
        fullContent = await generateStreamClaude(apiKey, model, systemInstruction, userPrompt, history, onChunk, options);
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') throw error;
    console.error(`${PROVIDER_LABELS[provider]} Error:`, error);
    throw error;
  }

  const { content, report } = postProcessResponse(fullContent, config, language, platform);
  return { content, report };
}

// ============================================================
// Public API: generateCharacters
// ============================================================

export async function generateCharacters(
  config: StoryConfig,
  language: AppLanguage = 'KO'
): Promise<Character[]> {
  const { provider, apiKey, model } = getCurrentProviderConfig();
  if (!apiKey) throw new Error("API_KEY_INVALID");

  const langNames: Record<AppLanguage, string> = {
    'KO': 'Korean', 'EN': 'English', 'JP': 'Japanese', 'CN': 'Chinese'
  };

  const prompt = `
    Based on the genre [${config.genre}] and world setting [${config.synopsis}],
    generate 4 multidimensional characters in JSON format.
    IMPORTANT: All character names, roles, traits, and appearance descriptions MUST be written in ${langNames[language]}.
    Each character must have a unique narrative role and high narrative potential (dna score 0-100).
  `;

  let results: any[];

  try {
    switch (provider) {
      case 'gemini':
        results = await generateJSONGemini(apiKey, model, prompt);
        break;
      case 'openai':
        results = await generateJSONOpenAI(apiKey, model, prompt);
        break;
      case 'claude':
        results = await generateJSONClaude(apiKey, model, prompt);
        break;
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  } catch (error) {
    console.error("Character Engine Error:", error);
    throw error;
  }

  return results.map((c: any) => ({
    ...c,
    id: `c-${crypto.randomUUID()}`
  }));
}

// ============================================================
// Public API: testApiKey
// ============================================================

export async function testApiKey(provider: AIProvider, apiKey: string, model?: string): Promise<boolean> {
  const testModel = model || DEFAULT_MODELS[provider];

  switch (provider) {
    case 'gemini': {
      const { GoogleGenAI } = await import(/* @vite-ignore */ '@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: testModel,
        contents: 'Say "OK" in one word.',
      });
      return true;
    }
    case 'openai': {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: testModel,
          messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
          max_tokens: 5,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return true;
    }
    case 'claude': {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: testModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say "OK" in one word.' }],
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return true;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
