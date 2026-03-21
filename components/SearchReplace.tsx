
import React, { useState, useCallback } from 'react';
import { Search, Replace, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AppLanguage, Message } from '../types';

interface SearchReplaceProps {
  language: AppLanguage;
  messages: Message[];
  onUpdateMessage: (messageId: string, newContent: string) => void;
  onClose: () => void;
}

const SearchReplace: React.FC<SearchReplaceProps> = ({ language, messages, onUpdateMessage, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [results, setResults] = useState<Array<{ messageId: string; count: number }>>([]);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const isKO = language === 'KO';

  const doSearch = useCallback((term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    const found: Array<{ messageId: string; count: number }> = [];
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      const matches = msg.content.match(regex);
      if (matches && matches.length > 0) {
        found.push({ messageId: msg.id, count: matches.length });
      }
    }
    setResults(found);
  }, [messages, caseSensitive]);

  const handleSearch = () => doSearch(searchTerm);

  const handleReplaceAll = () => {
    if (!searchTerm.trim()) return;
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      if (regex.test(msg.content)) {
        const newContent = msg.content.replace(regex, replaceTerm);
        onUpdateMessage(msg.id, newContent);
      }
    }
    setResults([]);
  };

  const totalCount = results.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="bg-zinc-900/95 border border-zinc-700 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top duration-300 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
          <Search className="w-3.5 h-3.5" /> {isKO ? '검색/치환' : 'Search / Replace'}
        </span>
        <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-2">
          <Search className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder={isKO ? '검색어...' : 'Find...'}
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); doSearch(e.target.value); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button
          onClick={() => setCaseSensitive(!caseSensitive)}
          className={`px-2 py-1 rounded-lg text-[9px] font-black border transition-all ${
            caseSensitive ? 'border-blue-500 text-blue-400 bg-blue-500/10' : 'border-zinc-800 text-zinc-600'
          }`}
          title={isKO ? '대소문자 구분' : 'Case sensitive'}
        >
          Aa
        </button>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-black border border-zinc-800 rounded-xl px-3 py-2">
          <Replace className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm outline-none"
            placeholder={isKO ? '치환어...' : 'Replace with...'}
            value={replaceTerm}
            onChange={e => setReplaceTerm(e.target.value)}
          />
        </div>
        <button
          onClick={handleReplaceAll}
          disabled={!searchTerm.trim() || totalCount === 0}
          className="px-3 py-1 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-blue-500 transition-all disabled:opacity-30"
        >
          {isKO ? '전체 치환' : 'Replace All'}
        </button>
      </div>

      {searchTerm.trim() && (
        <div className="text-[10px] text-zinc-600">
          {totalCount > 0
            ? `${results.length}${isKO ? '개 메시지에서' : ' messages,'} ${totalCount}${isKO ? '건 발견' : ' found'}`
            : isKO ? '결과 없음' : 'No results'}
        </div>
      )}
    </div>
  );
};

export default SearchReplace;
