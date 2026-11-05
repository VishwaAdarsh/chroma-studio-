import React from 'react';

export type BottomNavTab = 'home' | 'editor' | 'templates' | 'projects' | 'more';

interface AppBottomNavigationProps {
  currentTab: BottomNavTab;
  onSelectTab: (tab: BottomNavTab) => void;
  onOpenDrawer: () => void;
}

export const AppBottomNavigation: React.FC<AppBottomNavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenDrawer,
}) => {
  const tabs = [
    { id: 'home' as BottomNavTab, label: 'Home', icon: 'home' },
    { id: 'editor' as BottomNavTab, label: 'Editor', icon: 'auto_fix_high' },
    { id: 'templates' as BottomNavTab, label: 'Templates', icon: 'dashboard_customize' },
    { id: 'projects' as BottomNavTab, label: 'Projects', icon: 'folder' },
    { id: 'more' as BottomNavTab, label: 'More', icon: 'menu' },
  ];

  const handleTabClick = (tabId: BottomNavTab) => {
    if (tabId === 'more') {
      onOpenDrawer();
    } else {
      onSelectTab(tabId);
    }
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-[#070B14]/95 backdrop-blur-2xl border-t border-white/10 shadow-2xl pb-[env(safe-area-inset-bottom,8px)] pt-1.5 px-3">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl min-w-[54px] min-h-[44px] transition-all duration-200 active:scale-90 cursor-pointer touch-manipulation ${
                isActive
                  ? 'text-[#8B5CF6]'
                  : 'text-[#94A3B8] hover:text-[#CBD5E1]'
              }`}
            >
              <div
                className={`w-10 h-7 rounded-full flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-[#8B5CF6]/20 border border-[#8B5CF6]/30'
                    : 'bg-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {tab.icon}
                </span>
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
