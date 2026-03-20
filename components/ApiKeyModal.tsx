
import React, { useState } from 'react';
import { Key, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppLanguage } from '../types';
import { TRANSLATIONS } from '../constants';

interface ApiKeyModalProps {
  language: AppLanguage;
  onClose: () => void;
  onSave: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ language, onClose, onSave }) => {
  const t = TRANSLATIONS[language].engine;
  const [key, setKey] = useState(localStorage.getItem('noa_api_key') || '');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleTest = async () => {
    if (!key.trim()) return;
    setStatus('testing');
    try {
      const { GoogleGenAI } = await import(/* @vite-ignore */ '@google/genai');
      const ai = new GoogleGenAI({ apiKey: key.trim() });
      await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: 'Say "OK" in one word.',
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const handleSave = () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    localStorage.setItem('noa_api_key', trimmed);
    onSave(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-8 space-y-6 mx-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/10 rounded-2xl">
              <Key className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="font-black text-lg">{t.apiKeyTitle}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-900 rounded-xl transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <p className="text-xs text-zinc-500">{t.apiKeyDesc}</p>

        <input
          type="password"
          value={key}
          onChange={e => { setKey(e.target.value); setStatus('idle'); }}
          placeholder="AIza..."
          className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm font-mono focus:border-blue-600 outline-none transition-all"
          autoFocus
        />

        {status === 'success' && (
          <div className="flex items-center gap-2 text-green-500 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" /> API key verified
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-red-500 text-xs font-bold">
            <AlertCircle className="w-4 h-4" /> Invalid API key
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={!key.trim() || status === 'testing'}
            className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t.apiKeyTest}
          </button>
          <button
            onClick={handleSave}
            disabled={!key.trim()}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50"
          >
            {t.apiKeySave}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
