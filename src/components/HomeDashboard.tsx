import React, { useRef, useState } from 'react';
import type { SampleImage } from '../data/samples';
import type { Project } from '../types/editor';
import type { ReadyMadeTemplate } from '../types/design';
import { ChromaLogo } from './brand/ChromaLogo';
import { HeroBanner } from './home/HeroBanner';
import { WorkspaceCards } from './home/WorkspaceCards';
import { TrendingTemplates } from './home/TrendingTemplates';
import { RecentProjectsSection } from './home/RecentProjectsSection';
import { UpgradeProCard } from './home/UpgradeProCard';
import { ProfileBottomSheet } from './profile/ProfileBottomSheet';
import { AppBottomNavigation, BottomNavTab } from './navigation/AppBottomNavigation';
import { NavigationDrawer } from './navigation/NavigationDrawer';
import { useAuth } from '../contexts/AuthContext';

interface HomeDashboardProps {
  onStartWithSample: (sample: SampleImage) => void;
  onOpenProject: (project: Project) => void;
  onImportFile: (file: File) => void;
  recentProjects: Project[];
  onOpenSettings: () => void;
  onOpenTemplates: () => void;
  onOpenCollage: () => void;
  onOpenCarousel: () => void;
  onOpenProjectsView: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onSelectTemplate?: (template: ReadyMadeTemplate) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onStartWithSample,
  onOpenProject,
  onImportFile,
  onOpenSettings,
  onOpenTemplates,
  onOpenCollage,
  onOpenCarousel,
  onOpenProjectsView,
  onOpenProfile,
  onOpenAuth,
  onSelectTemplate,
  recentProjects,
}) => {
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentBottomTab, setCurrentBottomTab] = useState<BottomNavTab>('home');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  const handleBottomTabSelect = (tab: BottomNavTab) => {
    setCurrentBottomTab(tab);
    if (tab === 'editor') {
      fileInputRef.current?.click();
    } else if (tab === 'templates') {
      onOpenTemplates();
    } else if (tab === 'projects') {
      onOpenProjectsView();
    }
  };

  const displayName = profile?.full_name || (user ? user.email?.split('@')[0] : 'Ananya Sharma');
  const avatarUrl =
    profile?.avatar_url ||
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80';

  return (
    <div className="min-h-screen w-full bg-[#070B14] text-[#F8FAFC] flex flex-col justify-between selection:bg-[#8B5CF6]/40 selection:text-white pb-20 sm:pb-8 font-sans">
      {/* Hidden File Input for Photo Editor Trigger */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*,.dng,.raw"
        className="hidden"
      />

      {/* TOP APP BAR matching reference screenshot */}
      <header className="sticky top-0 w-full z-40 bg-[#070B14]/90 backdrop-blur-2xl border-b border-white/10 shadow-lg">
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between gap-4 max-w-7xl mx-auto">
          {/* Left: Mobile Drawer Trigger + Brand Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Open Navigation Menu"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
            <ChromaLogo variant="header" size="md" />
          </div>

          {/* Center: Global Search Bar on Desktop / Tablet */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-4 relative">
            <span className="material-symbols-outlined absolute left-3.5 text-[18px] text-[#94A3B8]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates, tools, projects..."
              className="w-full h-10 pl-10 pr-16 rounded-xl bg-[#111827] border border-white/10 text-white placeholder-[#94A3B8] text-[13px] focus:outline-none focus:border-[#8B5CF6] transition-all"
            />
            <span className="absolute right-3 text-[10px] font-mono text-[#94A3B8] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
              Ctrl K
            </span>
          </div>

          {/* Right Tools: Notifications & User Avatar */}
          <div className="flex items-center gap-3">
            {/* Notifications Button */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
                title="Notifications"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {/* Active Notification Dot */}
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#EC4899] animate-pulse" />
              </button>

              {/* Notification Popup Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-72 p-3 rounded-2xl bg-[#0D1424] border border-white/10 shadow-2xl z-50 text-[12px] flex flex-col gap-2">
                  <div className="flex items-center justify-between pb-1 border-b border-white/10">
                    <span className="font-bold text-white">Notifications</span>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[#94A3B8] hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 text-[#CBD5E1]">
                    <span className="font-semibold text-white block">Welcome to Chroma Studio!</span>
                    Explore new ready-made templates and 100% offline photo editing.
                  </div>
                </div>
              )}
            </div>

            {/* User Avatar with Green Online Dot */}
            <button
              onClick={() => setIsProfileSheetOpen(true)}
              className="relative flex items-center gap-2 p-1 rounded-full hover:bg-white/5 transition-all cursor-pointer"
              title="Open Account Menu"
            >
              <div className="relative w-9 h-9 rounded-full overflow-hidden bg-gradient-to-tr from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] p-0.5 shadow-md">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              {/* Online Green Status Dot */}
              <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#070B14]" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex flex-col gap-7">
        {/* A. Hero Banner with Sunset Mountains & Search */}
        <HeroBanner
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={() => {
            if (searchQuery.trim()) onOpenTemplates();
          }}
        />

        {/* B. The 4 Creative Workspace Cards */}
        <WorkspaceCards
          onOpenEditor={() => fileInputRef.current?.click()}
          onOpenTemplates={onOpenTemplates}
          onOpenCollage={onOpenCollage}
          onOpenCarousel={onOpenCarousel}
        />

        {/* C. Trending Templates Carousel */}
        <TrendingTemplates
          searchFilter={searchQuery}
          onViewAll={onOpenTemplates}
          onSelectTemplate={(template) => {
            if (onSelectTemplate) {
              onSelectTemplate(template);
            } else {
              onOpenTemplates();
            }
          }}
        />

        {/* D. Recent Projects Section */}
        <RecentProjectsSection
          projects={recentProjects}
          onOpenProject={onOpenProject}
          onViewAllProjects={onOpenProjectsView}
          onStartNew={() => fileInputRef.current?.click()}
        />

        {/* E. Upgrade to Pro & Storage Section */}
        <UpgradeProCard
          onUpgradeClick={onOpenProfile}
          storageUsedMB={2450} // 2.4 GB matching screenshot
        />
      </main>

      {/* ANDROID NAVIGATION DRAWER */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeRoute="home"
        onNavigate={(route) => {
          if (route === 'editor') fileInputRef.current?.click();
          if (route === 'templates-browse') onOpenTemplates();
          if (route === 'collage-browse') onOpenCollage();
          if (route === 'carousel-browse') onOpenCarousel();
          if (route === 'my-projects') onOpenProjectsView();
          if (route === 'explore') onOpenTemplates();
        }}
        onOpenSettings={onOpenSettings}
        onOpenUpgrade={onOpenProfile}
      />

      {/* ANDROID PROFILE BOTTOM SHEET / DROPDOWN */}
      <ProfileBottomSheet
        isOpen={isProfileSheetOpen}
        onClose={() => setIsProfileSheetOpen(false)}
        onOpenFullProfile={onOpenProfile}
        onOpenPreferences={onOpenSettings}
        onOpenAuth={onOpenAuth}
      />

      {/* MOBILE BOTTOM NAVIGATION DOCK */}
      <AppBottomNavigation
        currentTab={currentBottomTab}
        onSelectTab={handleBottomTabSelect}
        onOpenDrawer={() => setIsDrawerOpen(true)}
      />
    </div>
  );
};
