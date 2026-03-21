
import React, { useState } from 'react';
import {
  StoryConfig, AppLanguage, SetConfigFn,
  SceneEntry, SceneBeat, SceneDialogueNote, BeatType, EpisodeDirecting,
} from '../types';
import { TRANSLATIONS } from '../constants';
import { generateScenes } from '../services/aiService';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Film, Flame, Heart,
  Cookie, Zap, Anchor, Wind, MessageSquare, Clapperboard, Sparkles,
  Wand2, Loader2, BookOpen,
} from 'lucide-react';

interface DirectingViewProps {
  language: AppLanguage;
  config: StoryConfig;
  setConfig: SetConfigFn;
}

// Beat type definitions
const BEAT_DEFS: Record<BeatType, { icon: React.ElementType; color: string; label: Record<AppLanguage, string> }> = {
  goguma:   { icon: Flame,  color: 'text-orange-400 bg-orange-500/10 border-orange-500/30', label: { KO: '고구마', EN: 'Frustration', JP: '焦り', CN: '焦虑' } },
  cider:    { icon: Sparkles, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30', label: { KO: '사이다', EN: 'Relief', JP: '爽快', CN: '爽快' } },
  dopamine: { icon: Zap,    color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', label: { KO: '도파민', EN: 'Dopamine', JP: 'ドーパミン', CN: '多巴胺' } },
  hook:     { icon: Anchor, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', label: { KO: '훅', EN: 'Hook', JP: 'フック', CN: '钩子' } },
  tension:  { icon: Heart,  color: 'text-red-400 bg-red-500/10 border-red-500/30', label: { KO: '긴장', EN: 'Tension', JP: '緊張', CN: '紧张' } },
  breather: { icon: Wind,   color: 'text-green-400 bg-green-500/10 border-green-500/30', label: { KO: '숨고르기', EN: 'Breather', JP: '息継ぎ', CN: '喘息' } },
};

const BEAT_TYPES: BeatType[] = ['goguma', 'cider', 'dopamine', 'hook', 'tension', 'breather'];

function createEmptyScene(sceneNumber: number): SceneEntry {
  return {
    id: `sc-${Date.now()}-${sceneNumber}`,
    sceneNumber,
    title: '',
    location: '',
    characters: [],
    mood: '',
    emotion: '',
    beats: [],
    dialogueNotes: [],
  };
}

function createEmptyDirecting(episode: number): EpisodeDirecting {
  return {
    episode,
    scenes: [createEmptyScene(1)],
    openingHook: '',
    endingHook: '',
    overallMood: '',
  };
}

// ============================================================
// Plot Presets — 대표 플롯 구조
// ============================================================

interface PlotPreset {
  id: string;
  name: Record<AppLanguage, string>;
  description: Record<AppLanguage, string>;
  generate: (episode: number) => EpisodeDirecting;
}

const uid = () => `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const bid = () => `bt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const PLOT_PRESETS: PlotPreset[] = [
  {
    id: 'kishotenketsu',
    name: { KO: '기승전결', EN: 'Kishōtenketsu', JP: '起承転結', CN: '起承转合' },
    description: { KO: '기(도입) → 승(전개) → 전(전환/반전) → 결(결말)', EN: 'Intro → Development → Twist → Conclusion', JP: '起→承→転→結', CN: '起→承→转→合' },
    generate: (ep) => ({
      episode: ep, openingHook: '', endingHook: '', overallMood: '',
      scenes: [
        { id: uid(), sceneNumber: 1, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [{ id: bid(), type: 'hook', description: '', intensity: 60 }],
          dialogueNotes: [] },
        { id: uid(), sceneNumber: 2, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'tension', description: '', intensity: 50 },
            { id: bid(), type: 'goguma', description: '', intensity: 40 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 3, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'hook', description: '', intensity: 90 },
            { id: bid(), type: 'dopamine', description: '', intensity: 70 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 4, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'cider', description: '', intensity: 80 },
            { id: bid(), type: 'breather', description: '', intensity: 50 },
          ], dialogueNotes: [] },
      ],
    }),
  },
  {
    id: 'tension-release',
    name: { KO: '고구마→사이다', EN: 'Frustration→Relief', JP: '焦り→爽快', CN: '焦虑→爽快' },
    description: { KO: '답답함을 극한까지 쌓고 한 방에 해소', EN: 'Build max frustration then explosive relief', JP: 'フラストレーション蓄積→一気に解放', CN: '积累到极限后一次性释放' },
    generate: (ep) => ({
      episode: ep, openingHook: '', endingHook: '', overallMood: '',
      scenes: [
        { id: uid(), sceneNumber: 1, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [{ id: bid(), type: 'goguma', description: '', intensity: 40 }],
          dialogueNotes: [] },
        { id: uid(), sceneNumber: 2, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'goguma', description: '', intensity: 65 },
            { id: bid(), type: 'tension', description: '', intensity: 70 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 3, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'goguma', description: '', intensity: 90 },
            { id: bid(), type: 'tension', description: '', intensity: 95 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 4, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'cider', description: '', intensity: 100 },
            { id: bid(), type: 'dopamine', description: '', intensity: 90 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 5, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [{ id: bid(), type: 'breather', description: '', intensity: 40 }],
          dialogueNotes: [] },
      ],
    }),
  },
  {
    id: 'cliffhanger',
    name: { KO: '훅 폭격', EN: 'Hook Barrage', JP: 'フック連打', CN: '钩子轰炸' },
    description: { KO: '씬마다 훅을 심어 이탈 불가 구조', EN: 'Plant hooks in every scene — zero escape', JP: '毎シーンにフック→離脱不可構造', CN: '每场景埋钩子，不可能离开' },
    generate: (ep) => ({
      episode: ep, openingHook: '', endingHook: '', overallMood: '',
      scenes: [
        { id: uid(), sceneNumber: 1, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'hook', description: '', intensity: 80 },
            { id: bid(), type: 'tension', description: '', intensity: 60 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 2, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'dopamine', description: '', intensity: 50 },
            { id: bid(), type: 'hook', description: '', intensity: 85 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 3, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'goguma', description: '', intensity: 70 },
            { id: bid(), type: 'hook', description: '', intensity: 90 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 4, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'tension', description: '', intensity: 95 },
            { id: bid(), type: 'hook', description: '', intensity: 100 },
          ], dialogueNotes: [] },
      ],
    }),
  },
  {
    id: 'emotional-roller',
    name: { KO: '감정 롤러코스터', EN: 'Emotional Roller', JP: '感情ジェットコースター', CN: '情感过山车' },
    description: { KO: '감정 진폭 극대화 — 웃다가 울다가', EN: 'Max emotional amplitude — laugh then cry', JP: '感情振幅最大化 — 笑って泣いて', CN: '情感振幅最大化 — 笑着哭着' },
    generate: (ep) => ({
      episode: ep, openingHook: '', endingHook: '', overallMood: '',
      scenes: [
        { id: uid(), sceneNumber: 1, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [{ id: bid(), type: 'dopamine', description: '', intensity: 70 }],
          dialogueNotes: [] },
        { id: uid(), sceneNumber: 2, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'breather', description: '', intensity: 60 },
            { id: bid(), type: 'goguma', description: '', intensity: 80 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 3, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'tension', description: '', intensity: 90 },
            { id: bid(), type: 'cider', description: '', intensity: 85 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 4, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'goguma', description: '', intensity: 95 },
            { id: bid(), type: 'dopamine', description: '', intensity: 100 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 5, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [{ id: bid(), type: 'breather', description: '', intensity: 30 }],
          dialogueNotes: [] },
      ],
    }),
  },
  {
    id: 'slow-burn',
    name: { KO: '슬로우번', EN: 'Slow Burn', JP: 'スローバーン', CN: '慢燃' },
    description: { KO: '조용한 일상 속 서서히 쌓이는 불안', EN: 'Quiet daily life with creeping dread', JP: '静かな日常に忍び寄る不安', CN: '平静日常中缓缓积累的不安' },
    generate: (ep) => ({
      episode: ep, openingHook: '', endingHook: '', overallMood: '',
      scenes: [
        { id: uid(), sceneNumber: 1, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [{ id: bid(), type: 'breather', description: '', intensity: 30 }],
          dialogueNotes: [] },
        { id: uid(), sceneNumber: 2, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [{ id: bid(), type: 'tension', description: '', intensity: 25 }],
          dialogueNotes: [] },
        { id: uid(), sceneNumber: 3, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'breather', description: '', intensity: 40 },
            { id: bid(), type: 'goguma', description: '', intensity: 35 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 4, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'tension', description: '', intensity: 55 },
            { id: bid(), type: 'goguma', description: '', intensity: 50 },
          ], dialogueNotes: [] },
        { id: uid(), sceneNumber: 5, title: '', location: '', characters: [], mood: '', emotion: '',
          beats: [
            { id: bid(), type: 'hook', description: '', intensity: 85 },
            { id: bid(), type: 'tension', description: '', intensity: 80 },
          ], dialogueNotes: [] },
      ],
    }),
  },
];

const DirectingView: React.FC<DirectingViewProps> = ({ language, config, setConfig }) => {
  const t = TRANSLATIONS[language].directing;
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [formResetKey, setFormResetKey] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const directing = config.episodeDirecting ?? createEmptyDirecting(config.episode);

  const updateDirecting = (updated: Partial<EpisodeDirecting>) => {
    setConfig({ ...config, episodeDirecting: { ...directing, ...updated } });
  };

  const updateScene = (sceneId: string, updated: Partial<SceneEntry>) => {
    const newScenes = directing.scenes.map(s =>
      s.id === sceneId ? { ...s, ...updated } : s
    );
    updateDirecting({ scenes: newScenes });
  };

  const addScene = () => {
    const nextNum = directing.scenes.length + 1;
    const newScene = createEmptyScene(nextNum);
    updateDirecting({ scenes: [...directing.scenes, newScene] });
    setExpandedScenes(prev => new Set(prev).add(newScene.id));
  };

  const removeScene = (sceneId: string) => {
    const newScenes = directing.scenes
      .filter(s => s.id !== sceneId)
      .map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    updateDirecting({ scenes: newScenes });
  };

  const toggleScene = (sceneId: string) => {
    setExpandedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const addBeat = (sceneId: string, type: BeatType) => {
    const scene = directing.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const newBeat: SceneBeat = { id: `bt-${Date.now()}`, type, description: '', intensity: 50 };
    updateScene(sceneId, { beats: [...scene.beats, newBeat] });
  };

  const updateBeat = (sceneId: string, beatId: string, updated: Partial<SceneBeat>) => {
    const scene = directing.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const newBeats = scene.beats.map(b => b.id === beatId ? { ...b, ...updated } : b);
    updateScene(sceneId, { beats: newBeats });
  };

  const removeBeat = (sceneId: string, beatId: string) => {
    const scene = directing.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    updateScene(sceneId, { beats: scene.beats.filter(b => b.id !== beatId) });
  };

  const addDialogueNote = (sceneId: string) => {
    const scene = directing.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const charInput = document.getElementById(`dn-char-${sceneId}`) as HTMLInputElement;
    const noteInput = document.getElementById(`dn-note-${sceneId}`) as HTMLInputElement;
    if (!charInput?.value || !noteInput?.value) return;
    const newNote: SceneDialogueNote = { characterName: charInput.value, note: noteInput.value };
    updateScene(sceneId, { dialogueNotes: [...scene.dialogueNotes, newNote] });
    setFormResetKey(k => k + 1);
  };

  const removeDialogueNote = (sceneId: string, idx: number) => {
    const scene = directing.scenes.find(s => s.id === sceneId);
    if (!scene) return;
    updateScene(sceneId, { dialogueNotes: scene.dialogueNotes.filter((_, i) => i !== idx) });
  };

  const applyPreset = (preset: PlotPreset) => {
    const newDirecting = preset.generate(config.episode);
    setConfig({ ...config, episodeDirecting: newDirecting });
    // Expand all scenes
    setExpandedScenes(new Set(newDirecting.scenes.map(s => s.id)));
  };

  const handleAutoGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await generateScenes(config, language);
      // Parse the result — it might be the full directing object or just scenes array
      const scenes: SceneEntry[] = (result.scenes || result || []).map((s: any, i: number) => ({
        id: uid(),
        sceneNumber: i + 1,
        title: s.title || '',
        location: s.location || '',
        characters: Array.isArray(s.characters) ? s.characters : [],
        mood: s.mood || '',
        emotion: s.emotion || '',
        beats: (s.beats || []).map((b: any) => ({
          id: bid(),
          type: BEAT_TYPES.includes(b.type) ? b.type : 'tension',
          description: b.description || '',
          intensity: typeof b.intensity === 'number' ? b.intensity : 50,
        })),
        dialogueNotes: (s.dialogueNotes || []).map((d: any) => ({
          characterName: d.characterName || '',
          note: d.note || '',
        })),
      }));

      const newDirecting: EpisodeDirecting = {
        episode: config.episode,
        scenes,
        openingHook: result.openingHook || '',
        endingHook: result.endingHook || '',
        overallMood: result.overallMood || '',
      };
      setConfig({ ...config, episodeDirecting: newDirecting });
      setExpandedScenes(new Set(scenes.map(s => s.id)));
    } catch (error) {
      console.error('Scene auto-generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Beat summary for the episode
  const beatSummary = BEAT_TYPES.map(type => ({
    type,
    count: directing.scenes.reduce((sum, s) => sum + s.beats.filter(b => b.type === type).length, 0),
  })).filter(b => b.count > 0);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-10 space-y-8 animate-in fade-in duration-700 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">{t.title}</h2>
          <p className="text-zinc-600 text-[10px] font-bold tracking-widest uppercase">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black text-zinc-600 flex items-center gap-1">
            <Film className="w-3.5 h-3.5" /> EP.{config.episode}
          </span>
          <button
            onClick={handleAutoGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 border border-blue-500 rounded-xl text-[10px] font-black text-white hover:bg-blue-500 transition-all uppercase tracking-widest disabled:opacity-50 shrink-0"
          >
            {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            {t.autoGenerate}
          </button>
        </div>
      </div>

      {/* Plot Presets */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-zinc-600" />
          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{t.plotPresets}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {PLOT_PRESETS.map(preset => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="flex flex-col items-start gap-1 p-3 bg-zinc-900/30 border border-zinc-800 rounded-xl text-left hover:border-zinc-600 hover:bg-zinc-900/50 transition-all"
            >
              <span className="text-[10px] font-black text-zinc-300">{preset.name[language]}</span>
              <span className="text-[8px] text-zinc-600 leading-tight">{preset.description[language]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Episode-level controls */}
      <div className="bg-zinc-900/20 border border-zinc-800 rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">{t.openingHook}</label>
            <input
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm font-bold focus:border-purple-600 outline-none transition-all"
              placeholder={t.openingHookPlaceholder}
              value={directing.openingHook}
              onChange={e => updateDirecting({ openingHook: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">{t.endingHook}</label>
            <input
              className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm font-bold focus:border-purple-600 outline-none transition-all"
              placeholder={t.endingHookPlaceholder}
              value={directing.endingHook}
              onChange={e => updateDirecting({ endingHook: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">{t.overallMood}</label>
          <input
            className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm font-bold focus:border-blue-600 outline-none transition-all"
            placeholder={t.overallMoodPlaceholder}
            value={directing.overallMood}
            onChange={e => updateDirecting({ overallMood: e.target.value })}
          />
        </div>

        {/* Beat summary bar */}
        {beatSummary.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-zinc-800">
            {beatSummary.map(({ type, count }) => {
              const def = BEAT_DEFS[type];
              const Icon = def.icon;
              return (
                <span key={type} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black ${def.color}`}>
                  <Icon className="w-3 h-3" /> {def.label[language]} x{count}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Scene List */}
      <div className="space-y-3">
        {directing.scenes.map(scene => {
          const isExpanded = expandedScenes.has(scene.id);
          return (
            <div key={scene.id} className="bg-zinc-900/20 border border-zinc-800 rounded-2xl overflow-hidden">
              {/* Scene Header */}
              <button
                onClick={() => toggleScene(scene.id)}
                className="w-full flex items-center gap-3 p-4 md:px-6 hover:bg-zinc-900/30 transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">S{scene.sceneNumber}</span>
                <span className="text-xs font-bold text-zinc-400 truncate flex-1 text-left">
                  {scene.title || t.untitledScene}
                </span>
                {/* Beat chips */}
                <div className="flex gap-1">
                  {scene.beats.map(b => {
                    const def = BEAT_DEFS[b.type];
                    const Icon = def.icon;
                    return <Icon key={b.id} className={`w-3 h-3 ${def.color.split(' ')[0]}`} />;
                  })}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); removeScene(scene.id); }}
                  className="p-1 text-zinc-700 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>

              {/* Scene Body */}
              {isExpanded && (
                <div className="px-4 md:px-6 pb-5 space-y-5 border-t border-zinc-800/50">
                  {/* Basic info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{t.sceneTitle}</label>
                      <input className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-xs focus:border-blue-600 outline-none"
                        value={scene.title} onChange={e => updateScene(scene.id, { title: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{t.location}</label>
                      <input className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-xs focus:border-blue-600 outline-none"
                        value={scene.location} onChange={e => updateScene(scene.id, { location: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{t.mood}</label>
                      <input className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-xs focus:border-blue-600 outline-none"
                        placeholder={t.moodPlaceholder}
                        value={scene.mood} onChange={e => updateScene(scene.id, { mood: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{t.emotion}</label>
                      <input className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-xs focus:border-blue-600 outline-none"
                        placeholder={t.emotionPlaceholder}
                        value={scene.emotion} onChange={e => updateScene(scene.id, { emotion: e.target.value })} />
                    </div>
                  </div>

                  {/* Characters in scene */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{t.sceneCharacters}</label>
                    <input className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-xs focus:border-blue-600 outline-none"
                      placeholder={t.sceneCharactersPlaceholder}
                      value={scene.characters.join(', ')}
                      onChange={e => updateScene(scene.id, { characters: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    />
                  </div>

                  {/* Beats */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{t.beats}</label>
                      <div className="flex gap-1">
                        {BEAT_TYPES.map(type => {
                          const def = BEAT_DEFS[type];
                          const Icon = def.icon;
                          return (
                            <button key={type} onClick={() => addBeat(scene.id, type)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[8px] font-black transition-all hover:scale-105 ${def.color}`}
                              title={def.label[language]}
                            >
                              <Icon className="w-3 h-3" /> <span className="hidden sm:inline">{def.label[language]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {scene.beats.map(beat => {
                      const def = BEAT_DEFS[beat.type];
                      const Icon = def.icon;
                      return (
                        <div key={beat.id} className={`flex items-start gap-3 bg-black/40 rounded-xl p-3 border ${def.color.split(' ').slice(1).join(' ')}`}>
                          <div className="flex items-center gap-1.5 pt-1 shrink-0">
                            <Icon className={`w-3.5 h-3.5 ${def.color.split(' ')[0]}`} />
                            <span className={`text-[8px] font-black uppercase ${def.color.split(' ')[0]}`}>{def.label[language]}</span>
                          </div>
                          <div className="flex-1 space-y-2">
                            <input className="w-full bg-transparent border-b border-zinc-800 pb-1 text-xs focus:border-blue-600 outline-none"
                              placeholder={t.beatDescription}
                              value={beat.description}
                              onChange={e => updateBeat(scene.id, beat.id, { description: e.target.value })}
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-zinc-700">{t.intensity}</span>
                              <input type="range" min="0" max="100" step="5"
                                className="flex-1 accent-current h-1 bg-zinc-800 rounded-full appearance-none"
                                value={beat.intensity}
                                onChange={e => updateBeat(scene.id, beat.id, { intensity: parseInt(e.target.value) })}
                              />
                              <span className="text-[9px] font-black text-zinc-500 w-8 text-right">{beat.intensity}%</span>
                            </div>
                          </div>
                          <button onClick={() => removeBeat(scene.id, beat.id)}
                            className="p-1 text-zinc-700 hover:text-red-500 transition-colors shrink-0">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dialogue Notes */}
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-zinc-700 uppercase tracking-widest flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" /> {t.dialogueNotes}
                    </label>

                    {scene.dialogueNotes.map((dn, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-black/40 rounded-lg p-3 border border-zinc-800/50">
                        <span className="text-[9px] font-black text-blue-400 shrink-0">{dn.characterName}</span>
                        <span className="text-[10px] text-zinc-500 flex-1">{dn.note}</span>
                        <button onClick={() => removeDialogueNote(scene.id, idx)}
                          className="p-1 text-zinc-700 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    <div key={`dn-form-${formResetKey}`} className="flex flex-wrap gap-2 items-end">
                      <input id={`dn-char-${scene.id}`}
                        className="w-28 bg-black border border-zinc-800 rounded-lg p-2.5 text-xs focus:border-blue-600 outline-none"
                        placeholder={t.characterName} />
                      <input id={`dn-note-${scene.id}`}
                        className="flex-1 min-w-[150px] bg-black border border-zinc-800 rounded-lg p-2.5 text-xs focus:border-blue-600 outline-none"
                        placeholder={t.dialogueNotePlaceholder} />
                      <button onClick={() => addDialogueNote(scene.id)}
                        className="px-3 py-2.5 bg-blue-600 text-white rounded-lg text-[10px] font-black hover:bg-blue-500 transition-all">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Scene Button */}
        <button onClick={addScene}
          className="w-full flex items-center justify-center gap-2 py-4 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl text-[10px] font-black text-zinc-600 uppercase tracking-widest hover:border-zinc-600 hover:text-zinc-400 transition-all">
          <Plus className="w-4 h-4" /> {t.addScene}
        </button>
      </div>

      {/* Beat Flow Visualization */}
      {directing.scenes.some(s => s.beats.length > 0) && (
        <div className="bg-zinc-900/20 border border-zinc-800 rounded-3xl md:rounded-[2.5rem] p-6 md:p-10 space-y-4">
          <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-blue-500" /> {t.beatFlow}
          </h3>
          <div className="flex items-end gap-1 h-24">
            {directing.scenes.flatMap(scene =>
              scene.beats.map(beat => {
                const def = BEAT_DEFS[beat.type];
                const colorClass = def.color.split(' ')[0];
                return (
                  <div key={beat.id} className="flex-1 relative group cursor-default" style={{ minWidth: '8px' }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-t-sm transition-all ${
                        beat.type === 'goguma' || beat.type === 'tension' ? 'bg-red-500/60' :
                        beat.type === 'cider' || beat.type === 'breather' ? 'bg-cyan-500/60' :
                        beat.type === 'dopamine' ? 'bg-yellow-500/60' : 'bg-purple-500/60'
                      }`}
                      style={{ height: `${beat.intensity}%` }}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-zinc-800 text-zinc-300 text-[7px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                      {def.label[language]} {beat.intensity}%
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-between text-[8px] text-zinc-700">
            <span>S1</span>
            <span>S{directing.scenes.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectingView;
