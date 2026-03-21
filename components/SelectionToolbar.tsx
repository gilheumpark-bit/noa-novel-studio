
import React, { useState, useEffect, useCallback } from 'react';
import { Wand2, Expand, Shrink, Paintbrush, Loader2, X } from 'lucide-react';
import { AppLanguage } from '../types';

interface SelectionToolbarProps {
  language: AppLanguage;
  onAction: (action: 'rewrite' | 'expand' | 'shrink' | 'describe', selectedText: string) => Promise<string>;
  containerRef: React.RefObject<HTMLElement | null>;
  onReplace: (original: string, replacement: string) => void;
}

const ACTIONS = [
  { key: 'rewrite' as const, icon: Wand2, label: { KO: '재작성', EN: 'Rewrite', JP: '書き直し', CN: '重写' }, color: 'text-blue-400' },
  { key: 'expand' as const, icon: Expand, label: { KO: '확장', EN: 'Expand', JP: '拡張', CN: '扩展' }, color: 'text-green-400' },
  { key: 'shrink' as const, icon: Shrink, label: { KO: '압축', EN: 'Shrink', JP: '圧縮', CN: '压缩' }, color: 'text-yellow-400' },
  { key: 'describe' as const, icon: Paintbrush, label: { KO: '묘사 강화', EN: 'Describe', JP: '描写強化', CN: '描写增强' }, color: 'text-purple-400' },
];

const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ language, onAction, containerRef, onReplace }) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      if (!loading) setPosition(null);
      return;
    }

    // Check if selection is within our container
    const container = containerRef.current;
    if (!container) return;

    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      if (!loading) setPosition(null);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) return;

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setSelectedText(text);
    setPosition({
      top: rect.top - containerRect.top - 45,
      left: rect.left - containerRect.left + rect.width / 2,
    });
  }, [containerRef, loading]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  const handleAction = async (action: 'rewrite' | 'expand' | 'shrink' | 'describe') => {
    if (!selectedText) return;
    setLoading(action);
    try {
      const result = await onAction(action, selectedText);
      if (result) {
        onReplace(selectedText, result);
      }
    } catch (err) {
      console.error('Selection action failed:', err);
    } finally {
      setLoading(null);
      setPosition(null);
    }
  };

  if (!position) return null;

  return (
    <div
      className="absolute z-50 flex items-center gap-1 px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl animate-in fade-in duration-200"
      style={{ top: position.top, left: position.left, transform: 'translateX(-50%)' }}
    >
      {ACTIONS.map(({ key, icon: Icon, label, color }) => (
        <button
          key={key}
          onClick={() => handleAction(key)}
          disabled={!!loading}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-zinc-800 transition-all disabled:opacity-40 ${color}`}
          title={label[language]}
        >
          {loading === key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
          <span className="hidden sm:inline">{label[language]}</span>
        </button>
      ))}
      <button onClick={() => setPosition(null)} className="p-1 text-zinc-600 hover:text-zinc-300">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

export default SelectionToolbar;
