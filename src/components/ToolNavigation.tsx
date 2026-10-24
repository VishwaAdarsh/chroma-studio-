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
    { id: 'effects', label: 'Effects', icon: 'blur_on' },
  ];

  return (
    <div className="w-full bg-surface-container-lowest/95 backdrop-blur-2xl rounded-2xl p-1 border border-outline-variant shadow-lg">
      <div className="grid grid-cols-6 items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 transition-all relative group active:scale-95 ${
                isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <div className="relative">
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {tab.icon}
                </span>
                {tab.badge && (
                  <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-primary-container text-white font-mono text-[8px] font-bold rounded-full shadow-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 tracking-tight font-medium ${
                  isActive ? 'text-primary font-bold' : ''
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5 shadow-[0_0_6px_rgba(191,4,17,0.6)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
