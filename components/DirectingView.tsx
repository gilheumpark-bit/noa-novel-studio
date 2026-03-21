
import React, { useState } from 'react';
import {
  StoryConfig, AppLanguage, SetConfigFn,
  SceneEntry, SceneBeat, SceneDialogueNote, BeatType, EpisodeDirecting,
} from '../types';
import { TRANSLATIONS } from '../constants';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Film, Flame, Heart,
  Cookie, Zap, Anchor, Wind, MessageSquare, Clapperboard, Sparkles,
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

const DirectingView: React.FC<DirectingViewProps> = ({ language, config, setConfig }) => {
  const t = TRANSLATIONS[language].directing;
  const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
  const [formResetKey, setFormResetKey] = useState(0);

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
        <div className="flex items-center gap-2 text-[10px] font-black text-zinc-600">
          <Film className="w-3.5 h-3.5" /> EP.{config.episode}
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
