
import React, { useState } from 'react';
import { StoryConfig, AppLanguage, SetConfigFn } from '../types';
import { TRANSLATIONS } from '../constants';
import { generateBrainstorm } from '../services/aiService';
import { Lightbulb, Loader2, Zap, Users, Map, Shuffle, Plus, Trash2, Copy } from 'lucide-react';

interface BrainstormViewProps {
  language: AppLanguage;
  config: StoryConfig;
}

type BrainstormCategory = 'plot' | 'character' | 'worldbuilding' | 'whatif';

const CATEGORIES: Array<{ key: BrainstormCategory; icon: React.ElementType; label: Record<AppLanguage, string>; prompt: Record<AppLanguage, string> }> = [
  {
    key: 'plot', icon: Zap,
    label: { KO: '플롯 아이디어', EN: 'Plot Ideas', JP: 'プロットアイデア', CN: '剧情创意' },
    prompt: { KO: '다음 전개 방향 아이디어 5개를 제안해줘', EN: 'Suggest 5 ideas for the next plot development', JP: '次の展開アイデアを5つ提案して', CN: '建议5个下一步剧情发展的创意' },
  },
  {
    key: 'character', icon: Users,
    label: { KO: '캐릭터 발전', EN: 'Character Arcs', JP: 'キャラ発展', CN: '角色发展' },
    prompt: { KO: '캐릭터 갈등/성장 아이디어 5개', EN: '5 character conflict/growth ideas', JP: 'キャラクターの葛藤/成長アイデアを5つ', CN: '5个角色冲突/成长创意' },
  },
  {
    key: 'worldbuilding', icon: Map,
    label: { KO: '세계관 확장', EN: 'World Expansion', JP: '世界観拡張', CN: '世界观扩展' },
    prompt: { KO: '세계관을 깊게 만들 설정 아이디어 5개', EN: '5 worldbuilding details to deepen the setting', JP: '世界観を深める設定アイデアを5つ', CN: '5个深化世界观的设定创意' },
  },
  {
    key: 'whatif', icon: Shuffle,
    label: { KO: 'What If?', EN: 'What If?', JP: 'もしも？', CN: '如果？' },
    prompt: { KO: '예상을 뒤집는 What If 시나리오 5개', EN: '5 unexpected What If scenarios', JP: '予想を覆すWhat Ifシナリオを5つ', CN: '5个出人意料的假设情景' },
  },
];

interface BrainstormIdea {
  id: string;
  category: BrainstormCategory;
  content: string;
  saved: boolean;
}

const BrainstormView: React.FC<BrainstormViewProps> = ({ language, config }) => {
  const t = TRANSLATIONS[language].brainstorm;
  const [ideas, setIdeas] = useState<BrainstormIdea[]>([]);
  const [loading, setLoading] = useState<BrainstormCategory | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const handleGenerate = async (category: BrainstormCategory, prompt?: string) => {
    if (loading) return;
    setLoading(category);
    try {
      const cat = CATEGORIES.find(c => c.key === category)!;
      const results = await generateBrainstorm(config, prompt || cat.prompt[language], language);
      const newIdeas: BrainstormIdea[] = results.map((content: string) => ({
        id: `idea-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        content,
        saved: false,
      }));
      setIdeas(prev => [...newIdeas, ...prev]);
    } catch (err) {
      console.error('Brainstorm failed:', err);
    } finally {
      setLoading(null);
    }
  };

  const toggleSave = (id: string) => {
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, saved: !i.saved } : i));
  };

  const removeIdea = (id: string) => {
    setIdeas(prev => prev.filter(i => i.id !== id));
  };

  const copyIdea = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-10 space-y-8 animate-in fade-in duration-700 pb-32">
      <div>
        <h2 className="text-2xl md:text-3xl font-black tracking-tighter uppercase">{t.title}</h2>
        <p className="text-zinc-600 text-[10px] font-bold tracking-widest uppercase">{t.subtitle}</p>
      </div>

      {/* Category buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CATEGORIES.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => handleGenerate(key)}
            disabled={!!loading}
            className={`flex items-center justify-center gap-2 py-4 px-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              loading === key
                ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                : 'bg-zinc-900/30 border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600'
            } disabled:opacity-50`}
          >
            {loading === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
            {label[language]}
          </button>
        ))}
      </div>

      {/* Custom prompt */}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-blue-600 outline-none"
          placeholder={t.customPlaceholder}
          value={customPrompt}
          onChange={e => setCustomPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && customPrompt.trim()) handleGenerate('plot', customPrompt); }}
        />
        <button
          onClick={() => { if (customPrompt.trim()) handleGenerate('plot', customPrompt); }}
          disabled={!!loading || !customPrompt.trim()}
          className="px-4 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 disabled:opacity-30 transition-all"
        >
          <Lightbulb className="w-4 h-4" />
        </button>
      </div>

      {/* Ideas list */}
      <div className="space-y-3">
        {ideas.map(idea => {
          const cat = CATEGORIES.find(c => c.key === idea.category);
          const Icon = cat?.icon || Lightbulb;
          return (
            <div
              key={idea.id}
              className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                idea.saved ? 'bg-blue-600/5 border-blue-500/20' : 'bg-zinc-900/20 border-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
              <p className="flex-1 text-sm text-zinc-300 leading-relaxed">{idea.content}</p>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => copyIdea(idea.content)} className="p-1.5 text-zinc-700 hover:text-zinc-300 transition-colors">
                  <Copy className="w-3 h-3" />
                </button>
                <button onClick={() => toggleSave(idea.id)}
                  className={`p-1.5 transition-colors ${idea.saved ? 'text-blue-400' : 'text-zinc-700 hover:text-blue-400'}`}>
                  <Plus className="w-3 h-3" />
                </button>
                <button onClick={() => removeIdea(idea.id)} className="p-1.5 text-zinc-700 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
        {ideas.length === 0 && (
          <div className="text-center py-16 text-zinc-700 text-sm">{t.empty}</div>
        )}
      </div>
    </div>
  );
};

export default BrainstormView;
