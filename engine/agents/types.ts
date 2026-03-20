import { StoryConfig, Message, AppLanguage } from '../../types';
import { EngineReport } from '../types';

// ============================================================
// Agent Role Definitions
// ============================================================

export enum AgentRole {
  WRITER = 'WRITER',           // 집필 에이전트
  WORLD = 'WORLD',             // 세계관 에이전트
  QA = 'QA',                   // 검수 에이전트
  EVALUATOR = 'EVALUATOR',     // 평가 에이전트
  MEMORY = 'MEMORY',           // 장기 메모리 에이전트
  CHARACTER = 'CHARACTER',     // 캐릭 아크 연기 에이전트
  SUPERVISOR = 'SUPERVISOR',   // 감독 에이전트 (실시간 감시)
}

export enum AgentStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  ERROR = 'ERROR',
  SKIPPED = 'SKIPPED',
}

// ============================================================
// Agent I/O
// ============================================================

export interface AgentContext {
  config: StoryConfig;
  language: AppLanguage;
  draft: string;               // user's draft/prompt
  history: Message[];           // conversation history
  generatedContent?: string;    // output from writing agent (for post-gen agents)
  report?: EngineReport;        // engine report (for evaluation agent)
}

export interface MemoryEntry {
  id: string;
  episode: number;
  type: 'event' | 'revelation' | 'relationship' | 'state_change' | 'death' | 'promise';
  content: string;
  characters: string[];
  importance: number; // 1-10
  timestamp: number;
}

export interface CharacterArcState {
  characterName: string;
  currentGoal: string;
  internalConflict: string;
  growthStage: 'setup' | 'catalyst' | 'struggle' | 'transformation' | 'resolution';
  keyMoments: string[];
  voiceNotes: string;    // acting direction for this character
  arcProgress: number;   // 0-100
}

export interface AgentOutput {
  role: AgentRole;
  status: AgentStatus;
  content: string;             // main output text
  directive?: string;          // injected into system prompt
  metadata?: Record<string, any>;
  durationMs: number;
}

// ============================================================
// Agent Pipeline State
// ============================================================

export interface AgentPipelineState {
  agents: Record<AgentRole, AgentOutput>;
  isRunning: boolean;
  currentAgent: AgentRole | null;
  startedAt: number;
  completedAt?: number;
}

export interface AgentConfig {
  enabled: boolean;
  agents: Record<AgentRole, boolean>;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  enabled: false,
  agents: {
    [AgentRole.WRITER]: true,
    [AgentRole.WORLD]: true,
    [AgentRole.QA]: true,
    [AgentRole.EVALUATOR]: true,
    [AgentRole.MEMORY]: true,
    [AgentRole.CHARACTER]: true,
    [AgentRole.SUPERVISOR]: true,
  },
};

export function createEmptyPipelineState(): AgentPipelineState {
  const emptyOutput = (role: AgentRole): AgentOutput => ({
    role,
    status: AgentStatus.IDLE,
    content: '',
    durationMs: 0,
  });

  return {
    agents: {
      [AgentRole.MEMORY]: emptyOutput(AgentRole.MEMORY),
      [AgentRole.WORLD]: emptyOutput(AgentRole.WORLD),
      [AgentRole.CHARACTER]: emptyOutput(AgentRole.CHARACTER),
      [AgentRole.WRITER]: emptyOutput(AgentRole.WRITER),
      [AgentRole.SUPERVISOR]: emptyOutput(AgentRole.SUPERVISOR),
      [AgentRole.QA]: emptyOutput(AgentRole.QA),
      [AgentRole.EVALUATOR]: emptyOutput(AgentRole.EVALUATOR),
    },
    isRunning: false,
    currentAgent: null,
    startedAt: 0,
  };
}

// ============================================================
// Long-term Memory Store (persisted per session)
// ============================================================

export interface MemoryStore {
  entries: MemoryEntry[];
  summary: string;                    // rolling summary of the story so far
  lastUpdatedEpisode: number;
}

export const EMPTY_MEMORY_STORE: MemoryStore = {
  entries: [],
  summary: '',
  lastUpdatedEpisode: 0,
};

// ============================================================
// Character Arc Store (persisted per session)
// ============================================================

export interface CharacterArcStore {
  arcs: CharacterArcState[];
  lastUpdatedEpisode: number;
}

export const EMPTY_ARC_STORE: CharacterArcStore = {
  arcs: [],
  lastUpdatedEpisode: 0,
};
