
import React, { useState, useMemo } from 'react';
import { StoryConfig, AppLanguage, SetConfigFn } from '../types';
import { Globe, ChevronDown, ChevronRight, Sparkles, ArrowRight, Clock, MapPin, Shuffle, Plus, Trash2, X } from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface EraSlot {
  id: string;
  realCivilization: string;
  userEquivalent: string;
  traits: string[];
  notes: string;
}

interface Era {
  id: string;
  name: Record<AppLanguage, string>;
  period: Record<AppLanguage, string>;
  color: string;
  icon: string;
  realCivilizations: string[];
  slots: EraSlot[];
}

interface WorldEvent {
  era: string;
  title: string;
  description: string;
  factions: string[];
}

// ============================================================
// Constants
// ============================================================

const TRANSLATIONS: Record<AppLanguage, {
  title: string;
  subtitle: string;
  eraLabel: string;
  realWorld: string;
  yourWorld: string;
  traits: string;
  notes: string;
  notesPlaceholder: string;
  addSlot: string;
  generate: string;
  generating: string;
  timeline: string;
  events: string;
  noEvents: string;
  mapCiv: string;
  traitsPlaceholder: string;
  autoMap: string;
  clearAll: string;
  timelineView: string;
  mappingView: string;
  eventsView: string;
  tip: string;
  tipText: string;
}> = {
  KO: {
    title: '세계관 시뮬레이터',
    subtitle: 'WORLD CIVILIZATION SIMULATOR',
    eraLabel: '시대',
    realWorld: '지구 문명',
    yourWorld: '내 세계관',
    traits: '특성',
    notes: '메모',
    notesPlaceholder: '이 문명의 특징, 정치 체제, 핵심 갈등...',
    addSlot: '문명 추가',
    generate: 'AI 역사 이벤트 생성',
    generating: '생성 중...',
    timeline: '타임라인',
    events: '역사 이벤트',
    noEvents: '매핑을 완성하고 AI 이벤트를 생성해보세요',
    mapCiv: '치환할 문명명 입력',
    traitsPlaceholder: '특성 추가 (Enter)',
    autoMap: '세계관에서 자동 매핑',
    clearAll: '초기화',
    timelineView: '타임라인',
    mappingView: '매핑',
    eventsView: '이벤트',
    tip: '💡 팁',
    tipText: '지구 문명을 내 세계관으로 치환하면, 역사적 구조를 참고한 세계관 설계가 가능합니다.',
  },
  EN: {
    title: 'World Simulator',
    subtitle: 'WORLD CIVILIZATION SIMULATOR',
    eraLabel: 'Era',
    realWorld: 'Earth Civilization',
    yourWorld: 'Your World',
    traits: 'Traits',
    notes: 'Notes',
    notesPlaceholder: 'Key characteristics, political system, core conflicts...',
    addSlot: 'Add Civilization',
    generate: 'AI Generate Events',
    generating: 'Generating...',
    timeline: 'Timeline',
    events: 'History Events',
    noEvents: 'Complete mappings and generate AI events',
    mapCiv: 'Enter your world equivalent',
    traitsPlaceholder: 'Add trait (Enter)',
    autoMap: 'Auto-map from worldbuilding',
    clearAll: 'Reset',
    timelineView: 'Timeline',
    mappingView: 'Mapping',
    eventsView: 'Events',
    tip: '💡 Tip',
    tipText: 'Map Earth civilizations to your world to design historically-grounded worldbuilding.',
  },
  JP: {
    title: '世界観シミュレーター',
    subtitle: 'WORLD CIVILIZATION SIMULATOR',
    eraLabel: '時代',
    realWorld: '地球の文明',
    yourWorld: 'あなたの世界',
    traits: '特性',
    notes: 'メモ',
    notesPlaceholder: 'この文明の特徴、政治体制、核心的な葛藤...',
    addSlot: '文明を追加',
    generate: 'AIイベント生成',
    generating: '生成中...',
    timeline: 'タイムライン',
    events: '歴史イベント',
    noEvents: 'マッピングを完成してAIイベントを生成してください',
    mapCiv: '世界観の文明名を入力',
    traitsPlaceholder: '特性を追加 (Enter)',
    autoMap: '世界観から自動マッピング',
    clearAll: 'リセット',
    timelineView: 'タイムライン',
    mappingView: 'マッピング',
    eventsView: 'イベント',
    tip: '💡 ヒント',
    tipText: '地球の文明をあなたの世界に置き換えて、歴史的な構造を参考にした世界観設計ができます。',
  },
  CN: {
    title: '世界观模拟器',
    subtitle: 'WORLD CIVILIZATION SIMULATOR',
    eraLabel: '时代',
    realWorld: '地球文明',
    yourWorld: '你的世界',
    traits: '特性',
    notes: '备注',
    notesPlaceholder: '这个文明的特征、政治体制、核心冲突...',
    addSlot: '添加文明',
    generate: 'AI生成事件',
    generating: '生成中...',
    timeline: '时间线',
    events: '历史事件',
    noEvents: '完成映射后生成AI事件',
    mapCiv: '输入对应的世界观文明',
    traitsPlaceholder: '添加特性 (Enter)',
    autoMap: '从世界观自动映射',
    clearAll: '重置',
    timelineView: '时间线',
    mappingView: '映射',
    eventsView: '事件',
    tip: '💡 提示',
    tipText: '将地球文明映射到你的世界，设计有历史依据的世界观。',
  },
};

const DEFAULT_ERAS: Era[] = [
  {
    id: 'ancient',
    name: { KO: '고대', EN: 'Ancient', JP: '古代', CN: '古代' },
    period: { KO: 'BC 3000 ~ AD 476', EN: 'BC 3000 ~ AD 476', JP: 'BC 3000 ~ AD 476', CN: 'BC 3000 ~ AD 476' },
    color: 'amber',
    icon: '🏛️',
    realCivilizations: ['이집트', '그리스', '로마', '페르시아', '중국(한)', '인도(마우리아)'],
    slots: [],
  },
  {
    id: 'medieval',
    name: { KO: '중세', EN: 'Medieval', JP: '中世', CN: '中世纪' },
    period: { KO: 'AD 476 ~ 1453', EN: 'AD 476 ~ 1453', JP: 'AD 476 ~ 1453', CN: 'AD 476 ~ 1453' },
    color: 'stone',
    icon: '⚔️',
    realCivilizations: ['비잔틴', '프랑크 왕국', '아랍 제국', '바이킹', '고려/조선', '몽골 제국'],
    slots: [],
  },
  {
    id: 'renaissance',
    name: { KO: '르네상스', EN: 'Renaissance', JP: 'ルネサンス', CN: '文艺复兴' },
    period: { KO: '1300 ~ 1600', EN: '1300 ~ 1600', JP: '1300 ~ 1600', CN: '1300 ~ 1600' },
    color: 'purple',
    icon: '🎨',
    realCivilizations: ['이탈리아 도시국가', '오스만 제국', '명나라', '스페인 왕국', '포르투갈', '잉카 제국'],
    slots: [],
  },
  {
    id: 'industrial',
    name: { KO: '산업혁명', EN: 'Industrial', JP: '産業革命', CN: '工业革命' },
    period: { KO: '1760 ~ 1840', EN: '1760 ~ 1840', JP: '1760 ~ 1840', CN: '1760 ~ 1840' },
    color: 'orange',
    icon: '🏭',
    realCivilizations: ['대영제국', '프랑스', '프로이센', '미국', '청나라', '메이지 일본'],
    slots: [],
  },
  {
    id: 'modern',
    name: { KO: '현대', EN: 'Modern', JP: '現代', CN: '现代' },
    period: { KO: '1900 ~ 2000', EN: '1900 ~ 2000', JP: '1900 ~ 2000', CN: '1900 ~ 2000' },
    color: 'blue',
    icon: '🌐',
    realCivilizations: ['미국', '소련', 'EU', '중국', '일본', '한국'],
    slots: [],
  },
  {
    id: 'future',
    name: { KO: '미래', EN: 'Future', JP: '未来', CN: '未来' },
    period: { KO: '2100+', EN: '2100+', JP: '2100+', CN: '2100+' },
    color: 'cyan',
    icon: '🚀',
    realCivilizations: ['지구 연합', '화성 식민지', 'AI 자치구', '우주 유목민', '심해 도시', '가상국가'],
    slots: [],
  },
];

const ERA_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-500' },
  stone: { bg: 'bg-stone-500/10', border: 'border-stone-500/30', text: 'text-stone-400', dot: 'bg-stone-500' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-500' },
  orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-500' },
  blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-500' },
  cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', dot: 'bg-cyan-500' },
};

// ============================================================
// Component
// ============================================================

interface WorldSimulatorProps {
  language: AppLanguage;
  config: StoryConfig;
  setConfig: SetConfigFn;
  onGenerateEvents?: (prompt: string) => Promise<string[]>;
}

const WorldSimulator: React.FC<WorldSimulatorProps> = ({ language, config, setConfig, onGenerateEvents }) => {
  const t = TRANSLATIONS[language];
  const [eras, setEras] = useState<Era[]>(() =>
    DEFAULT_ERAS.map(era => ({
      ...era,
      slots: era.realCivilizations.map((civ, i) => ({
        id: `${era.id}-${i}`,
        realCivilization: civ,
        userEquivalent: '',
        traits: [],
        notes: '',
      })),
    }))
  );
  const [expandedEra, setExpandedEra] = useState<string | null>('ancient');
  const [activeView, setActiveView] = useState<'mapping' | 'timeline' | 'events'>('mapping');
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [traitInput, setTraitInput] = useState<Record<string, string>>({});

  const mappedCount = useMemo(() =>
    eras.reduce((sum, era) => sum + era.slots.filter(s => s.userEquivalent.trim()).length, 0),
    [eras]
  );

  const totalSlots = useMemo(() =>
    eras.reduce((sum, era) => sum + era.slots.length, 0),
    [eras]
  );

  const updateSlot = (eraId: string, slotId: string, updates: Partial<EraSlot>) => {
    setEras(prev => prev.map(era =>
      era.id === eraId
        ? { ...era, slots: era.slots.map(s => s.id === slotId ? { ...s, ...updates } : s) }
        : era
    ));
  };

  const addSlot = (eraId: string) => {
    setEras(prev => prev.map(era =>
      era.id === eraId
        ? {
            ...era,
            slots: [...era.slots, {
              id: `${eraId}-${Date.now()}`,
              realCivilization: '',
              userEquivalent: '',
              traits: [],
              notes: '',
            }],
          }
        : era
    ));
  };

  const removeSlot = (eraId: string, slotId: string) => {
    setEras(prev => prev.map(era =>
      era.id === eraId
        ? { ...era, slots: era.slots.filter(s => s.id !== slotId) }
        : era
    ));
  };

  const addTrait = (eraId: string, slotId: string, trait: string) => {
    if (!trait.trim()) return;
    setEras(prev => prev.map(era =>
      era.id === eraId
        ? {
            ...era,
            slots: era.slots.map(s =>
              s.id === slotId ? { ...s, traits: [...s.traits, trait.trim()] } : s
            ),
          }
        : era
    ));
    setTraitInput(prev => ({ ...prev, [slotId]: '' }));
  };

  const removeTrait = (eraId: string, slotId: string, traitIndex: number) => {
    setEras(prev => prev.map(era =>
      era.id === eraId
        ? {
            ...era,
            slots: era.slots.map(s =>
              s.id === slotId ? { ...s, traits: s.traits.filter((_, i) => i !== traitIndex) } : s
            ),
          }
        : era
    ));
  };

  const autoMapFromConfig = () => {
    const worldFacts = config.worldFacts ?? [];
    const worldRules = config.worldRules ?? [];
    const characters = config.characters ?? [];
    const setting = config.setting ?? '';

    // Auto-fill first unmapped slot in each era with relevant world info
    setEras(prev => prev.map((era, eraIdx) => {
      const newSlots = [...era.slots];
      const unmappedIdx = newSlots.findIndex(s => !s.userEquivalent.trim());
      if (unmappedIdx >= 0 && setting) {
        const factionHint = characters.length > 0
          ? characters[Math.min(eraIdx, characters.length - 1)].name + '의 세력'
          : setting;
        newSlots[unmappedIdx] = {
          ...newSlots[unmappedIdx],
          userEquivalent: factionHint,
          traits: worldRules
            .filter(r => r.category === (eraIdx < 2 ? 'society' : eraIdx < 4 ? 'technology' : 'physics'))
            .slice(0, 2)
            .map(r => r.description),
        };
      }
      return { ...era, slots: newSlots };
    }));
  };

  const handleGenerateEvents = async () => {
    if (!onGenerateEvents) return;
    setIsGenerating(true);
    try {
      const mappings = eras.flatMap(era =>
        era.slots
          .filter(s => s.userEquivalent.trim())
          .map(s => `[${era.name[language]}] ${s.realCivilization} → ${s.userEquivalent} (${s.traits.join(', ')})`)
      );

      const prompt = `Based on these civilization mappings from Earth history to a fictional world, generate 6 major historical events that would have happened in this fictional world. Each event should reference the mapped civilizations.

Mappings:
${mappings.join('\n')}

World setting: ${config.setting || 'Fantasy world'}
Genre: ${config.genre}

Return a JSON array of objects with: era (era id), title (event name), description (2-3 sentences), factions (array of faction names involved).
Era IDs: ancient, medieval, renaissance, industrial, modern, future`;

      const results = await onGenerateEvents(prompt);
      if (Array.isArray(results)) {
        setEvents(results as unknown as WorldEvent[]);
        setActiveView('events');
      }
    } catch (error) {
      console.error('Event generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // ============================================================
  // Render: Mapping View
  // ============================================================
  const renderMappingView = () => (
    <div className="space-y-3">
      {eras.map(era => {
        const colors = ERA_COLORS[era.color];
        const isExpanded = expandedEra === era.id;
        const mapped = era.slots.filter(s => s.userEquivalent.trim()).length;

        return (
          <div key={era.id} className={`rounded-xl border ${colors.border} overflow-hidden transition-all`}>
            {/* Era header */}
            <button
              onClick={() => setExpandedEra(isExpanded ? null : era.id)}
              className={`w-full flex items-center justify-between p-4 ${colors.bg} transition-all`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{era.icon}</span>
                <div className="text-left">
                  <div className={`text-sm font-black ${colors.text}`}>{era.name[language]}</div>
                  <div className="text-[9px] text-zinc-600 font-bold">{era.period[language]}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-zinc-600">
                  {mapped}/{era.slots.length}
                </span>
                {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />}
              </div>
            </button>

            {/* Slots */}
            {isExpanded && (
              <div className="p-4 space-y-3 bg-black/20">
                {era.slots.map(slot => (
                  <div key={slot.id} className="flex gap-3 items-start group">
                    {/* Real civilization */}
                    <div className="w-32 shrink-0">
                      <input
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-[10px] font-bold text-zinc-400 outline-none focus:border-zinc-600"
                        value={slot.realCivilization}
                        onChange={e => updateSlot(era.id, slot.id, { realCivilization: e.target.value })}
                        placeholder={t.realWorld}
                      />
                    </div>

                    {/* Arrow */}
                    <ArrowRight className={`w-4 h-4 mt-2 shrink-0 ${slot.userEquivalent ? colors.text : 'text-zinc-800'}`} />

                    {/* User's world equivalent */}
                    <div className="flex-1 space-y-2">
                      <input
                        className={`w-full bg-zinc-900 border rounded-lg px-3 py-2 text-[10px] font-black outline-none transition-all ${
                          slot.userEquivalent
                            ? `${colors.border} ${colors.text}`
                            : 'border-zinc-800 text-zinc-600'
                        } focus:border-blue-600`}
                        value={slot.userEquivalent}
                        onChange={e => updateSlot(era.id, slot.id, { userEquivalent: e.target.value })}
                        placeholder={t.mapCiv}
                      />

                      {/* Traits */}
                      {slot.userEquivalent && (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {slot.traits.map((trait, ti) => (
                            <span
                              key={ti}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold ${colors.bg} ${colors.text} border ${colors.border}`}
                            >
                              {trait}
                              <button onClick={() => removeTrait(era.id, slot.id, ti)} className="hover:text-red-400">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                          <input
                            className="bg-transparent text-[8px] text-zinc-600 outline-none w-20"
                            placeholder={t.traitsPlaceholder}
                            value={traitInput[slot.id] ?? ''}
                            onChange={e => setTraitInput(prev => ({ ...prev, [slot.id]: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                addTrait(era.id, slot.id, traitInput[slot.id] ?? '');
                              }
                            }}
                          />
                        </div>
                      )}

                      {/* Notes */}
                      {slot.userEquivalent && (
                        <textarea
                          className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-1.5 text-[9px] text-zinc-500 outline-none resize-none h-10 focus:border-zinc-600"
                          value={slot.notes}
                          onChange={e => updateSlot(era.id, slot.id, { notes: e.target.value })}
                          placeholder={t.notesPlaceholder}
                        />
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => removeSlot(era.id, slot.id)}
                      className="mt-2 p-1 text-zinc-800 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addSlot(era.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed ${colors.border} text-[9px] font-bold ${colors.text} opacity-50 hover:opacity-100 transition-all`}
                >
                  <Plus className="w-3 h-3" /> {t.addSlot}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ============================================================
  // Render: Timeline View
  // ============================================================
  const renderTimelineView = () => {
    const mappedEras = eras.filter(era => era.slots.some(s => s.userEquivalent.trim()));

    return (
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-px bg-zinc-800" />

        <div className="space-y-6">
          {(mappedEras.length > 0 ? mappedEras : eras).map(era => {
            const colors = ERA_COLORS[era.color];
            const mapped = era.slots.filter(s => s.userEquivalent.trim());

            return (
              <div key={era.id} className="relative pl-14">
                {/* Dot on timeline */}
                <div className={`absolute left-4.5 top-2 w-3.5 h-3.5 rounded-full ${colors.dot} ring-4 ring-black`} />

                <div className={`p-4 rounded-xl border ${colors.border} ${colors.bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{era.icon}</span>
                    <span className={`text-sm font-black ${colors.text}`}>{era.name[language]}</span>
                    <span className="text-[8px] text-zinc-600 font-bold">{era.period[language]}</span>
                  </div>

                  {mapped.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {mapped.map(slot => (
                        <div key={slot.id} className="bg-black/30 rounded-lg p-2.5">
                          <div className={`text-[10px] font-black ${colors.text}`}>{slot.userEquivalent}</div>
                          <div className="text-[8px] text-zinc-600 mt-0.5">← {slot.realCivilization}</div>
                          {slot.traits.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {slot.traits.map((trait, i) => (
                                <span key={i} className={`px-1.5 py-0.5 rounded text-[7px] font-bold ${colors.bg} ${colors.text}`}>
                                  {trait}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[9px] text-zinc-700 italic">— {t.noEvents} —</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================================
  // Render: Events View
  // ============================================================
  const renderEventsView = () => (
    <div className="space-y-4">
      {events.length === 0 ? (
        <div className="text-center py-16">
          <Clock className="w-10 h-10 text-zinc-800 mx-auto mb-4" />
          <p className="text-zinc-600 text-xs font-bold">{t.noEvents}</p>
        </div>
      ) : (
        events.map((event, i) => {
          const era = eras.find(e => e.id === event.era);
          const colors = era ? ERA_COLORS[era.color] : ERA_COLORS.blue;
          return (
            <div key={i} className={`p-4 rounded-xl border ${colors.border} ${colors.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                {era && <span className="text-lg">{era.icon}</span>}
                <span className={`text-[10px] font-black uppercase ${colors.text}`}>
                  {era?.name[language] ?? event.era}
                </span>
              </div>
              <h4 className="text-sm font-black text-zinc-200 mb-1">{event.title}</h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed mb-2">{event.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {event.factions?.map((f, fi) => (
                  <span key={fi} className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  // ============================================================
  // Main Render
  // ============================================================
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 md:p-10 space-y-8 animate-in fade-in duration-700 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter">{t.title}</h2>
          <p className="text-zinc-600 text-[10px] font-bold tracking-widest uppercase">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black">
          <MapPin className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-blue-400">{mappedCount}/{totalSlots}</span>
        </div>
      </div>

      {/* Tip */}
      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
        <p className="text-[9px] text-blue-400/70 leading-relaxed">
          <span className="font-black">{t.tip}</span> {t.tipText}
        </p>
      </div>

      {/* View tabs + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {([
            { key: 'mapping' as const, label: t.mappingView },
            { key: 'timeline' as const, label: t.timelineView },
            { key: 'events' as const, label: t.eventsView },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                activeView === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-900 text-zinc-600 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={autoMapFromConfig}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[9px] font-bold text-zinc-500 hover:text-zinc-300 transition-all"
          >
            <Shuffle className="w-3 h-3" /> {t.autoMap}
          </button>
          {onGenerateEvents && (
            <button
              onClick={handleGenerateEvents}
              disabled={isGenerating || mappedCount === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-[9px] font-black text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <Sparkles className="w-3 h-3" />
              {isGenerating ? t.generating : t.generate}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {activeView === 'mapping' && renderMappingView()}
      {activeView === 'timeline' && renderTimelineView()}
      {activeView === 'events' && renderEventsView()}
    </div>
  );
};

export default WorldSimulator;
