
import React, { useState } from 'react';
import { StoryConfig, AppLanguage, SetConfigFn } from '../types';
import { TRANSLATIONS } from '../constants';
import { LayoutGrid, Plus, Trash2, Edit3, Check, ChevronRight } from 'lucide-react';

interface OutlineBoardProps {
  language: AppLanguage;
  config: StoryConfig;
  setConfig: SetConfigFn;
  onNavigateToEpisode?: (episode: number) => void;
}

export interface EpisodeOutline {
  episode: number;
  title: string;
  summary: string;
  status: 'planned' | 'drafted' | 'done';
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'border-zinc-700 text-zinc-600',
  drafted: 'border-yellow-500/30 text-yellow-400',
  done: 'border-green-500/30 text-green-400',
};

const STATUS_LABELS: Record<string, Record<AppLanguage, string>> = {
  planned: { KO: '예정', EN: 'Planned', JP: '予定', CN: '计划' },
  drafted: { KO: '초안', EN: 'Draft', JP: '下書き', CN: '草稿' },
  done: { KO: '완료', EN: 'Done', JP: '完了', CN: '完成' },
};

const OutlineBoard: React.FC<OutlineBoardProps> = ({ language, config, setConfig, onNavigateToEpisode }) => {
  const t = TRANSLATIONS[language].outline;
  const totalEps = config.totalEpisodes ?? 25;
  const [outlines, setOutlines] = useState<EpisodeOutline[]>(() => {
    // Initialize from config or generate empty slots
    return Array.from({ length: totalEps }, (_, i) => ({
      episode: i + 1,
      title: '',
      summary: '',
      status: i + 1 < config.episode ? 'done' : i + 1 === config.episode ? 'drafted' : 'planned',
    }));
  });
  const [editingEp, setEditingEp] = useState<number | null>(null);

  const updateOutline = (episode: number, updates: Partial<EpisodeOutline>) => {
    setOutlines(prev => prev.map(o => o.episode === episode ? { ...o, ...updates } : o));
  };

  const cycleStatus = (episode: number) => {
    const outline = outlines.find(o => o.episode === episode);
    if (!outline) return;
    const next = outline.status === 'planned' ? 'drafted' : outline.status === 'drafted' ? 'done' : 'planned';
    updateOutline(episode, { status: next });
  };

  const doneCount = outlines.filter(o => o.status === 'done').length;
  const draftCount = outlines.filter(o => o.status === 'drafted').length;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-10 space-y-8 animate-in fade-in duration-700 pb-32">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">{t.title}</h2>
          <p className="text-zinc-600 text-[10px] font-bold tracking-widest uppercase">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-black">
          <span className="text-green-400">{doneCount}/{totalEps} {t.done}</span>
          <span className="text-yellow-400">{draftCount} {t.drafts}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-zinc-900 rounded-full overflow-hidden flex">
        <div className="bg-green-500 transition-all" style={{ width: `${(doneCount / totalEps) * 100}%` }} />
        <div className="bg-yellow-500 transition-all" style={{ width: `${(draftCount / totalEps) * 100}%` }} />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {outlines.map(outline => {
          const isCurrent = outline.episode === config.episode;
          const isEditing = editingEp === outline.episode;
          const statusColor = STATUS_COLORS[outline.status];

          return (
            <div
              key={outline.episode}
              className={`relative p-3 rounded-xl border transition-all cursor-pointer group ${
                isCurrent
                  ? 'bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20'
                  : `bg-zinc-900/30 ${statusColor.split(' ')[0]} hover:border-zinc-600`
              }`}
              onClick={() => {
                if (!isEditing && onNavigateToEpisode) onNavigateToEpisode(outline.episode);
              }}
            >
              {/* Episode number + status */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black ${isCurrent ? 'text-blue-400' : 'text-zinc-600'}`}>
                  EP.{outline.episode}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); cycleStatus(outline.episode); }}
                  className={`text-[7px] font-black px-1.5 py-0.5 rounded border ${statusColor}`}
                >
                  {STATUS_LABELS[outline.status][language]}
                </button>
              </div>

              {/* Title */}
              {isEditing ? (
                <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
                  <input
                    className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-[10px] outline-none focus:border-blue-600"
                    placeholder={t.titlePlaceholder}
                    value={outline.title}
                    onChange={e => updateOutline(outline.episode, { title: e.target.value })}
                    autoFocus
                  />
                  <textarea
                    className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-[9px] outline-none focus:border-blue-600 resize-none h-16"
                    placeholder={t.summaryPlaceholder}
                    value={outline.summary}
                    onChange={e => updateOutline(outline.episode, { summary: e.target.value })}
                  />
                  <button onClick={() => setEditingEp(null)} className="w-full flex items-center justify-center gap-1 py-1 bg-blue-600 rounded text-[8px] font-black text-white">
                    <Check className="w-3 h-3" /> {t.save}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-bold text-zinc-300 truncate mb-1">
                    {outline.title || <span className="text-zinc-700 italic">{t.noTitle}</span>}
                  </p>
                  <p className="text-[8px] text-zinc-600 line-clamp-2 leading-relaxed">
                    {outline.summary || ''}
                  </p>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingEp(outline.episode); }}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 text-zinc-700 hover:text-zinc-300 transition-all"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OutlineBoard;
