import React, { useRef, useState } from 'react';
import { COLLAGE_LAYOUTS } from '../../data/collageLayouts';
import { SAMPLE_IMAGES } from '../../data/samples';

interface CollageStudioProps {
  onBack: () => void;
  onStartCollage: (images: string[]) => void;
}

export const CollageStudio: React.FC<CollageStudioProps> = ({
  onBack,
  onStartCollage,
}) => {
  const [selectedImages, setSelectedImages] = useState<string[]>([
    SAMPLE_IMAGES[0].url,
    SAMPLE_IMAGES[1].url,
    SAMPLE_IMAGES[2].url,
    SAMPLE_IMAGES[3].url,
  ]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readers: Promise<string>[] = Array.from(files).map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then((urls) => {
      setSelectedImages((prev) => [...prev, ...urls.filter(Boolean)]);
    });
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddSample = (url: string) => {
    setSelectedImages((prev) => [...prev, url]);
  };

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between selection:bg-primary-container selection:text-white">
      {/* Hidden Multi-file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesPicked}
        accept="image/*"
        multiple
        className="hidden"
      />

      {/* Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant shadow-xs">
        <div className="h-14 px-4 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors border border-outline-variant cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">grid_view</span>
              <h1 className="text-[16px] font-extrabold tracking-tight text-on-surface">
                COLLAGE STUDIO
              </h1>
              <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full uppercase">
                PHOTO GRIDS
              </span>
            </div>
          </div>

          <button
            onClick={() => onStartCollage(selectedImages)}
            disabled={selectedImages.length === 0}
            className="px-4 py-1.5 rounded-xl bg-primary text-white text-[12px] font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Create Collage</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 flex flex-col gap-6">
        {/* Selection Tray Hero */}
        <div className="w-full rounded-2xl bg-surface-container-lowest border border-outline-variant p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-bold text-on-surface">Selected Photographs</h2>
              <p className="text-[12px] text-on-surface-variant">
                Select 2 or more photos to automatically arrange into professional multi-slot layouts.
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-primary px-2.5 py-1 rounded-full bg-surface-container-high border border-outline-variant">
              {selectedImages.length} Photos Selected
            </span>
          </div>

          {/* Photos Grid Shelf */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {/* Add More Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center gap-1.5 text-outline hover:text-primary transition-all cursor-pointer bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[24px]">add_photo_alternate</span>
              <span className="text-[10px] font-bold uppercase">Add Photos</span>
            </button>

            {selectedImages.map((img, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant group shadow-xs"
              >
                <img src={img} alt={`Picked ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-error transition-all"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white font-mono text-[9px]">
                  #{idx + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Quick Sample Photos adder */}
          <div className="pt-2 border-t border-outline-variant flex items-center justify-between">
            <span className="text-[11px] text-outline">Or add from sample studio RAWs:</span>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {SAMPLE_IMAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleAddSample(s.url)}
                  className="px-2.5 py-1 rounded-md bg-surface-container-high hover:border-primary border border-outline-variant text-[10px] font-semibold text-on-surface cursor-pointer"
                >
                  + {s.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ready-made Layout Styles Showcase */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-on-surface">Available Layout Patterns</h3>
            <span className="text-[10px] font-mono text-outline">2 to 12 Photos Supported</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {COLLAGE_LAYOUTS.slice(0, 8).map((layout) => (
              <div
                key={layout.id}
                onClick={() => onStartCollage(selectedImages)}
                className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant flex flex-col gap-2 hover:border-primary cursor-pointer transition-all shadow-xs"
              >
                <div className="w-full h-24 rounded-lg bg-surface-container-high border border-outline-variant/60 relative overflow-hidden flex items-center justify-center">
                  <div className="w-full h-full p-1.5 grid grid-cols-2 gap-1 pointer-events-none opacity-80">
                    {layout.slots.slice(0, 4).map((_, i) => (
                      <div key={i} className="bg-primary/25 rounded-xs" />
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[12px] font-bold text-on-surface truncate">{layout.name}</h4>
                  <span className="text-[10px] font-mono text-outline">
                    {layout.photoCount} Photos • {layout.style}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
