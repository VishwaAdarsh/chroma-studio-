import React, { useState } from 'react';

interface HeaderProps {
  projectName: string;
  onRenameProject: (name: string) => void;
  onBackToHome: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetAll?: () => void;
  onCopyEdits?: () => void;
  onPasteEdits?: () => void;
  canPasteEdits?: boolean;
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
  onResetAll,
  onCopyEdits,
  onPasteEdits,
  canPasteEdits = false,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleFinishEditing = () => {
    setIsEditingName(false);
    if (tempName.trim()) {
      onRenameProject(tempName.trim());
    } else {
      setTempName(projectName);
    }
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-[#070B14]/95 backdrop-blur-2xl border-b border-white/10 shadow-lg pt-[env(safe-area-inset-top)]">
      <div className="h-14 px-2.5 sm:px-3 flex items-center justify-between gap-1.5 sm:gap-2 max-w-5xl mx-auto">
        {/* Left: Back button & Project Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onBackToHome}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0"
            title="Back to Studio Home"
          >
            <span className="material-symbols-outlined text-[18px] sm:text-[20px]">arrow_back_ios_new</span>
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
                className="bg-[#111827] text-white px-2 py-0.5 rounded text-[12px] sm:text-[13px] font-semibold border border-[#8B5CF6] outline-none max-w-[80px] xs:max-w-[105px] sm:max-w-[150px]"
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
                <h1 className="text-[12px] sm:text-[13px] font-semibold text-white truncate max-w-[70px] xs:max-w-[95px] sm:max-w-[160px] group-hover:text-[#8B5CF6] transition-colors">
                  {projectName}
                </h1>
                <span className="material-symbols-outlined text-[12px] text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity">
                  edit
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse shrink-0" />
              <span className="text-[9px] sm:text-[10px] text-[#94A3B8] font-mono truncate">
                <span className="hidden xs:inline">{historyStepsCount} steps • </span>DCI-P3
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Zoom toggle (Desktop) */}
          <button
            onClick={onToggleZoom}
            className={`h-7 px-2 rounded-full text-[11px] font-mono hidden md:flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
              zoomLevel > 1
                ? 'bg-[#8B5CF6] text-white border border-[#8B5CF6]'
                : 'bg-white/10 text-[#CBD5E1] hover:text-white border border-white/10'
            }`}
            title="Toggle Canvas Zoom"
          >
            <span className="material-symbols-outlined text-[13px]">fit_screen</span>
            <span>{Math.round(zoomLevel * 100)}%</span>
          </button>

          {/* Undo */}
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Undo"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[17px]">undo</span>
          </button>

          {/* Redo */}
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="Redo"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[17px]">redo</span>
          </button>

          {/* Copy Edits (Desktop/Tablet) */}
          {onCopyEdits && (
            <button
              onClick={onCopyEdits}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hidden sm:flex items-center justify-center text-[#94A3B8] hover:text-[#8B5CF6] hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              title="Copy Recipe (Ctrl+C)"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">content_copy</span>
            </button>
          )}

          {/* Paste Edits (Desktop/Tablet) */}
          {onPasteEdits && (
            <button
              onClick={onPasteEdits}
              disabled={!canPasteEdits}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hidden sm:flex items-center justify-center text-[#94A3B8] hover:text-[#8B5CF6] hover:bg-white/10 active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              title="Paste Recipe (Ctrl+V)"
            >
              <span className="material-symbols-outlined text-[15px] sm:text-[16px]">content_paste</span>
            </button>
          )}

          {/* Reset All Adjustments (Desktop/Tablet) */}
          {onResetAll && (
            <button
              onClick={onResetAll}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hidden sm:flex items-center justify-center text-[#94A3B8] hover:text-rose-400 hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              title="Reset All Adjustments"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[17px]">restart_alt</span>
            </button>
          )}

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
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center active:scale-95 transition-all border cursor-pointer ${
              isComparing
                ? 'bg-[#8B5CF6] text-white border-[#8B5CF6] shadow-[0_0_10px_rgba(139,92,246,0.6)]'
                : 'bg-white/10 text-[#8B5CF6] border-white/10 hover:bg-white/20'
            }`}
            title="Hold to view original image"
          >
            <span className="material-symbols-outlined text-[15px] sm:text-[16px]">visibility</span>
          </button>

          {/* Settings (Desktop/Tablet) */}
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hidden sm:flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
            title="Settings & Privacy"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[17px]">settings</span>
          </button>

          {/* User Profile (Desktop/Tablet) */}
          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full hidden sm:flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              title="My Account"
            >
              <span className="material-symbols-outlined text-[16px] sm:text-[17px]">account_circle</span>
            </button>
          )}

          {/* Mobile More Actions Menu Toggle (Screens < 640px) */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-white bg-white/10 active:scale-90 transition-all cursor-pointer"
              title="More Actions"
            >
              <span className="material-symbols-outlined text-[16px]">more_vert</span>
            </button>

            {mobileMenuOpen && (
              <div
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end p-3 animate-in fade-in"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div
                  className="bg-[#0D1424] border border-white/10 rounded-2xl p-3 shadow-2xl space-y-1 text-white text-[13px] font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/10 px-2">
                    <span className="text-[11px] font-bold text-[#94A3B8] uppercase">Studio Actions</span>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[#94A3B8] hover:text-white p-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>

                  {onResetAll && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onResetAll();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-rose-400 active:scale-98 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                      <span>Reset All Adjustments</span>
                    </button>
                  )}

                  {onCopyEdits && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onCopyEdits();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-[#94A3B8] hover:text-white active:scale-98 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">content_copy</span>
                      <span>Copy Adjustment Recipe</span>
                    </button>
                  )}

                  {onPasteEdits && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onPasteEdits();
                      }}
                      disabled={!canPasteEdits}
                      className="w-full py-2.5 px-3 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-[#94A3B8] hover:text-white disabled:opacity-40 active:scale-98 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">content_paste</span>
                      <span>Paste Recipe</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onToggleZoom();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl flex items-center justify-between hover:bg-white/10 text-[#94A3B8] hover:text-white active:scale-98 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[18px]">fit_screen</span>
                      <span>Canvas Zoom</span>
                    </div>
                    <span className="font-mono text-[11px] text-[#8B5CF6] font-bold">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-[#94A3B8] hover:text-white active:scale-98 transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">settings</span>
                    <span>Settings & Privacy</span>
                  </button>

                  {onOpenProfile && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenProfile();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl flex items-center gap-2.5 hover:bg-white/10 text-[#94A3B8] hover:text-white active:scale-98 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">account_circle</span>
                      <span>My Account Profile</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Export CTA Button */}
          <button
            onClick={onOpenExport}
            className="h-7 sm:h-8 px-2.5 sm:px-3.5 rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] text-white flex items-center gap-1 font-bold text-[10px] sm:text-[11px] shadow-[0_0_12px_rgba(139,92,246,0.4)] hover:brightness-110 active:scale-95 transition-all ml-0.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[13px] sm:text-[14px]">ios_share</span>
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
