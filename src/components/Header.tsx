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
    <header className="fixed top-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant shadow-xs">
      <div className="h-14 px-3 flex items-center justify-between gap-2 max-w-5xl mx-auto">
        {/* Left: Back button & Project Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            onClick={onBackToHome}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high active:scale-95 transition-all"
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
                className="bg-surface-container-low text-on-surface px-1.5 py-0.5 rounded text-[13px] font-semibold border border-primary outline-none max-w-[140px]"
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
                <h1 className="text-[13px] font-semibold text-on-surface truncate max-w-[160px] group-hover:text-primary transition-colors">
                  {projectName}
                </h1>
                <span className="material-symbols-outlined text-[13px] text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                  edit
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] text-on-surface-variant font-mono">
                {historyStepsCount} steps • DCI-P3 16-bit
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Zoom toggle */}
          <button
            onClick={onToggleZoom}
            className={`h-7 px-2 rounded-full text-[11px] font-mono flex items-center gap-1 active:scale-95 transition-all ${
              zoomLevel > 1
                ? 'bg-primary-container text-white border border-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant'
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
            className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
            title="Undo"
          >
            <span className="material-symbols-outlined text-[16px]">undo</span>
          </button>

          {/* Redo */}
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high active:scale-90 transition-all disabled:opacity-30 disabled:pointer-events-none"
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
            className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all border ${
              isComparing
                ? 'bg-primary-container text-white border-primary shadow-[0_0_10px_rgba(228,43,39,0.4)]'
                : 'bg-surface-container-high text-primary border-outline-variant hover:bg-surface-container-highest'
            }`}
            title="Hold to view original image"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high active:scale-95 transition-all"
            title="Settings & Privacy"
          >
            <span className="material-symbols-outlined text-[17px]">settings</span>
          </button>

          {/* Export CTA Button */}
          <button
            onClick={onOpenExport}
            className="h-8 px-3 rounded-full bg-primary-container text-white flex items-center gap-1 font-semibold text-[11px] shadow-[0_0_12px_rgba(228,43,39,0.35)] hover:brightness-110 active:scale-95 transition-all ml-1"
          >
            <span className="material-symbols-outlined text-[14px]">ios_share</span>
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
