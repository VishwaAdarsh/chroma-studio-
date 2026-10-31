import React, { useState } from 'react';

interface HeaderProps {
  projectName: string;
  onRenameProject: (name: string) => void;
  onBackToHome: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  onOpenProfile?: () => void;
  isComparing: boolean;
  onStartComparing: () => void;
  onStopComparing: () => void;
  zoomLevel: number;
  onToggleZoom: () => void;
  historyStepsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  onRenameProject,
  onBackToHome,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenExport,
  onOpenSettings,
  onOpenProfile,
  isComparing,
  onStartComparing,
  onStopComparing,
  zoomLevel,
  onToggleZoom,
  historyStepsCount,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(projectName);

  const handleFinishEditing = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      onRenameProject(tempName.trim());
    } else {
      setTempName(projectName);
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-[#070B14]/90 backdrop-blur-2xl border-b border-white/10 shadow-lg">
      <div className="h-14 px-3 flex items-center justify-between gap-2 max-w-5xl mx-auto">
        {/* Left: Back button & Project Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onBackToHome}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title="Back to Studio Home"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back_ios_new</span>
          </button>

          <div className="flex flex-col min-w-0">
            {isEditingName ? (
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleFinishEditing}
                onKeyDown={(e) => e.key === 'Enter' && handleFinishEditing()}
                autoFocus
                className="bg-[#111827] text-white px-2 py-0.5 rounded text-[13px] font-semibold border border-[#8B5CF6] outline-none max-w-[100px] sm:max-w-[140px]"
              />
            ) : (
              <div
                onClick={() => {
                  setTempName(projectName);
                  setIsEditingName(true);
                }}
                className="flex items-center gap-1 cursor-pointer group"
                title="Click to rename project"
              >
                <h1 className="text-[13px] font-semibold text-white truncate max-w-[95px] sm:max-w-[160px] group-hover:text-[#8B5CF6] transition-colors">
                  {projectName}
                </h1>
                <span className="material-symbols-outlined text-[13px] text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity">
                  edit
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse shrink-0" />
              <span className="text-[10px] text-[#94A3B8] font-mono truncate">
                <span className="hidden sm:inline">{historyStepsCount} steps • </span>DCI-P3 16-bit
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom toggle */}
          <button
            onClick={onToggleZoom}
            className={`h-7 px-2 rounded-full text-[11px] font-mono flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
              zoomLevel > 1
                ? 'bg-[#8B5CF6] text-white border border-[#8B5CF6]'
                : 'bg-white/10 text-[#CBD5E1] hover:text-white border border-white/10'
            }`}
            title="Toggle Canvas Zoom"
          >
            <span className="material-symbols-outlined text-[13px]">fit_screen</span>
            <span className="hidden sm:inline">{Math.round(zoomLevel * 100)}%</span>
          </button>

          {/* Undo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Undo"
          >
            <span className="material-symbols-outlined text-[16px]">undo</span>
          </button>

          {/* Redo */}
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Redo"
          >
            <span className="material-symbols-outlined text-[16px]">redo</span>
          </button>

          {/* Hold / Toggle Compare */}
          <button
            onMouseDown={onStartComparing}
            onMouseUp={onStopComparing}
            onMouseLeave={onStopComparing}
            onTouchStart={(e) => {
              e.preventDefault();
              onStartComparing();
            }}
            onTouchEnd={onStopComparing}
            className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all border cursor-pointer ${
              isComparing
                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-[0_0_10px_rgba(139,92,246,0.6)]'
                : 'bg-white/10 text-[#8B5CF6] border-white/10 hover:bg-white/20'
            }`}
            title="Hold to view original image"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title="Settings & Privacy"
          >
            <span className="material-symbols-outlined text-[17px]">settings</span>
          </button>

          {/* User Profile */}
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              title="My Account"
            >
              <span className="material-symbols-outlined text-[17px]">account_circle</span>
            </button>
          )}

          {/* Export CTA Button */}
          <button
            onClick={onOpenExport}
            className="h-8 px-3.5 rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] text-white flex items-center gap-1 font-bold text-[11px] shadow-[0_0_12px_rgba(139,92,246,0.4)] hover:brightness-110 active:scale-95 transition-all ml-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">ios_share</span>
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
