
import React, { useState } from 'react';
import {
  Bot, PenTool, Globe, ShieldCheck, BarChart3, Brain, UserCircle, Eye,
  ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, SkipForward,
  ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react';
import { AppLanguage } from '../types';
import { AgentRole, AgentStatus, AgentConfig, AgentPipelineState, DEFAULT_AGENT_CONFIG } from '../engine/agents/types';
import { TRANSLATIONS } from '../constants';

interface AgentPanelProps {
  language: AppLanguage;
  agentConfig: AgentConfig;
  pipelineState: AgentPipelineState | null;
  onConfigChange: (config: AgentConfig) => void;
}

const AGENT_ICONS: Record<AgentRole, React.FC<{ className?: string }>> = {
  [AgentRole.WRITER]: PenTool,
  [AgentRole.WORLD]: Globe,
  [AgentRole.QA]: ShieldCheck,
  [AgentRole.EVALUATOR]: BarChart3,
  [AgentRole.MEMORY]: Brain,
  [AgentRole.CHARACTER]: UserCircle,
  [AgentRole.SUPERVISOR]: Eye,
};

const AGENT_LABEL_KEYS: Record<AgentRole, string> = {
  [AgentRole.WRITER]: 'agentWriter',
  [AgentRole.WORLD]: 'agentWorld',
  [AgentRole.QA]: 'agentQA',
  [AgentRole.EVALUATOR]: 'agentEvaluator',
  [AgentRole.MEMORY]: 'agentMemory',
  [AgentRole.CHARACTER]: 'agentCharacter',
  [AgentRole.SUPERVISOR]: 'agentSupervisor',
};

const STATUS_LABEL_KEYS: Record<AgentStatus, string> = {
  [AgentStatus.IDLE]: 'agentIdle',
  [AgentStatus.RUNNING]: 'agentRunning',
  [AgentStatus.DONE]: 'agentDone',
  [AgentStatus.ERROR]: 'agentError',
  [AgentStatus.SKIPPED]: 'agentSkipped',
};

const PHASE_GROUPS = [
  { phase: 'agentPhasePreGen', agents: [AgentRole.MEMORY, AgentRole.WORLD, AgentRole.CHARACTER] },
  { phase: 'agentPhaseGeneration', agents: [AgentRole.WRITER, AgentRole.SUPERVISOR] },
  { phase: 'agentPhasePostGen', agents: [AgentRole.QA, AgentRole.EVALUATOR] },
];

function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case AgentStatus.RUNNING: return 'text-blue-400';
    case AgentStatus.DONE: return 'text-green-400';
    case AgentStatus.ERROR: return 'text-red-400';
    case AgentStatus.SKIPPED: return 'text-zinc-600';
    default: return 'text-zinc-600';
  }
}

function StatusIcon({ status }: { status: AgentStatus }) {
  switch (status) {
    case AgentStatus.RUNNING:
      return <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />;
    case AgentStatus.DONE:
      return <CheckCircle2 className="w-3 h-3 text-green-400" />;
    case AgentStatus.ERROR:
      return <XCircle className="w-3 h-3 text-red-400" />;
    case AgentStatus.SKIPPED:
      return <SkipForward className="w-3 h-3 text-zinc-600" />;
    default:
      return <div className="w-3 h-3 rounded-full border border-zinc-700" />;
  }
}

const AgentPanel: React.FC<AgentPanelProps> = ({ language, agentConfig, pipelineState, onConfigChange }) => {
  const [expandedAgent, setExpandedAgent] = useState<AgentRole | null>(null);
  const te = TRANSLATIONS[language].engine;

  const toggleMasterSwitch = () => {
    onConfigChange({ ...agentConfig, enabled: !agentConfig.enabled });
  };

  const toggleAgent = (role: AgentRole) => {
    if (role === AgentRole.WRITER) return; // Writer is always on
    onConfigChange({
      ...agentConfig,
      agents: { ...agentConfig.agents, [role]: !agentConfig.agents[role] },
    });
  };

  const totalDuration = pipelineState
    ? Object.values(pipelineState.agents).reduce((sum, a) => sum + a.durationMs, 0)
    : 0;

  return (
    <div className="space-y-4">
      {/* Master Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-500" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{te.agentMode}</span>
        </div>
        <button onClick={toggleMasterSwitch} className="flex items-center gap-1">
          {agentConfig.enabled ? (
            <ToggleRight className="w-6 h-6 text-purple-500" />
          ) : (
            <ToggleLeft className="w-6 h-6 text-zinc-600" />
          )}
        </button>
      </div>

      {!agentConfig.enabled && (
        <div className="text-[9px] text-zinc-700 text-center py-2">
          {language === 'KO' ? '에이전트 모드를 활성화하면 6개 전문 에이전트가 집필을 지원합니다.' :
           language === 'JP' ? 'エージェントモードを有効にすると6つの専門エージェントが執筆を支援します。' :
           language === 'CN' ? '启用代理模式后，6个专业代理将协助写作。' :
           'Enable agent mode to have 6 specialized agents assist your writing.'}
        </div>
      )}

      {agentConfig.enabled && (
        <>
          {/* Pipeline Status */}
          {pipelineState?.isRunning && (
            <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
              <span className="text-[9px] font-bold text-purple-400">
                {te[AGENT_LABEL_KEYS[pipelineState.currentAgent!]] || '...'} {te.agentRunning}
              </span>
            </div>
          )}

          {/* Agent Phases */}
          {PHASE_GROUPS.map(({ phase, agents }) => (
            <div key={phase} className="space-y-1">
              <div className="text-[8px] font-black text-zinc-700 uppercase tracking-widest pl-1">
                {te[phase]}
              </div>
              {agents.map(role => {
                const Icon = AGENT_ICONS[role];
                const agentState = pipelineState?.agents[role];
                const status = agentState?.status || AgentStatus.IDLE;
                const isActive = agentConfig.agents[role];
                const isExpanded = expandedAgent === role;
                const isWriter = role === AgentRole.WRITER;

                return (
                  <div key={role} className={`rounded-xl border transition-all ${
                    status === AgentStatus.RUNNING ? 'border-blue-500/30 bg-blue-500/5' :
                    status === AgentStatus.DONE ? 'border-green-500/10 bg-green-500/5' :
                    status === AgentStatus.ERROR ? 'border-red-500/10 bg-red-500/5' :
                    'border-zinc-800/50 bg-zinc-900/30'
                  }`}>
                    <div
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                      onClick={() => setExpandedAgent(isExpanded ? null : role)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleAgent(role); }}
                        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
                          isWriter ? 'border-purple-500/50 bg-purple-500/20' :
                          isActive ? 'border-purple-500 bg-purple-500' : 'border-zinc-700 bg-transparent'
                        }`}
                        disabled={isWriter}
                      >
                        {(isActive || isWriter) && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                      </button>
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-300' : 'text-zinc-700'}`} />
                      <span className={`text-[10px] font-bold flex-1 ${isActive ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        {te[AGENT_LABEL_KEYS[role]]}
                      </span>
                      <StatusIcon status={status} />
                      {agentState && agentState.durationMs > 0 && (
                        <span className="text-[7px] text-zinc-700 font-mono">
                          {(agentState.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-zinc-600" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                      )}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && agentState && agentState.content && (
                      <div className="px-3 pb-2 border-t border-zinc-800/30">
                        <div className="text-[8px] text-zinc-500 mt-2 leading-relaxed whitespace-pre-wrap">
                          {agentState.content}
                        </div>
                        {agentState.metadata && (
                          <div className="mt-2 space-y-1">
                            {/* QA pass rate */}
                            {agentState.metadata.passRate !== undefined && (
                              <div className="flex items-center gap-2">
                                <span className="text-[7px] text-zinc-600">Pass Rate</span>
                                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${agentState.metadata.passRate >= 70 ? 'bg-green-500' : agentState.metadata.passRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                    style={{ width: `${agentState.metadata.passRate}%` }}
                                  />
                                </div>
                                <span className="text-[7px] text-zinc-500 font-mono">{agentState.metadata.passRate}%</span>
                              </div>
                            )}
                            {/* Evaluator overall score */}
                            {agentState.metadata.overallScore !== undefined && (
                              <div className="flex items-center gap-2">
                                <span className="text-[7px] text-zinc-600">Score</span>
                                <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-purple-500"
                                    style={{ width: `${agentState.metadata.overallScore}%` }}
                                  />
                                </div>
                                <span className="text-[7px] text-zinc-500 font-mono">
                                  {agentState.metadata.letterGrade} ({agentState.metadata.overallScore})
                                </span>
                              </div>
                            )}
                            {/* Supervisor alerts */}
                            {agentState.metadata.alerts && (
                              <div className="space-y-1 mt-1">
                                <div className="text-[7px] text-zinc-600 font-black">ALERTS</div>
                                {(Array.isArray(agentState.metadata.alerts) ? agentState.metadata.alerts : []).slice(-5).map((alert: any, idx: number) => (
                                  <div key={idx} className="flex items-start gap-1">
                                    <AlertTriangle className={`w-2.5 h-2.5 shrink-0 mt-0.5 ${
                                      alert.type === 'critical' ? 'text-red-400' :
                                      alert.type === 'warning' ? 'text-amber-400' : 'text-zinc-500'
                                    }`} />
                                    <div>
                                      <div className="text-[7px] text-zinc-400">{alert.message}</div>
                                      <div className="text-[6px] text-zinc-600">{alert.suggestion}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Supervisor EOS + tension */}
                            {agentState.metadata.eosEstimate !== undefined && agentState.metadata.checkpointCount !== undefined && (
                              <div className="flex gap-3 mt-1">
                                <div className="text-[7px]">
                                  <span className="text-zinc-600">EOS</span>{' '}
                                  <span className={`font-mono ${agentState.metadata.eosEstimate >= 40 ? 'text-green-500' : 'text-red-400'}`}>
                                    {agentState.metadata.eosEstimate}
                                  </span>
                                </div>
                                <div className="text-[7px]">
                                  <span className="text-zinc-600">Tension</span>{' '}
                                  <span className="text-zinc-400 font-mono">{agentState.metadata.tensionLevel}</span>
                                </div>
                                <div className="text-[7px]">
                                  <span className="text-zinc-600">CP</span>{' '}
                                  <span className="text-zinc-400 font-mono">{agentState.metadata.checkpointCount}</span>
                                </div>
                              </div>
                            )}
                            {/* Evaluator detail scores */}
                            {agentState.metadata.scores && (
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
                                {Object.entries(agentState.metadata.scores as Record<string, number>).map(([key, value]) => (
                                  <div key={key} className="flex justify-between text-[7px]">
                                    <span className="text-zinc-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                                    <span className={`font-mono ${value >= 70 ? 'text-green-500' : value >= 40 ? 'text-amber-500' : 'text-red-500'}`}>{value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Total Duration */}
          {totalDuration > 0 && !pipelineState?.isRunning && (
            <div className="text-[8px] text-zinc-700 text-right font-mono">
              Total: {(totalDuration / 1000).toFixed(1)}s
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgentPanel;
