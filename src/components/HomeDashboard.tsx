import React, { useRef, useState } from 'react';
import { SAMPLE_IMAGES } from '../data/samples';
import type { SampleImage } from '../data/samples';
import type { Project } from '../types/editor';

interface HomeDashboardProps {
  onStartWithSample: (sample: SampleImage) => void;
  onOpenProject: (project: Project) => void;
  onImportFile: (file: File) => void;
  recentProjects: Project[];
  onOpenSettings: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onStartWithSample,
  onOpenProject,
  onImportFile,
  onOpenSettings,
  recentProjects,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'projects' | 'settings'>('home');
  const [lookFilter, setLookFilter] = useState<string>('All');

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
  };

  const curatedLooks = [
    {
      id: 'look-cine-500t',
      name: 'Cinematic 500T',
      subtitle: 'Tungsten 3200K',
      sampleId: 'sample-kyoto',
      gradient: 'from-amber-400 via-rose-900 to-indigo-950',
      category: 'Cinematic',
    },
    {
      id: 'look-noir-400',
      name: 'Noir Silver 400',
      subtitle: 'Fine Grain +12',
      sampleId: 'sample-brutalism',
      gradient: 'from-zinc-300 via-gray-700 to-black',
      category: 'Monochrome',
    },
    {
      id: 'look-kodachrome',
      name: 'Kodachrome 64',
      subtitle: 'Warm Saturation',
      sampleId: 'sample-dunes',
      gradient: 'from-red-600 via-amber-500 to-yellow-600',
      category: '35mm Vintage',
    },
    {
      id: 'look-pastel',
      name: 'Pastel Dream',
      subtitle: 'Soft Glow Halation',
      sampleId: 'sample-portrait',
      gradient: 'from-pink-300 via-rose-300 to-orange-200',
      category: 'Editorial',
    },
  ];

  const filteredLooks =
    lookFilter === 'All'
      ? curatedLooks
      : curatedLooks.filter((l) => l.category === lookFilter);

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between pb-20 selection:bg-primary-container selection:text-white">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/*,.dng,.raw"
        className="hidden"
      />

      {/* Top Fixed Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant shadow-xs">
        <div className="h-14 px-4 flex items-center justify-between max-w-5xl mx-auto">
          {/* Logo & Branding */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-container to-secondary p-0.5 flex items-center justify-center shadow-md shadow-primary-container/20">
              <span className="material-symbols-outlined text-[20px] text-white">tune</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-[16px] tracking-tight text-on-surface">CHROMA</span>
              <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                PRO
              </span>
            </div>
          </div>

          {/* Right Tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSettings}
              className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors border border-outline-variant"
              title="Settings"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </button>
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-white font-bold text-[12px] shadow-sm">
              <span>CS</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Home Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 flex flex-col gap-6">
        {/* Hero: Start Session / Import Photo */}
        <div className="relative w-full rounded-2xl bg-gradient-to-br from-surface-container-highest via-surface-container to-surface-container-low p-5 shadow-lg overflow-hidden border border-outline-variant">
          {/* Ambient Crimson Glows */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-secondary-container/20 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-3.5">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-mono">
                  FIDELITY COLOR ENGINE
                </span>
                <h2 className="text-[22px] font-bold text-on-surface tracking-tight mt-0.5">
                  Start Photo Session
                </h2>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-11 h-11 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high text-primary flex items-center justify-center shadow-md border border-outline-variant active:scale-95 transition-all"
                title="Camera / Photo picker"
              >
                <span className="material-symbols-outlined text-[22px]">photo_camera</span>
              </button>
            </div>

            <p className="text-[12px] text-on-surface-variant leading-relaxed max-w-md">
              Process uncompressed 14-bit sensory data with precision color grading, RGB curves, split toning, and non-destructive adjustments. 100% offline and private.
            </p>

            <div className="pt-1 flex flex-col gap-2.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-12 rounded-xl bg-primary-container text-white font-semibold text-[13px] flex items-center justify-center gap-2 shadow-lg shadow-primary-container/25 hover:brightness-110 active:scale-[0.99] transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">add_photo_alternate</span>
                <span>Import Photo or RAW File</span>
              </button>

              {/* Format pills */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <span className="px-2 py-0.5 rounded-md bg-surface-container-lowest text-on-surface-variant font-mono text-[10px] border border-outline-variant">
                    Apple ProRAW
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-surface-container-lowest text-on-surface-variant font-mono text-[10px] border border-outline-variant">
                    DNG
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-surface-container-lowest text-on-surface-variant font-mono text-[10px] border border-outline-variant">
                    PNG / JPEG
                  </span>
                </div>
                <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5">
                  16-bit
                  <span className="material-symbols-outlined text-[13px]">bolt</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Sample Photos Shelf */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-bold text-on-surface tracking-tight">Sample Studio RAWs</h3>
              <span className="text-[10px] font-mono text-primary bg-surface-container-highest px-2 py-0.5 rounded-full font-bold">
                5 Included
              </span>
            </div>
            <span className="text-[11px] text-outline">Instant load</span>
          </div>

          {/* Horizontal Scroll Showcase of Samples */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
            {SAMPLE_IMAGES.map((sample) => (
              <div
                key={sample.id}
                onClick={() => onStartWithSample(sample)}
                className="flex-shrink-0 w-60 rounded-xl bg-surface-container-lowest border border-outline-variant overflow-hidden flex flex-col shadow-sm group cursor-pointer active:scale-98 transition-all hover:border-primary"
              >
                <div className="relative w-full h-36 bg-surface-container-low overflow-hidden">
                  <img
                    src={sample.url}
                    alt={sample.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/60 via-transparent to-transparent" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-md text-primary font-mono text-[10px] font-bold border border-outline-variant">
                    {sample.category}
                  </span>
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-surface-container-lowest/90 backdrop-blur-md text-on-surface-variant font-mono text-[9px]">
                    RAW
                  </span>
                </div>

                <div className="p-3 flex flex-col gap-1">
                  <h4 className="text-[13px] font-semibold text-on-surface group-hover:text-primary transition-colors truncate">
                    {sample.title}
                  </h4>
                  <p className="text-[11px] text-on-surface-variant truncate">{sample.subtitle}</p>
                  <div className="flex items-center justify-between font-mono text-[9px] text-outline pt-1">
                    <span>{sample.meta}</span>
                    <span className="text-primary font-bold">Load →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Projects (if any saved) */}
        {recentProjects.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-bold text-on-surface tracking-tight">Recent Projects</h3>
                <span className="text-[10px] font-mono text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded-full font-bold">
                  {recentProjects.length}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recentProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => onOpenProject(proj)}
                  className="rounded-xl bg-surface-container-lowest border border-outline-variant overflow-hidden flex flex-col p-2.5 gap-2 cursor-pointer hover:border-primary transition-all shadow-xs group"
                >
                  <div className="w-full aspect-[4/3] rounded-lg bg-surface-container-low overflow-hidden relative">
                    {proj.imageSrc && (
                      <img
                        src={proj.imageSrc}
                        alt={proj.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    )}
                    <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-white/90 text-primary font-mono text-[9px] font-bold shadow-xs">
                      {proj.activePresetId ? 'Graded' : 'Raw'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-[12px] font-semibold text-on-surface truncate">{proj.name}</h4>
                    <span className="text-[10px] font-mono text-outline">
                      {new Date(proj.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Curated Looks & Presets Carousel */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[16px] font-bold text-on-surface tracking-tight">Curated Film Looks</h3>
              <p className="text-[11px] text-on-surface-variant">One-tap analog film simulations & lab profiles</p>
            </div>
            <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
            {['All', 'Cinematic', 'Monochrome', '35mm Vintage', 'Editorial'].map((f) => (
              <button
                key={f}
                onClick={() => setLookFilter(f)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                  lookFilter === f
                    ? 'bg-primary-container text-white font-semibold shadow-xs'
                    : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high border border-outline-variant'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Look Cards */}
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
            {filteredLooks.map((look) => {
              const matchedSample = SAMPLE_IMAGES.find((s) => s.id === look.sampleId) || SAMPLE_IMAGES[0];
              return (
                <div
                  key={look.id}
                  onClick={() => onStartWithSample(matchedSample)}
                  className="flex-shrink-0 w-36 rounded-xl bg-surface-container-lowest border border-outline-variant overflow-hidden flex flex-col group shadow-xs cursor-pointer hover:border-primary transition-all"
                >
                  <div className="relative w-full h-32 bg-surface-container-low overflow-hidden">
                    <img
                      src={matchedSample.url}
                      alt={look.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest/80 via-transparent to-transparent" />
                    <span className="absolute bottom-1.5 left-2 text-[11px] text-on-surface font-semibold drop-shadow">
                      {look.name}
                    </span>
                  </div>
                  <div className="p-2 flex items-center justify-between">
                    <span className="font-mono text-[9px] text-outline">{look.subtitle}</span>
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      play_arrow
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Master Collections 2x2 Grid */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-on-surface tracking-tight">Master Collections</h3>
            <span className="text-[10px] font-mono text-outline">32 LUT Profiles</span>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <div
              onClick={() => onStartWithSample(SAMPLE_IMAGES[0])}
              className="rounded-xl bg-surface-container-lowest border border-outline-variant p-3.5 flex flex-col justify-between h-32 shadow-xs relative overflow-hidden group hover:border-primary transition-all cursor-pointer"
            >
              <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all" />
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">movie_filter</span>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant border border-outline-variant">
                  7 LUTs
                </span>
              </div>
              <div>
                <h4 className="text-[12px] font-semibold text-on-surface leading-tight">Cinematic 35mm</h4>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Hollywood Arri curves</p>
              </div>
            </div>

            <div
              onClick={() => onStartWithSample(SAMPLE_IMAGES[1])}
              className="rounded-xl bg-surface-container-lowest border border-outline-variant p-3.5 flex flex-col justify-between h-32 shadow-xs relative overflow-hidden group hover:border-primary transition-all cursor-pointer"
            >
              <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-secondary/10 rounded-full blur-xl group-hover:bg-secondary/20 transition-all" />
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">camera_roll</span>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant border border-outline-variant">
                  8 Packs
                </span>
              </div>
              <div>
                <h4 className="text-[12px] font-semibold text-on-surface leading-tight">Analog 1980s</h4>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Halation & Bleach bypass</p>
              </div>
            </div>

            <div
              onClick={() => onStartWithSample(SAMPLE_IMAGES[4])}
              className="rounded-xl bg-surface-container-lowest border border-outline-variant p-3.5 flex flex-col justify-between h-32 shadow-xs relative overflow-hidden group hover:border-primary transition-all cursor-pointer"
            >
              <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-tertiary/10 rounded-full blur-xl group-hover:bg-tertiary/20 transition-all" />
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[18px]">face</span>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant border border-outline-variant">
                  5 LUTs
                </span>
              </div>
              <div>
                <h4 className="text-[12px] font-semibold text-on-surface leading-tight">Editorial Portrait</h4>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Calibrated skin tones</p>
              </div>
            </div>

            <div
              onClick={() => onStartWithSample(SAMPLE_IMAGES[2])}
              className="rounded-xl bg-surface-container-lowest border border-outline-variant p-3.5 flex flex-col justify-between h-32 shadow-xs relative overflow-hidden group hover:border-primary transition-all cursor-pointer"
            >
              <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-all" />
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[18px]">contrast</span>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-surface-container-low text-on-surface-variant border border-outline-variant">
                  5 Profiles
                </span>
              </div>
              <div>
                <h4 className="text-[12px] font-semibold text-on-surface leading-tight">Dark Monochrome</h4>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Moody architectural blacks</p>
              </div>
            </div>
          </div>
        </div>

        {/* Engine Status & Cache Footnote Bar */}
        <div className="rounded-xl bg-surface-container-lowest border border-outline-variant px-3.5 py-2.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px] text-outline">Offline Engine Ready</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-primary text-[14px]">verified</span>
            <span className="text-[10px] text-on-surface font-medium">Fidelity v4.2 • GPU Accel</span>
          </div>
        </div>
      </main>

      {/* Bottom Tab Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/90 backdrop-blur-2xl border-t border-outline-variant">
        <div className="h-14 max-w-md mx-auto px-4 flex items-center justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] ${
              activeTab === 'home' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">photo_camera</span>
            <span className="text-[10px] font-medium">Studio</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span className="text-[10px] font-medium">Import</span>
          </button>

          <button
            onClick={onOpenSettings}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] ${
              activeTab === 'settings' ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
