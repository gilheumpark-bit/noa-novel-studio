
import React from 'react';
import { History, Settings, PlusCircle, Cloud, Cpu, PenTool, Zap, UserCircle, Globe, Crown, ArrowRight, Smartphone, Monitor } from 'lucide-react';
import { GenerationMode, AppTab, AppLanguage, ViewMode } from '../types';
import { TRANSLATIONS } from '../constants';

interface SidebarProps {
  language: AppLanguage;
  currentMode?: GenerationMode;
  setMode?: (mode: GenerationMode) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onNewProject?: () => void;
  onTabChange?: (tab: AppTab) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  language, 
  currentMode = 'cloud', 
  setMode, 
  viewMode, 
  setViewMode, 
  onNewProject, 
  onTabChange 
}) => {
  const t = TRANSLATIONS[language].sidebar;

  const handleTabClick = (tab: AppTab) => {
    onTabChange?.(tab);
  };

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent tracking-tighter italic">
              NOA STUDIO
            </h1>
            <p className="text-[7px] text-zinc-600 tracking-[0.4em] uppercase font-bold">Commercial Alpha</p>
          </div>
        </div>

        <button 
          onClick={onNewProject}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-blue-50 text-black py-4 rounded-2xl font-black transition-all text-[11px] uppercase tracking-widest shadow-xl active:scale-95 border border-white/10"
        >
          <PlusCircle className="w-4 h-4" />
          {t.newProject}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8 custom-scrollbar">
        <div>
          <h3 className="text-[9px] font-black text-zinc-700 uppercase mb-4 px-2 tracking-[0.2em]">{t.masterBlueprint}</h3>
          <ul className="space-y-1">
            <li>
              <button onClick={() => handleTabClick('world')} className="flex items-center gap-3 w-full px-4 py-3.5 text-zinc-500 hover:text-white hover:bg-zinc-900/50 rounded-xl text-xs transition-all font-bold group">
                <Globe className="w-4 h-4 text-zinc-600 group-hover:text-blue-500" />
                {t.worldBible}
              </button>
            </li>
            <li>
              <button onClick={() => handleTabClick('characters')} className="flex items-center gap-3 w-full px-4 py-3.5 text-zinc-500 hover:text-white hover:bg-zinc-900/50 rounded-xl text-xs transition-all font-bold group">
                <UserCircle className="w-4 h-4 text-zinc-600 group-hover:text-amber-500" />
                {t.characterStudio}
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-[9px] font-black text-zinc-700 uppercase mb-4 px-2 tracking-[0.2em]">{t.production}</h3>
          <ul className="space-y-1">
            <li>
              <button onClick={() => handleTabClick('writing')} className="flex items-center gap-3 w-full px-4 py-3.5 text-zinc-500 hover:text-white hover:bg-zinc-900/50 rounded-xl text-xs transition-all font-bold group">
                <PenTool className="w-4 h-4 text-zinc-600 group-hover:text-green-500" />
                {t.writingMode}
              </button>
            </li>
            <li>
              <button onClick={() => handleTabClick('history')} className="flex items-center gap-3 w-full px-4 py-3.5 text-zinc-500 hover:text-white hover:bg-zinc-900/50 rounded-xl text-xs transition-all font-bold group">
                <History className="w-4 h-4 text-zinc-600 group-hover:text-purple-500" />
                {t.archives}
              </button>
            </li>
          </ul>
        </div>

        <div className="pt-2">
           <button 
             onClick={() => handleTabClick('settings')}
             className="w-full bg-zinc-900/40 border border-white/5 p-5 rounded-[2rem] group hover:border-blue-500/30 transition-all text-left relative overflow-hidden"
           >
              <div className="flex items-center gap-2 mb-3">
                 <Crown className="w-4 h-4 text-blue-500" />
                 <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{t.proMember}</span>
              </div>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight mb-4 leading-relaxed">{t.ultimatePower}</p>
              <div className="flex items-center justify-between text-[9px] font-black text-white uppercase group-hover:gap-2 transition-all">
                 {t.manageBilling} <ArrowRight className="w-3 h-3 text-blue-500" />
              </div>
           </button>
        </div>
      </div>

      <div className="p-6 border-t border-white/5 space-y-3 bg-zinc-950">
        {/* Engine Mode Toggle */}
        <div className="bg-zinc-900/50 rounded-xl p-1 flex border border-white/5">
          <button onClick={() => setMode?.('cloud')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black transition-all ${currentMode === 'cloud' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-600'}`}>
            <Cloud className="w-3 h-3" /> CLOUD
          </button>
          <button onClick={() => setMode?.('local')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black transition-all ${currentMode === 'local' ? 'bg-zinc-800 text-zinc-400' : 'text-zinc-600'}`}>
            <Cpu className="w-3 h-3" /> LOCAL
          </button>
        </div>

        {/* View Mode Toggle (Moved here from App.tsx) */}
        <div className="bg-zinc-900/50 rounded-xl p-1 flex border border-white/5">
          <button onClick={() => setViewMode('mobile')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black transition-all ${viewMode === 'mobile' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-600'}`}>
            <Smartphone className="w-3 h-3" /> MOBILE
          </button>
          <button onClick={() => setViewMode('desktop')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[9px] font-black transition-all ${viewMode === 'desktop' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-600'}`}>
            <Monitor className="w-3 h-3" /> WEB
          </button>
        </div>

        <button onClick={() => handleTabClick('settings')} className="flex items-center gap-3 w-full px-4 py-2 text-zinc-600 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
          <Settings className="w-4 h-4" />
          {t.settings}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
