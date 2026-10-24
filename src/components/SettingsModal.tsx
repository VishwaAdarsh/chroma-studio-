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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-surface-container-low border border-outline-variant rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-on-surface">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">settings</span>
            </div>
            <div>
              <h3 className="font-semibold text-[16px] text-on-surface">Chroma Studio Settings</h3>
              <p className="text-[11px] text-on-surface-variant">Fidelity Theme, Storage & Privacy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-outline hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Offline & Privacy Architecture Guarantee Banner */}
        <div className="p-3 rounded-xl bg-surface-container-lowest border border-emerald-500/30 flex items-start gap-2.5 shadow-xs">
          <span className="material-symbols-outlined text-emerald-600 text-[20px] mt-0.5">
            verified_user
          </span>
          <div className="space-y-0.5">
            <span className="text-[12px] font-semibold text-emerald-700 block">
              100% Offline-First Privacy
            </span>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Your high-resolution photographs never leave your device. All color grading,
              curves, split toning, and exports execute locally in your GPU memory.
            </p>
          </div>
        </div>

        {/* Default Export Format */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase text-on-surface-variant">
            Default Export Format
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['jpeg', 'png', 'webp'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleFormatChange(fmt)}
                className={`py-2 rounded-xl text-[12px] font-semibold uppercase transition-all ${
                  settings.defaultFormat === fmt
                    ? 'bg-primary-container text-white shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high border border-outline-variant'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Storage Management */}
        <div className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium text-on-surface">Local Cache & Projects</span>
            <span className="text-[11px] font-mono text-primary font-bold">{storageMB} MB</span>
          </div>
          <p className="text-[11px] text-on-surface-variant">
            IndexedDB and local draft data stored on this browser/device.
          </p>
          <button
            onClick={handleClearData}
            className="w-full py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 border border-rose-300/40"
          >
            <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
            <span>{clearedNotice ? 'Cleared!' : 'Clear Local Cache & Projects'}</span>
          </button>
        </div>

        {/* Engine Version Footnote */}
        <div className="text-center pt-1 border-t border-outline-variant">
          <span className="text-[10px] text-outline font-mono">
            Chroma Studio v1.0 • Fidelity Engine v4.2 • DCI-P3 Ready
          </span>
        </div>
      </div>
    </div>
  );
};
