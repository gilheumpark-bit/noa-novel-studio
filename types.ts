import { EngineReport, PlatformType, EpisodeState, POVType, Foreshadowing, WorldRule, WorldFact, CharacterDialogueProfile, EmotionalState, EOSHistoryEntry } from './engine/types';
import type { AgentConfig, MemoryStore, CharacterArcStore, AgentPipelineState } from './engine/agents/types';

export type AIProvider = 'gemini' | 'openai' | 'claude';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export type SetConfigFn = (config: StoryConfig | ((prev: StoryConfig) => StoryConfig)) => void;

export enum Genre {
  SF = "SF",
  FANTASY = "FANTASY",
  ROMANCE = "ROMANCE",
  THRILLER = "THRILLER",
  HORROR = "HORROR",
  SYSTEM_HUNTER = "SYSTEM_HUNTER",
  FANTASY_ROMANCE = "FANTASY_ROMANCE"
}

export type GenerationMode = 'cloud' | 'local';
export type ViewMode = 'mobile' | 'desktop';
export type AppLanguage = 'KO' | 'EN' | 'JP' | 'CN';

export type AppTab = 'world' | 'writing' | 'history' | 'critique' | 'settings' | 'characters' | 'rulebook';

export interface PclGuardrails {
  min: number;
  max: number;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  traits: string;
  appearance: string;
  dna: number;
  dialogueProfile?: CharacterDialogueProfile;
}

export interface StoryConfig {
  genre: Genre;
  povCharacter: string;
  setting: string;
  primaryEmotion: string;
  episode: number;
  title: string;
  totalEpisodes: number;
  synopsis?: string;
  guardrails: PclGuardrails;
  characters: Character[];
  platform: PlatformType;
  episodeState?: EpisodeState;
  povType?: POVType;
  foreshadowings?: Foreshadowing[];
  worldRules?: WorldRule[];
  worldFacts?: WorldFact[];
  emotionalHistory?: EmotionalState[];
  eosHistory?: EOSHistoryEntry[];
  // Agent system — internal, not serialized
  _agentSignal?: AbortSignal;
}

export interface SessionAgentData {
  agentConfig: AgentConfig;
  memoryStore: MemoryStore;
  arcStore: CharacterArcStore;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  versions?: string[];
  currentVersionIndex?: number;
  meta?: {
    grade?: string;
    eosScore?: number;
    metrics?: {
      tension: number;
      pacing: number;
      immersion: number;
    };
    critique?: string;
    engineReport?: EngineReport;
  };
  timestamp: number;
}

export interface EngineStatus {
  activeLayer: string;
  currentEngine: string;
  processing: boolean;
  progress: number;
  eosScore: number;
  tensionTarget: number;
  actPosition: string;
  byteSize: number;
  platform: PlatformType;
}

export { PlatformType, EpisodeState, POVType } from './engine/types';
export type { EngineReport, Foreshadowing, WorldRule, WorldFact, CharacterDialogueProfile, EmotionalState, EOSHistoryEntry } from './engine/types';
export type { AgentConfig, MemoryStore, CharacterArcStore, AgentPipelineState } from './engine/agents/types';
export { AgentRole, AgentStatus, DEFAULT_AGENT_CONFIG, EMPTY_MEMORY_STORE, EMPTY_ARC_STORE, createEmptyPipelineState } from './engine/agents/types';