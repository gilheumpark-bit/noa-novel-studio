
import React, { useState } from 'react';
import { Character, StoryConfig, AppLanguage, SetConfigFn } from '../types';
import { TRANSLATIONS } from '../constants';
import { Users, Plus, Trash2, ArrowRight } from 'lucide-react';

interface RelationshipMapProps {
  language: AppLanguage;
  config: StoryConfig;
  setConfig: SetConfigFn;
}

export interface CharacterRelation {
  id: string;
  from: string;
  to: string;
  type: string;
  description: string;
}

const RELATION_TYPES: Record<string, { label: Record<AppLanguage, string>; color: string }> = {
  ally: { label: { KO: '우호', EN: 'Ally', JP: '友好', CN: '友好' }, color: 'text-green-400 border-green-500/30' },
  rival: { label: { KO: '라이벌', EN: 'Rival', JP: 'ライバル', CN: '对手' }, color: 'text-orange-400 border-orange-500/30' },
  enemy: { label: { KO: '적대', EN: 'Enemy', JP: '敵対', CN: '敌对' }, color: 'text-red-400 border-red-500/30' },
  love: { label: { KO: '연인', EN: 'Love', JP: '恋人', CN: '恋人' }, color: 'text-pink-400 border-pink-500/30' },
  family: { label: { KO: '가족', EN: 'Family', JP: '家族', CN: '家人' }, color: 'text-blue-400 border-blue-500/30' },
  mentor: { label: { KO: '사제', EN: 'Mentor', JP: '師弟', CN: '师徒' }, color: 'text-purple-400 border-purple-500/30' },
  unknown: { label: { KO: '미상', EN: 'Unknown', JP: '不明', CN: '未知' }, color: 'text-zinc-400 border-zinc-500/30' },
};

const RelationshipMap: React.FC<RelationshipMapProps> = ({ language, config, setConfig }) => {
  const t = TRANSLATIONS[language].relationship;
  const [relations, setRelations] = useState<CharacterRelation[]>([]);
  const [formResetKey, setFormResetKey] = useState(0);

  const characters = config.characters;
  const isKO = language === 'KO';

  const addRelation = () => {
    const fromEl = document.getElementById('rel-from') as HTMLSelectElement;
    const toEl = document.getElementById('rel-to') as HTMLSelectElement;
    const typeEl = document.getElementById('rel-type') as HTMLSelectElement;
    const descEl = document.getElementById('rel-desc') as HTMLInputElement;
    if (!fromEl?.value || !toEl?.value || fromEl.value === toEl.value) return;
    const newRel: CharacterRelation = {
      id: `rel-${Date.now()}`,
      from: fromEl.value,
      to: toEl.value,
      type: typeEl?.value || 'unknown',
      description: descEl?.value || '',
    };
    setRelations(prev => [...prev, newRel]);
    setFormResetKey(k => k + 1);
  };

  const removeRelation = (id: string) => {
    setRelations(prev => prev.filter(r => r.id !== id));
  };

  // Build adjacency for visual layout
  const characterNames = characters.map(c => c.name);
  const angleStep = characterNames.length > 0 ? (2 * Math.PI) / characterNames.length : 0;
  const radius = 120;
  const cx = 160, cy = 160;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-zinc-600" />
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t.title}</span>
      </div>

      {/* Visual Map (SVG) */}
      {characters.length >= 2 && (
        <div className="flex justify-center">
          <svg width="320" height="320" className="overflow-visible">
            {/* Relation lines */}
            {relations.map(rel => {
              const fromIdx = characterNames.indexOf(rel.from);
              const toIdx = characterNames.indexOf(rel.to);
              if (fromIdx < 0 || toIdx < 0) return null;
              const x1 = cx + radius * Math.cos(angleStep * fromIdx - Math.PI / 2);
              const y1 = cy + radius * Math.sin(angleStep * fromIdx - Math.PI / 2);
              const x2 = cx + radius * Math.cos(angleStep * toIdx - Math.PI / 2);
              const y2 = cy + radius * Math.sin(angleStep * toIdx - Math.PI / 2);
              const rt = RELATION_TYPES[rel.type] || RELATION_TYPES.unknown;
              const colorHex = rel.type === 'ally' ? '#4ade80' : rel.type === 'enemy' ? '#f87171' :
                rel.type === 'love' ? '#f472b6' : rel.type === 'rival' ? '#fb923c' :
                rel.type === 'family' ? '#60a5fa' : rel.type === 'mentor' ? '#a78bfa' : '#71717a';
              return (
                <g key={rel.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colorHex} strokeWidth="1.5" opacity="0.5" />
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} fill={colorHex} fontSize="8" fontWeight="bold" textAnchor="middle">
                    {rt.label[language]}
                  </text>
                </g>
              );
            })}
            {/* Character nodes */}
            {characterNames.map((name, i) => {
              const x = cx + radius * Math.cos(angleStep * i - Math.PI / 2);
              const y = cy + radius * Math.sin(angleStep * i - Math.PI / 2);
              return (
                <g key={name}>
                  <circle cx={x} cy={y} r="24" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
                  <text x={x} y={y + 1} fill="#e4e4e7" fontSize="9" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">
                    {name.length > 4 ? name.slice(0, 4) + '..' : name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Relation list */}
      <div className="space-y-2">
        {relations.map(rel => {
          const rt = RELATION_TYPES[rel.type] || RELATION_TYPES.unknown;
          return (
            <div key={rel.id} className={`flex items-center gap-2 bg-black/40 rounded-lg p-3 border ${rt.color.split(' ')[1]}`}>
              <span className="text-[10px] font-black text-zinc-300">{rel.from}</span>
              <ArrowRight className="w-3 h-3 text-zinc-600" />
              <span className="text-[10px] font-black text-zinc-300">{rel.to}</span>
              <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${rt.color}`}>
                {rt.label[language]}
              </span>
              {rel.description && <span className="text-[9px] text-zinc-600 flex-1 truncate">{rel.description}</span>}
              <button onClick={() => removeRelation(rel.id)} className="p-1 text-zinc-700 hover:text-red-500">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add relation form */}
      {characters.length >= 2 && (
        <div key={`rel-form-${formResetKey}`} className="flex flex-wrap gap-2 items-end">
          <select id="rel-from" className="w-28 bg-black border border-zinc-800 rounded-lg p-2.5 text-xs outline-none">
            {characters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <ArrowRight className="w-4 h-4 text-zinc-600 self-center" />
          <select id="rel-to" className="w-28 bg-black border border-zinc-800 rounded-lg p-2.5 text-xs outline-none">
            {characters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select id="rel-type" className="w-24 bg-black border border-zinc-800 rounded-lg p-2.5 text-xs outline-none">
            {Object.entries(RELATION_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label[language]}</option>
            ))}
          </select>
          <input id="rel-desc" className="flex-1 min-w-[100px] bg-black border border-zinc-800 rounded-lg p-2.5 text-xs outline-none"
            placeholder={t.descPlaceholder} />
          <button onClick={addRelation} className="px-3 py-2.5 bg-blue-600 text-white rounded-lg text-[10px] font-black hover:bg-blue-500 transition-all">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {characters.length < 2 && (
        <p className="text-[10px] text-zinc-700 text-center py-6">{t.needCharacters}</p>
      )}
    </div>
  );
};

export default RelationshipMap;
