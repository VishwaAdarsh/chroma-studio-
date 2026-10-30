import React from 'react';
import { ChromaLogo } from '../brand/ChromaLogo';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoute: string;
  onNavigate: (route: string) => void;
  onOpenSettings: () => void;
  onOpenUpgrade: () => void;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  activeRoute,
  onNavigate,
  onOpenSettings,
  onOpenUpgrade,
}) => {
  if (!isOpen) return null;

  const navItems = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'editor', label: 'Photo Editor', icon: 'auto_fix_high' },
    { id: 'templates-browse', label: 'Templates', icon: 'dashboard_customize' },
    { id: 'collage-browse', label: 'Collage', icon: 'grid_view' },
    { id: 'carousel-browse', label: 'Carousel', icon: 'view_carousel' },
    { id: 'my-projects', label: 'Projects', icon: 'folder' },
    { id: 'my-assets', label: 'My Assets', icon: 'photo_library' },
    { id: 'explore', label: 'Explore', icon: 'explore' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  const handleItemClick = (id: string) => {
    onClose();
    if (id === 'settings') {
      onOpenSettings();
    } else {
      onNavigate(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Container matching reference sidebar */}
      <div className="relative w-72 max-w-[80vw] h-full bg-[#0D1424] border-r border-white/10 p-5 shadow-2xl flex flex-col justify-between text-white z-10 animate-in slide-in-from-left duration-200 overflow-y-auto">
        <div className="flex flex-col gap-6">
          {/* Top Brand Header */}
          <div className="flex items-center justify-between">
            <ChromaLogo variant="header" size="md" />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left cursor-pointer ${
                    isActive
                      ? 'bg-[#1E1B4B] text-[#A855F7] border border-[#8B5CF6]/30 shadow-sm'
                      : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Drawer Section: Storage & Pro */}
        <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
          {/* Storage Meter */}
          <div className="p-3 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-[#22D3EE]">cloud</span>
                Storage
              </span>
              <span className="text-[#94A3B8] font-mono">2.4 GB of 10 GB</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#22D3EE] to-[#8B5CF6] w-[24%]" />
            </div>
          </div>

          {/* Upgrade to Pro Card */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#1E1B4B] to-[#111827] border border-[#8B5CF6]/30 flex flex-col gap-2 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#F59E0B]">crown</span>
              <h4 className="font-bold text-[13px] text-white">Upgrade to Pro</h4>
            </div>
            <p className="text-[11px] text-[#94A3B8] leading-snug">
              Unlock premium templates, AI tools and cloud sync.
            </p>
            <button
              onClick={() => {
                onClose();
                onOpenUpgrade();
              }}
              className="w-full py-1.5 rounded-lg bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] text-white font-bold text-[11px] shadow-sm hover:opacity-95 cursor-pointer text-center"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
