
import React, { useState } from 'react';
import { Key, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AppLanguage, AIProvider } from '../types';
import { TRANSLATIONS } from '../constants';
import {
  PROVIDER_LABELS, PROVIDER_MODELS, DEFAULT_MODELS,
  getStoredProvider, getStoredApiKey, getStoredModel,
  setStoredProvider, setStoredApiKey, setStoredModel,
  testApiKey,
} from '../services/aiService';

interface ApiKeyModalProps {
  language: AppLanguage;
  onClose: () => void;
  onSave: () => void;
}

const PROVIDERS: AIProvider[] = ['gemini', 'openai', 'claude'];

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ language, onClose, onSave }) => {
  const t = TRANSLATIONS[language].engine;
  const [provider, setProvider] = useState<AIProvider>(getStoredProvider());
  const [keys, setKeys] = useState<Record<AIProvider, string>>({
    gemini: getStoredApiKey('gemini'),
    openai: getStoredApiKey('openai'),
    claude: getStoredApiKey('claude'),
  });
  const [models, setModels] = useState<Record<AIProvider, string>>({
    gemini: getStoredModel('gemini'),
    openai: getStoredModel('openai'),
    claude: getStoredModel('claude'),
  });
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const currentKey = keys[provider];
  const currentModel = models[provider];

  const handleTest = async () => {
    if (!currentKey.trim()) return;
    setStatus('testing');
    try {
      await testApiKey(provider, currentKey.trim(), currentModel);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const handleSave = () => {
    const trimmed = currentKey.trim();
    if (!trimmed) return;
    setStoredProvider(provider);
    setStoredApiKey(provider, trimmed);
    setStoredModel(provider, currentModel);
    onSave();
    onClose();
  };

  const handleProviderChange = (p: AIProvider) => {
    setProvider(p);
    setStatus('idle');
  };

  const handleKeyChange = (value: string) => {
    setKeys({ ...keys, [provider]: value });
    setStatus('idle');
  };

  const handleModelChange = (value: string) => {
    setModels({ ...models, [provider]: value });
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

        {/* Provider Tabs */}
        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-xl">
          {PROVIDERS.map(p => (
            <button
              key={p}
              onClick={() => handleProviderChange(p)}
              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                provider === p
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {p === 'gemini' ? 'Gemini' : p === 'openai' ? 'OpenAI' : 'Claude'}
            </button>
          ))}
        </div>

        <p className="text-xs text-zinc-500">
          {PROVIDER_LABELS[provider]} API {language === 'KO' ? '키를 입력하세요.' : language === 'JP' ? 'キーを入力してください。' : language === 'CN' ? '密钥请输入。' : 'key required.'}
        </p>

        {/* API Key Input */}
        <input
          type="password"
          value={currentKey}
          onChange={e => handleKeyChange(e.target.value)}
          placeholder={provider === 'gemini' ? 'AIza...' : provider === 'openai' ? 'sk-...' : 'sk-ant-...'}
          className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm font-mono focus:border-blue-600 outline-none transition-all"
          autoFocus
        />

        {/* Model Select */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
            {language === 'KO' ? '모델' : 'Model'}
          </label>
          <select
            value={currentModel}
            onChange={e => handleModelChange(e.target.value)}
            className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm font-mono focus:border-blue-600 outline-none cursor-pointer"
          >
            {PROVIDER_MODELS[provider].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {status === 'success' && (
          <div className="flex items-center gap-2 text-green-500 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" /> {language === 'KO' ? 'API 키 검증 완료' : 'API key verified'}
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-red-500 text-xs font-bold">
            <AlertCircle className="w-4 h-4" /> {language === 'KO' ? '유효하지 않은 API 키' : 'Invalid API key'}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleTest}
            disabled={!currentKey.trim() || status === 'testing'}
            className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {status === 'testing' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {t.apiKeyTest}
          </button>
          <button
            onClick={handleSave}
            disabled={!currentKey.trim()}
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
