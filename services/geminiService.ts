
import { GoogleGenAI, Type } from "@google/genai";
import { StoryConfig, Character, AppLanguage, Message } from "../types";
import { PlatformType } from "../engine/types";
import { buildSystemInstruction, buildUserPrompt, postProcessResponse } from "../engine/pipeline";
import type { EngineReport } from "../engine/types";

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

function buildContentsWithHistory(
  history: Message[],
  currentUserPrompt: string
): Array<{ role: string; parts: Array<{ text: string }> }> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // Include up to last 10 exchanges for context (avoid token overflow)
  const recent = history.slice(-20);
  for (const msg of recent) {
    // Skip the current in-progress assistant message (empty content)
    if (msg.role === 'assistant' && !msg.content) continue;

    // Strip JSON engine report from assistant messages to save tokens
    let text = msg.content;
    if (msg.role === 'assistant') {
      text = text.replace(/```json\n[\s\S]*?\n```/g, '').trim();
      if (!text) continue;
    }

    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text }],
    });
  }

  // Add the current user prompt
  contents.push({
    role: 'user',
    parts: [{ text: currentUserPrompt }],
  });

  return contents;
}

export const generateStoryStream = async (
  config: StoryConfig,
  draft: string,
  onChunk: (text: string) => void,
  options: GenerateOptions = {}
): Promise<GenerateResult> => {
  const apiKey = process.env.API_KEY || localStorage.getItem('noa_api_key');
  if (!apiKey) throw new Error("API_KEY_INVALID");

  const language = options.language ?? 'KO';
  const platform = options.platform ?? config.platform ?? PlatformType.MOBILE;
  const temperature = options.temperature ?? parseFloat(localStorage.getItem('noa_temperature') || '0.9');

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = buildSystemInstruction(config, language, platform);
  const userPrompt = buildUserPrompt(config, draft, {
    previousContent: options.previousContent,
    language,
  });

  // Build multi-turn contents if history is provided
  const history = options.history ?? [];
  const hasHistory = history.filter(m => m.content).length > 0;
  const contents = hasHistory
    ? buildContentsWithHistory(history, userPrompt)
    : userPrompt;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-preview-05-20',
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

    // Post-process: run engine validators and scoring
    const { content, report } = postProcessResponse(fullContent, config, language, platform);
    return { content, report };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error("Gemini Critical Error:", error);
    throw error;
  }
};

export const generateCharacters = async (config: StoryConfig, language: AppLanguage = 'KO'): Promise<Character[]> => {
  const apiKey = process.env.API_KEY || localStorage.getItem('noa_api_key');
  if (!apiKey) throw new Error("API_KEY_INVALID");

  const ai = new GoogleGenAI({ apiKey });

  const langNames = {
    'KO': 'Korean',
    'EN': 'English',
    'JP': 'Japanese',
    'CN': 'Chinese'
  };

  const prompt = `
    Based on the genre [${config.genre}] and world setting [${config.synopsis}],
    generate 4 multidimensional characters in JSON format.
    IMPORTANT: All character names, roles, traits, and appearance descriptions MUST be written in ${langNames[language]}.
    Each character must have a unique narrative role and high narrative potential (dna score 0-100).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
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

    const results = JSON.parse(response.text || "[]");
    return results.map((c: any) => ({
      ...c,
      id: `c-${Date.now()}-${Math.random()}`
    }));
  } catch (error) {
    console.error("Character Engine Error:", error);
    throw error;
  }
};
