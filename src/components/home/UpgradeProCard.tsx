import React from 'react';
import { useStorageMonitor } from '../../hooks/useStorageMonitor';

interface UpgradeProCardProps {
  onUpgradeClick: () => void;
  storageUsedMB?: number;
  isPro?: boolean;
}

export const UpgradeProCard: React.FC<UpgradeProCardProps> = ({
  onUpgradeClick,
  storageUsedMB,
  isPro: propIsPro,
}) => {
  const monitor = useStorageMonitor();
  const isPro = propIsPro !== undefined ? propIsPro : monitor.isPro;
  const formattedUsed = storageUsedMB !== undefined
    ? (storageUsedMB >= 1024 ? `${(storageUsedMB / 1024).toFixed(1)} GB` : `${storageUsedMB} MB`)
    : monitor.formattedUsed;
  const formattedTotal = isPro ? '10 GB' : '100 MB';
  const usedPercent = storageUsedMB !== undefined
    ? Math.min(100, Math.max(0, Math.round((storageUsedMB / (isPro ? 10240 : 100)) * 100)))
    : Math.min(100, Math.max(0, monitor.percentage));

  return (
    <div className="w-full rounded-2xl bg-[#111827]/80 border border-white/10 p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 backdrop-blur-xl shadow-xl shadow-black/20">
      {/* Storage Indicator */}
      <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[#22D3EE]">cloud</span>
            Storage {isPro && <span className="text-[10px] text-emerald-400 font-bold px-1.5 py-0.2 rounded bg-emerald-500/20">PRO 10GB</span>}
          </span>
          <span className="font-mono text-[#94A3B8]">{formattedUsed} of {formattedTotal}</span>
        </div>
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#22D3EE] via-[#8B5CF6] to-[#EC4899] transition-all duration-500"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      </div>

      <div className="hidden md:block w-px h-10 bg-white/10 mx-2" />

      {/* Pro Promotional Card Banner */}
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 sm:gap-4 flex-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#F59E0B] to-[#EC4899] flex items-center justify-center shrink-0 shadow-md shadow-amber-950/30">
            <span className="material-symbols-outlined text-[20px] text-white">crown</span>
          </div>
          <div className="flex flex-col min-w-0">
            <h4 className="font-bold text-[14px] text-white tracking-tight truncate">
              {isPro ? 'Chroma Pro Active' : 'Upgrade to Pro'}
            </h4>
            <p className="text-[12px] text-[#94A3B8] leading-tight">
              {isPro ? 'Unlimited Cloud AI synthesis & 4K exports.' : 'Unlock premium templates, AI tools from ₹99/mo.'}
            </p>
          </div>
        </div>

        <button
          onClick={onUpgradeClick}
          className={`w-full xs:w-auto min-h-[40px] px-4 py-2 rounded-xl text-white font-bold text-[12px] shadow-lg transition-all shrink-0 cursor-pointer flex items-center justify-center ${
            isPro
              ? 'bg-white/10 hover:bg-white/15 border border-white/15'
              : 'bg-gradient-to-r from-[#8B5CF6] via-[#EC4899] to-[#F59E0B] shadow-purple-950/30 hover:opacity-95 active:scale-95'
          }`}
        >
          {isPro ? 'Manage Plan' : 'Upgrade Now'}
        </button>
      </div>
    </div>
  );
};
