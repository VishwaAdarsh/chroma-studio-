import React from 'react';
import type { EditorTab } from '../types/editor';

interface ToolNavigationProps {
  activeTab: EditorTab;
  onSelectTab: (tab: EditorTab) => void;
}

export const ToolNavigation: React.FC<ToolNavigationProps> = ({
  activeTab,
  onSelectTab,
}) => {
  const tabs: Array<{ id: EditorTab; label: string; icon: string; badge?: string }> = [
    { id: 'looks', label: 'Looks', icon: 'style' },
    { id: 'adjust', label: 'Adjust', icon: 'tune' },
    { id: 'crop', label: 'Crop', icon: 'crop' },
    { id: 'curves', label: 'Curves', icon: 'show_chart' },
    { id: 'colorlab', label: 'Color Lab', icon: 'palette', badge: 'PRO' },
    { id: 'cutout', label: 'Cutout', icon: 'person_remove', badge: 'AI' },
    { id: 'backdrop', label: 'Backdrop', icon: 'wallpaper', badge: 'AI' },
    { id: 'inpaint', label: 'Erase', icon: 'cleaning_services', badge: 'AI' },
    { id: 'effects', label: 'Effects', icon: 'blur_on' },
    { id: 'ai', label: 'AI Magic', icon: 'auto_awesome', badge: 'AI' },
  ];

  return (
    <div className="w-full bg-[#0D1424]/95 backdrop-blur-2xl rounded-2xl p-1 border border-white/10 shadow-lg pb-[calc(0.25rem+env(safe-area-inset-bottom))]">
      <div className="flex sm:grid sm:grid-cols-10 items-center overflow-x-auto no-scrollbar scroll-smooth justify-between">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-2.5 sm:px-1 min-w-[56px] sm:min-w-0 transition-all relative group active:scale-95 cursor-pointer ${
                isActive ? 'text-[#8B5CF6]' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <div className="relative">
                <span
                  className="material-symbols-outlined text-[19px] sm:text-[20px]"
                  style={{
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {tab.icon}
                </span>
                {tab.badge && (
                  <span className="absolute -top-1 -right-2.5 px-1 py-0.2 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-mono text-[7px] sm:text-[8px] font-bold rounded-full shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[9px] sm:text-[10px] mt-0.5 tracking-tight font-medium truncate ${
                  isActive ? 'text-[#8B5CF6] font-bold' : ''
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] mt-0.5 shadow-[0_0_6px_rgba(139,92,246,0.6)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
