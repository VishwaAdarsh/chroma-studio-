import React, { useState } from 'react';
import { StorageService } from '../services/storage';
import type { AppSettings } from '../services/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearProjects: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onClearProjects,
}) => {
  const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());
  const [storageMB, setStorageMB] = useState<number>(0.25);
  const [clearedNotice, setClearedNotice] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      StorageService.getEstimatedStorageMB().then(setStorageMB);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFormatChange = (fmt: 'jpeg' | 'png' | 'webp') => {
    const updated = { ...settings, defaultFormat: fmt };
    setSettings(updated);
    StorageService.saveSettings(updated);
  };

  const handleClearData = async () => {
    if (window.confirm('Are you sure you want to clear local draft projects and cache?')) {
      await StorageService.clearCache();
      onClearProjects();
      setStorageMB(0);
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#0D1424] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-white animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center border border-[#8B5CF6]/30">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-white">Chroma Studio Settings</h3>
              <p className="text-[11px] text-[#94A3B8]">Creative Engine, Storage & Privacy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Offline & Privacy Architecture Guarantee Banner */}
        <div className="p-3.5 rounded-2xl bg-[#111827] border border-emerald-500/30 flex items-start gap-3 shadow-md">
          <span className="material-symbols-outlined text-emerald-400 text-[20px] mt-0.5 shrink-0">
            verified_user
          </span>
          <div className="space-y-0.5">
            <span className="text-[12px] font-bold text-emerald-400 block">
              100% Offline-First Privacy
            </span>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Your high-resolution photographs never leave your device. All color grading,
              curves, split toning, and exports execute locally in GPU memory.
            </p>
          </div>
        </div>

        {/* Default Export Format */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase text-[#94A3B8] tracking-wider block">
            Default Export Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['jpeg', 'png', 'webp'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleFormatChange(fmt)}
                className={`py-2 rounded-xl text-[12px] font-bold uppercase transition-all cursor-pointer ${
                  settings.defaultFormat === fmt
                    ? 'bg-[#8B5CF6] text-white shadow-lg shadow-purple-950/40 border border-[#8B5CF6]'
                    : 'bg-[#111827] text-[#94A3B8] hover:text-white hover:bg-[#172033] border border-white/10'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Storage Management */}
        <div className="p-3.5 rounded-2xl bg-[#111827] border border-white/10 space-y-2.5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-white">Local Cache & Projects</span>
            <span className="text-[11px] font-mono text-[#8B5CF6] font-bold">{storageMB} MB</span>
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            IndexedDB and local draft data stored securely on this device.
          </p>
          <button
            onClick={handleClearData}
            className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-[#EF4444] text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 border border-red-500/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
            <span>{clearedNotice ? 'Cleared!' : 'Clear Local Cache & Projects'}</span>
          </button>
        </div>

        {/* Engine Version Footnote */}
        <div className="text-center pt-2 border-t border-white/10">
          <span className="text-[10px] text-[#94A3B8] font-mono">
            Chroma Studio v2.0 • Pro Creative Engine • Android Native Ready
          </span>
        </div>
      </div>
    </div>
  );
};
