
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Settings, Send,
  Sparkles, Menu, Globe, UserCircle,
  BookOpen, Zap, Ghost, X, PenTool, History, StopCircle, Key, LogOut
} from 'lucide-react';
import {
  Message, StoryConfig, Genre,
  AppLanguage, AppTab, PlatformType, SetConfigFn,
  AgentConfig, AgentPipelineState,
  DEFAULT_AGENT_CONFIG, EMPTY_MEMORY_STORE, EMPTY_ARC_STORE,
} from './types';
import type { MemoryStore, CharacterArcStore } from './types';
import { TRANSLATIONS, ENGINE_VERSION } from './constants';
import { EngineReport } from './engine/types';
import ChatMessage from './components/ChatMessage';
import PlanningView from './components/PlanningView';
import ResourceView from './components/ResourceView';
import SettingsView from './components/SettingsView';
import RulebookView from './components/RulebookView';
import EngineDashboard from './components/EngineDashboard';
import EngineStatusBar from './components/EngineStatusBar';
import ApiKeyModal from './components/ApiKeyModal';
import { generateStoryStream, hasAnyApiKey, clearAllApiKeys } from './services/aiService';
import { analyzeEOSFailure } from './engine/eosFeedback';
import { extractEmotionalState } from './engine/emotionalArc';
import { calculateEOSScore } from './engine/scoring';
import { runAgentPipeline } from './engine/agents/orchestrator';

const STORAGE_KEY_SESSIONS = 'noa_chat_sessions_v2';

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  config: StoryConfig;
  lastUpdate: number;
  agentConfig?: AgentConfig;
  memoryStore?: MemoryStore;
  arcStore?: CharacterArcStore;
}

const INITIAL_CONFIG: StoryConfig = {
  genre: Genre.SYSTEM_HUNTER,
  povCharacter: "",
  setting: "",
  primaryEmotion: "",
  episode: 1,
  title: "",
  totalEpisodes: 25,
  guardrails: { min: 3000, max: 5000 },
  characters: [],
  platform: PlatformType.MOBILE,
};

function migrateConfig(raw: any): StoryConfig {
  return {
    ...INITIAL_CONFIG,
    ...raw,
    foreshadowings: raw.foreshadowings ?? [],
    worldRules: raw.worldRules ?? [],
    worldFacts: raw.worldFacts ?? [],
    emotionalHistory: raw.emotionalHistory ?? [],
    eosHistory: raw.eosHistory ?? [],
    characters: (raw.characters ?? []).map((c: any) => ({
      ...c,
      dialogueProfile: c.dialogueProfile ?? undefined,
    })),
  };
}

function safeParseSessions(raw: string | null): ChatSession[] {
  if (!raw) return [];
  try {
    const sessions: ChatSession[] = JSON.parse(raw);
    return sessions.map(s => ({ ...s, config: migrateConfig(s.config) }));
  } catch {
    return [];
  }
}

function App() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    return safeParseSessions(localStorage.getItem(STORAGE_KEY_SESSIONS));
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (!raw) return null;
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) && arr.length > 0 ? arr[0].id : null;
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState<AppTab>('world');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isGenerating, setIsGenerating] = useState(false);
  const [language, setLanguage] = useState<AppLanguage>('KO');
  const [input, setInput] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [lastReport, setLastReport] = useState<EngineReport | null>(null);
  const [, forceUpdate] = useState(0);
  const [agentPipelineState, setAgentPipelineState] = useState<AgentPipelineState | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(() => hasAnyApiKey());
  const abortControllerRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentSession = sessions.find(s => s.id === currentSessionId) || null;
  const t = TRANSLATIONS[language] || TRANSLATIONS['KO'];

  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debounced localStorage write (2 second delay)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [sessions]);

  // Flush on unmount — use ref to avoid stale closure
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  useEffect(() => {
    return () => {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessionsRef.current));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'writing') {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentSession?.messages, isGenerating, activeTab]);

  const createNewSession = () => {
    const sessionTitles: Record<AppLanguage, string> = { KO: "새로운 소설", EN: "New Story", JP: "新しい小説", CN: "新小说" };
    const savedPlatform = localStorage.getItem('noa_default_platform') as PlatformType | null;
    const savedEpisodes = parseInt(localStorage.getItem('noa_default_episodes') || '0');
    const newConfig = structuredClone(INITIAL_CONFIG);
    if (savedPlatform) newConfig.platform = savedPlatform;
    if (savedEpisodes > 0) newConfig.totalEpisodes = savedEpisodes;
    const newSession: ChatSession = {
      id: `session-${crypto.randomUUID()}`,
      title: sessionTitles[language],
      messages: [],
      config: newConfig,
      lastUpdate: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setActiveTab('world');
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleTabChange = (tab: AppTab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const deleteSession = (sessionIdToDelete: string) => {
    const sessionToDelete = sessions.find(s => s.id === sessionIdToDelete);
    if (!sessionToDelete) return;
    const confirmMsg = ({ KO: `'${sessionToDelete.title}' 아카이브를 삭제하시겠습니까?`, EN: `Delete '${sessionToDelete.title}'?`, JP: `'${sessionToDelete.title}'を削除しますか？`, CN: `删除 '${sessionToDelete.title}'？` })[language];
    if (window.confirm(confirmMsg)) {
      const newSessions = sessions.filter(s => s.id !== sessionIdToDelete);
      setSessions(newSessions);
      if (currentSessionId === sessionIdToDelete) {
        setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
        if (newSessions.length === 0) setActiveTab('world');
      }
    }
  };

  const clearAllSessions = () => {
    const confirmMsg = ({ KO: "모든 세션을 삭제하시겠습니까?", EN: "Delete all sessions?", JP: "すべてのセッションを削除しますか？", CN: "删除所有会话？" })[language];
    if (window.confirm(confirmMsg)) {
      setSessions([]);
      setCurrentSessionId(null);
      localStorage.removeItem(STORAGE_KEY_SESSIONS);
      setActiveTab('world');
    }
  };

  const updateCurrentSession = useCallback((updates: Partial<ChatSession>) => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s =>
      s.id === currentSessionId ? { ...s, ...updates, lastUpdate: Date.now() } : s
    ));
  }, [currentSessionId]);

  const setConfig: SetConfigFn = useCallback((newConfig) => {
    if (!currentSessionId) return;
    if (typeof newConfig === 'function') {
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId
          ? { ...s, config: newConfig(s.config), lastUpdate: Date.now() }
          : s
      ));
    } else {
      updateCurrentSession({ config: newConfig });
    }
  }, [currentSessionId, updateCurrentSession]);

  const setAgentConfig = useCallback((newConfig: AgentConfig) => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s =>
      s.id === currentSessionId ? { ...s, agentConfig: newConfig, lastUpdate: Date.now() } : s
    ));
  }, [currentSessionId]);

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
  };

  const getErrorMessage = (error: any): string => {
    const msg = error?.message || String(error);
    const errorMessages: Record<AppLanguage, string> = {
      KO: `생성 중 오류가 발생했습니다: ${msg}`,
      EN: `Generation error: ${msg}`,
      JP: `生成エラー: ${msg}`,
      CN: `生成错误: ${msg}`,
    };
    return errorMessages[language];
  };

  const handleSend = async (customPrompt?: string) => {
    const text = customPrompt || input;
    if (!text.trim() || isGenerating || !currentSessionId || !currentSession) return;

    const userMsg: Message = { id: `u-${crypto.randomUUID()}`, role: 'user', content: text, timestamp: Date.now() };
    const aiMsgId = `a-${crypto.randomUUID()}`;
    const initialAiMsg: Message = { id: aiMsgId, role: 'assistant', content: '', timestamp: Date.now() };

    const existingMessages = currentSession.messages;
    const sessionAgentConfig = currentSession.agentConfig ?? DEFAULT_AGENT_CONFIG;
    const useAgents = sessionAgentConfig.enabled;

    const updatedMessages = [...existingMessages, userMsg, initialAiMsg];
    updateCurrentSession({
      messages: updatedMessages,
      title: existingMessages.length === 0 ? text.substring(0, 15) : currentSession.title
    });
    setInput('');
    setIsGenerating(true);
    if (useAgents) setAgentPipelineState(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let fullContent = '';
      let result: { content: string; report: EngineReport };

      if (useAgents) {
        // ── Agent Pipeline Mode ──
        const memoryStore = currentSession.memoryStore ?? EMPTY_MEMORY_STORE;
        const arcStore = currentSession.arcStore ?? EMPTY_ARC_STORE;

        const orchestratorResult = await runAgentPipeline(
          currentSession.config,
          text,
          existingMessages,
          language,
          sessionAgentConfig,
          memoryStore,
          arcStore,
          {
            onAgentUpdate: (state) => setAgentPipelineState({ ...state }),
            onChunk: (chunk) => {
              fullContent += chunk;
              setSessions(prev => prev.map(s => {
                if (s.id === currentSessionId) {
                  const msgs = s.messages.map(m => m.id === aiMsgId ? { ...m, content: fullContent } : m);
                  return { ...s, messages: msgs };
                }
                return s;
              }));
            },
            onMemoryStoreUpdate: (store) => {
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? { ...s, memoryStore: store } : s
              ));
            },
            onArcStoreUpdate: (store) => {
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? { ...s, arcStore: store } : s
              ));
            },
          },
          controller.signal,
        );

        result = { content: orchestratorResult.content, report: orchestratorResult.report };
      } else {
        // ── Standard Mode (existing flow) ──
        result = await generateStoryStream(
          currentSession.config,
          text,
          (chunk) => {
            fullContent += chunk;
            setSessions(prev => prev.map(s => {
              if (s.id === currentSessionId) {
                const msgs = s.messages.map(m => m.id === aiMsgId ? { ...m, content: fullContent } : m);
                return { ...s, messages: msgs };
              }
              return s;
            }));
          },
          {
            language,
            signal: controller.signal,
            platform: currentSession.config.platform,
            history: existingMessages,
          }
        );
      }

      setLastReport(result.report);
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const msgs = s.messages.map(m =>
            m.id === aiMsgId
              ? { ...m, content: fullContent, meta: { engineReport: result.report, grade: result.report.grade, eosScore: result.report.eosScore, metrics: result.report.metrics } }
              : m
          );

          // Save EOS history and emotional state
          const updatedConfig = { ...s.config };
          const eosScore = result.report.eosScore;
          const eosFailure = analyzeEOSFailure(eosScore, fullContent, s.config.episode);
          if (eosFailure) {
            updatedConfig.eosHistory = [...(updatedConfig.eosHistory || []), eosFailure].slice(-5);
          }
          if (s.config.povCharacter) {
            const emotionalState = extractEmotionalState(fullContent, s.config.povCharacter, s.config.episode);
            if (Object.keys(emotionalState.emotions).length > 0) {
              updatedConfig.emotionalHistory = [...(updatedConfig.emotionalHistory || []), emotionalState].slice(-(s.config.totalEpisodes * Math.max(1, s.config.characters.length)));
            }
          }

          return { ...s, messages: msgs, config: updatedConfig };
        }
        return s;
      }));
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(error);
        const errorMsg = getErrorMessage(error);
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const msgs = s.messages.map(m =>
              m.id === aiMsgId ? { ...m, content: `⚠️ ${errorMsg}` } : m
            );
            return { ...s, messages: msgs };
          }
          return s;
        }));
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = async (assistantMsgId: string) => {
    if (isGenerating || !currentSessionId || !currentSession) return;

    const msgIndex = currentSession.messages.findIndex(m => m.id === assistantMsgId);
    if (msgIndex < 1) return;
    const userMsg = currentSession.messages[msgIndex - 1];
    if (userMsg.role !== 'user') return;

    const historyMessages = currentSession.messages.slice(0, msgIndex - 1);
    const sessionAgentConfig = currentSession.agentConfig ?? DEFAULT_AGENT_CONFIG;
    const useAgents = sessionAgentConfig.enabled;

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const msgs = s.messages.map(m => m.id === assistantMsgId ? { ...m, content: '', meta: undefined } : m);
        return { ...s, messages: msgs };
      }
      return s;
    }));
    setIsGenerating(true);
    if (useAgents) setAgentPipelineState(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let fullContent = '';
      let result: { content: string; report: EngineReport };

      if (useAgents) {
        const memoryStore = currentSession.memoryStore ?? EMPTY_MEMORY_STORE;
        const arcStore = currentSession.arcStore ?? EMPTY_ARC_STORE;

        const orchestratorResult = await runAgentPipeline(
          currentSession.config,
          userMsg.content,
          historyMessages,
          language,
          sessionAgentConfig,
          memoryStore,
          arcStore,
          {
            onAgentUpdate: (state) => setAgentPipelineState({ ...state }),
            onChunk: (chunk) => {
              fullContent += chunk;
              setSessions(prev => prev.map(s => {
                if (s.id === currentSessionId) {
                  const msgs = s.messages.map(m => m.id === assistantMsgId ? { ...m, content: fullContent } : m);
                  return { ...s, messages: msgs };
                }
                return s;
              }));
            },
            onMemoryStoreUpdate: (store) => {
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? { ...s, memoryStore: store } : s
              ));
            },
            onArcStoreUpdate: (store) => {
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? { ...s, arcStore: store } : s
              ));
            },
          },
          controller.signal,
        );
        result = { content: orchestratorResult.content, report: orchestratorResult.report };
      } else {
        result = await generateStoryStream(
          currentSession.config,
          userMsg.content,
          (chunk) => {
            fullContent += chunk;
            setSessions(prev => prev.map(s => {
              if (s.id === currentSessionId) {
                const msgs = s.messages.map(m => m.id === assistantMsgId ? { ...m, content: fullContent } : m);
                return { ...s, messages: msgs };
              }
              return s;
            }));
          },
          {
            language,
            signal: controller.signal,
            platform: currentSession.config.platform,
            history: historyMessages,
          }
        );
      }

      setLastReport(result.report);
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          const msgs = s.messages.map(m =>
            m.id === assistantMsgId
              ? { ...m, content: fullContent, meta: { engineReport: result.report, grade: result.report.grade, eosScore: result.report.eosScore, metrics: result.report.metrics } }
              : m
          );

          const updatedConfig = { ...s.config };
          const eosScore = result.report.eosScore;
          const eosFailure = analyzeEOSFailure(eosScore, fullContent, s.config.episode);
          if (eosFailure) {
            updatedConfig.eosHistory = [...(updatedConfig.eosHistory || []), eosFailure].slice(-5);
          }
          if (s.config.povCharacter) {
            const emotionalState = extractEmotionalState(fullContent, s.config.povCharacter, s.config.episode);
            if (Object.keys(emotionalState.emotions).length > 0) {
              updatedConfig.emotionalHistory = [...(updatedConfig.emotionalHistory || []), emotionalState].slice(-(s.config.totalEpisodes * Math.max(1, s.config.characters.length)));
            }
          }

          return { ...s, messages: msgs, config: updatedConfig };
        }
        return s;
      }));
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(error);
        const errorMsg = getErrorMessage(error);
        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
            const msgs = s.messages.map(m =>
              m.id === assistantMsgId ? { ...m, content: `⚠️ ${errorMsg}` } : m
            );
            return { ...s, messages: msgs };
          }
          return s;
        }));
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleNextEpisode = () => {
    if (!currentSession) return;
    const nextEp = Math.min(currentSession.config.episode + 1, currentSession.config.totalEpisodes);
    setConfig({ ...currentSession.config, episode: nextEp });
  };

  const handleApiKeySaved = () => {
    setIsLoggedIn(true);
    forceUpdate(n => n + 1);
  };

  const handleLogout = () => {
    const confirmMsg = ({
      KO: 'API 키를 삭제하고 로그아웃하시겠습니까?',
      EN: 'Clear API keys and log out?',
      JP: 'APIキーを削除してログアウトしますか？',
      CN: '清除API密钥并退出？',
    })[language];
    if (window.confirm(confirmMsg)) {
      clearAllApiKeys();
      setIsLoggedIn(false);
    }
  };

  // Login gate — show API key entry screen if not logged in
  if (!isLoggedIn) {
    return (
      <div className="flex h-screen bg-[#050505] text-zinc-300 font-sans items-center justify-center">
        <div className="w-full max-w-sm mx-4 text-center space-y-8">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Zap className="w-8 h-8 text-blue-500" />
              <h1 className="text-2xl font-black italic tracking-tighter">NOA STUDIO</h1>
            </div>
            <p className="text-zinc-600 text-xs font-bold uppercase tracking-widest">
              {language === 'KO' ? 'AI 소설 엔진' : language === 'JP' ? 'AI小説エンジン' : language === 'CN' ? 'AI小说引擎' : 'AI Novel Engine'}
            </p>
          </div>
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4" />
            {language === 'KO' ? 'API 키 입력' : language === 'JP' ? 'APIキー入力' : language === 'CN' ? '输入API密钥' : 'Enter API Key'}
          </button>
          <div className="flex justify-center gap-4">
            {(['KO', 'EN', 'JP', 'CN'] as AppLanguage[]).map(l => (
              <button key={l} onClick={() => setLanguage(l)} className={`text-[10px] font-black ${language === l ? 'text-blue-500' : 'text-zinc-700'}`}>{l}</button>
            ))}
          </div>
          <p className="text-[9px] text-zinc-800">
            {language === 'KO' ? 'API 키는 현재 세션에만 저장되며 브라우저 종료 시 삭제됩니다.' :
             language === 'JP' ? 'APIキーは現在のセッションにのみ保存され、ブラウザ終了時に削除されます。' :
             language === 'CN' ? 'API密钥仅保存在当前会话中，关闭浏览器时会被删除。' :
             'API keys are stored only for this session and cleared when the browser is closed.'}
          </p>
        </div>
        {showApiKeyModal && (
          <ApiKeyModal
            language={language}
            onClose={() => setShowApiKeyModal(false)}
            onSave={handleApiKeySaved}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050505] text-zinc-300 font-sans overflow-hidden">
      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-40 md:hidden" />}

      {/* Sidebar */}
      <aside className={`fixed md:relative inset-y-0 left-0 bg-black border-r border-zinc-900 transition-transform md:transition-all duration-300 flex flex-col z-50 overflow-hidden ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-0'}`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <Zap className="w-6 h-6 text-blue-500" />
            <h1 className="text-lg font-black italic tracking-tighter">NOA STUDIO</h1>
          </div>
          <button onClick={createNewSession} className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all mb-8 border border-zinc-800">
            <Plus className="w-4 h-4" /> {t.sidebar.newProject}
          </button>

          <nav className="space-y-1">
            {([
              { tab: 'world' as AppTab, icon: Globe, label: t.sidebar.worldBible },
              { tab: 'characters' as AppTab, icon: UserCircle, label: t.sidebar.characterStudio },
              { tab: 'rulebook' as AppTab, icon: BookOpen, label: t.sidebar.rulebook },
              { tab: 'writing' as AppTab, icon: PenTool, label: t.sidebar.writingMode },
              { tab: 'history' as AppTab, icon: History, label: t.sidebar.archives },
            ]).map(({ tab, icon: Icon, label }) => (
              <button key={tab} onClick={() => handleTabChange(tab)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-500 hover:bg-zinc-900'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-zinc-900">
          <div className="flex gap-4 mb-4">
            {(['KO', 'EN', 'JP', 'CN'] as AppLanguage[]).map(l => (
              <button key={l} onClick={() => setLanguage(l)} className={`text-[10px] font-black ${language === l ? 'text-blue-500' : 'text-zinc-700'}`}>{l}</button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => handleTabChange('settings')}
              className={`flex items-center gap-2 text-xs font-bold transition-colors ${activeTab === 'settings' ? 'text-blue-500' : 'text-zinc-600 hover:text-white'}`}
            >
              <Settings className="w-4 h-4" /> {t.sidebar.settings}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-zinc-700 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
              title={language === 'KO' ? '로그아웃' : 'Logout'}
            >
              <LogOut className="w-3 h-3" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative bg-[#050505] overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-zinc-900 bg-black/30 backdrop-blur-xl z-30 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-zinc-900 rounded-lg transition-colors">
              <Menu className="w-5 h-5 text-zinc-500" />
            </button>
            <div className="text-sm font-black tracking-tighter uppercase flex items-center gap-2 min-w-0">
              <span className="text-zinc-600 hidden sm:inline">{t.sidebar.activeProject}:</span>
              <span className="text-zinc-200 truncate">{currentSession?.title || t.engine.noStory}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {currentSession && (
              <div className="flex gap-2 md:gap-4">
                <div className="px-3 py-1 bg-zinc-900 rounded-full text-[10px] font-bold text-zinc-500 border border-zinc-800 hidden sm:block">
                  {currentSession.config.genre}
                </div>
                <button
                  onClick={() => setShowDashboard(!showDashboard)}
                  className={`px-3 py-1 rounded-full text-[10px] font-black border transition-all ${
                    showDashboard
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                      : 'bg-blue-600/10 text-blue-500 border-blue-500/20 hover:bg-blue-600/20'
                  }`}
                >
                  ANS {ENGINE_VERSION}
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {!currentSessionId && !['settings', 'history', 'rulebook'].includes(activeTab) ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <Ghost className="w-12 h-12 md:w-16 md:h-16 text-zinc-900 mb-6" />
                <h2 className="text-xl md:text-2xl font-black mb-2 tracking-tighter uppercase">{t.engine.noActiveNarrative}</h2>
                <p className="text-zinc-600 text-sm mb-8">{t.engine.startPrompt}</p>
                <button onClick={createNewSession} className="px-8 py-3 md:px-10 md:py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest">{t.sidebar.newProject}</button>
              </div>
            ) : (
              <>
                {activeTab === 'world' && currentSession && (
                  <PlanningView
                    language={language}
                    config={currentSession.config}
                    setConfig={setConfig}
                    onStart={() => setActiveTab('writing')}
                  />
                )}
                {activeTab === 'characters' && currentSession && (
                  <ResourceView
                    language={language}
                    config={currentSession.config}
                    setConfig={setConfig}
                  />
                )}
                {activeTab === 'settings' && (
                  <SettingsView
                    language={language}
                    onClearAll={clearAllSessions}
                    onManageApiKey={() => setShowApiKeyModal(true)}
                  />
                )}
                {activeTab === 'rulebook' && (
                  <RulebookView language={language} />
                )}
                {activeTab === 'writing' && currentSession && (
                  <div className="max-w-4xl mx-auto py-8 px-4 md:py-12 md:px-6 space-y-12">
                    <EngineStatusBar
                      language={language}
                      config={currentSession.config}
                      report={lastReport}
                      isGenerating={isGenerating}
                    />

                    {currentSession.messages.length === 0 ? (
                      <div className="py-20 text-center space-y-4">
                        <Sparkles className="w-10 h-10 text-blue-900 mx-auto" />
                        <p className="text-zinc-600 text-sm font-medium">{t.engine.startPrompt}</p>
                      </div>
                    ) : (
                      currentSession.messages.map(msg => (
                        <ChatMessage key={msg.id} message={msg} language={language} onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined} />
                      ))
                    )}
                    <div ref={messagesEndRef} className="h-32" />
                  </div>
                )}
                {activeTab === 'history' && (
                  <div className="p-4 md:p-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {sessions.length === 0 ? (
                      <div className="col-span-full py-20 text-center text-zinc-600 font-bold uppercase tracking-widest">{t.engine.noArchive}</div>
                    ) : (
                      sessions.map(s => (
                        <div
                          key={s.id}
                          onClick={() => { setCurrentSessionId(s.id); setActiveTab('writing'); }}
                          className={`relative group p-6 bg-zinc-900/30 border border-zinc-800 rounded-3xl cursor-pointer hover:border-blue-500 transition-all ${currentSessionId === s.id ? 'border-blue-600 ring-1 ring-blue-600' : ''}`}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                            className="absolute top-4 right-4 p-2 bg-zinc-800/50 rounded-full text-zinc-600 hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 z-10"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <h4 className="font-black text-sm mb-2 pr-8 truncate">{s.title}</h4>
                          <div className="flex gap-2">
                            <span className="text-[9px] font-bold text-zinc-600 uppercase">{s.config.genre}</span>
                            <span className="text-[9px] font-bold text-zinc-600 uppercase">EP.{s.config.episode}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {showDashboard && activeTab === 'writing' && currentSession && (
            <EngineDashboard
              config={currentSession.config}
              report={lastReport}
              isGenerating={isGenerating}
              language={language}
              agentConfig={currentSession.agentConfig ?? DEFAULT_AGENT_CONFIG}
              agentPipelineState={agentPipelineState}
              onAgentConfigChange={setAgentConfig}
            />
          )}
        </div>

        {/* Writing Input */}
        {activeTab === 'writing' && currentSessionId && (
          <div className="p-4 md:p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent pt-8 md:pt-12 shrink-0">
            <div className="max-w-4xl mx-auto relative">
              <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 md:bottom-auto md:-top-10 md:left-4 md:translate-x-0 flex gap-2">
                <button onClick={() => handleSend(t.engine.nextChapterPrompt)} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-500 hover:text-white transition-all whitespace-nowrap">
                  {t.engine.nextChapter}
                </button>
                <button onClick={() => handleSend(t.engine.plotTwistPrompt)} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-500 hover:text-white transition-all whitespace-nowrap">
                  {t.engine.plotTwist}
                </button>
                {currentSession && currentSession.config.episode < currentSession.config.totalEpisodes && (
                  <button onClick={handleNextEpisode} className="px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-full text-[10px] font-bold text-blue-400 hover:bg-blue-600/20 transition-all whitespace-nowrap">
                    EP.{currentSession.config.episode} → {currentSession.config.episode + 1}
                  </button>
                )}
              </div>
              <div className="relative bg-[#111] border border-zinc-800 rounded-3xl md:rounded-[2rem] shadow-2xl focus-within:border-blue-500/30 transition-all p-2 pl-4 md:pl-6 flex items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={t.writing.inputPlaceholder}
                  className="flex-1 bg-transparent border-none outline-none py-3 md:py-4 text-sm md:text-[15px] text-zinc-200 placeholder-zinc-800 resize-none max-h-40 custom-scrollbar leading-relaxed"
                  rows={1}
                  disabled={isGenerating}
                />
                {isGenerating ? (
                  <button
                    onClick={handleCancel}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center bg-red-600 text-white transition-all shrink-0 hover:bg-red-500"
                  >
                    <StopCircle className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                      input.trim() ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-600'
                    }`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <ApiKeyModal
          language={language}
          onClose={() => setShowApiKeyModal(false)}
          onSave={handleApiKeySaved}
        />
      )}
    </div>
  );
}

export default App;
