import React, { useCallback, useEffect, useRef, useState } from 'react';
import { COLLAGE_LAYOUTS } from '../../data/collageLayouts';
import { canvasToBlob, renderCollageProject } from '../../engine/designRenderer';
import { StorageService } from '../../services/storage';
import { ExportService } from '../../services/exportService';
import {
  CanvasBackground,
  CollageLayoutDefinition,
  CollageProject,
  CollageSlot,
  DesignElement,
} from '../../types/design';

interface CollageEditorProps {
  initialImages?: string[];
  existingProject?: CollageProject;
  onBack: () => void;
  onSave?: (project: CollageProject) => void;
}

export const CollageEditor: React.FC<CollageEditorProps> = ({
  initialImages = [],
  existingProject,
  onBack,
  onSave,
}) => {
  // Find matching default layout
  const defaultLayout =
    COLLAGE_LAYOUTS.find((l) => l.photoCount === Math.max(2, Math.min(initialImages.length, 12))) ||
    COLLAGE_LAYOUTS[0];

  const [project, setProject] = useState<CollageProject>(() => {
    if (existingProject) return existingProject;

    // Build initial slots from default layout and provided initial images
    const initialSlots: CollageSlot[] = defaultLayout.slots.map((s, idx) => ({
      ...s,
      imageSrc: initialImages[idx] || undefined,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
    }));

    return {
      id: 'collage-' + Date.now(),
      name: 'Photo Collage',
      type: 'collage',
      width: 1080,
      height: 1080,
      aspectRatio: defaultLayout.aspectRatio,
      layoutId: defaultLayout.id,
      slots: initialSlots,
      spacing: 12,
      padding: 16,
      cornerRadius: 12,
      borderWidth: 0,
      borderColor: '#ffffff',
      background: { type: 'color', value: '#fff8f7' },
      isFreeform: false,
      freeformElements: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'layout' | 'slot' | 'style' | 'freeform'>('layout');
  const [isExporting, setIsExporting] = useState(false);

  // Undo / Redo
  const [historyPast, setHistoryPast] = useState<CollageProject[]>([]);
  const [historyFuture, setHistoryFuture] = useState<CollageProject[]>([]);
  const isInteractingRef = useRef(false);
  const preSnapshotRef = useRef<CollageProject | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const commitSnapshot = useCallback(() => {
    setHistoryPast((past) => [...past.slice(-20), JSON.parse(JSON.stringify(project))]);
    setHistoryFuture([]);
  }, [project]);

  const handleInteractionStart = () => {
    if (!isInteractingRef.current) {
      preSnapshotRef.current = JSON.parse(JSON.stringify(project));
      isInteractingRef.current = true;
    }
  };

  const handleInteractionEnd = () => {
    if (isInteractingRef.current && preSnapshotRef.current) {
      if (JSON.stringify(preSnapshotRef.current) !== JSON.stringify(project)) {
        setHistoryPast((past) => [...past.slice(-20), preSnapshotRef.current!]);
        setHistoryFuture([]);
      }
      isInteractingRef.current = false;
      preSnapshotRef.current = null;
    }
  };

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryFuture((fut) => [JSON.parse(JSON.stringify(project)), ...fut]);
    setHistoryPast((past) => past.slice(0, -1));
    setProject(prev);
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryPast((past) => [...past.slice(-20), JSON.parse(JSON.stringify(project))]);
    setHistoryFuture((fut) => fut.slice(1));
    setProject(next);
  };

  // Re-render canvas
  useEffect(() => {
    let active = true;
    if (canvasRef.current) {
      renderCollageProject(project, canvasRef.current, 0.45).catch((err) => {
        if (active) console.error('Collage render error', err);
      });
    }
    return () => {
      active = false;
    };
  }, [project]);

  // Selected slot
  const selectedSlot = project.slots.find((s) => s.id === selectedSlotId) || null;

  // Change layout without losing existing images
  const handleSelectLayout = (layout: CollageLayoutDefinition) => {
    commitSnapshot();
    const existingImages = project.slots.map((s) => s.imageSrc).filter(Boolean) as string[];

    const newSlots: CollageSlot[] = layout.slots.map((s, idx) => ({
      ...s,
      imageSrc: existingImages[idx] || undefined,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
    }));

    // Update canvas aspect ratio
    let width = 1080;
    let height = 1080;
    if (layout.aspectRatio === '4:5') height = 1350;
    if (layout.aspectRatio === '9:16') height = 1920;
    if (layout.aspectRatio === '16:9') height = 608;
    if (layout.aspectRatio === '3:2') height = 720;

    setProject((prev) => ({
      ...prev,
      width,
      height,
      aspectRatio: layout.aspectRatio,
      layoutId: layout.id,
      slots: newSlots,
    }));
  };

  // Replace photo in active slot
  const handleTriggerReplacePhoto = (slotId: string) => {
    setSelectedSlotId(slotId);
    fileInputRef.current?.click();
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSlotId) return;

    commitSnapshot();
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        setProject((prev) => ({
          ...prev,
          slots: prev.slots.map((s) =>
            s.id === selectedSlotId
              ? { ...s, imageSrc: src, zoom: 1, offsetX: 0, offsetY: 0 }
              : s
          ),
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Swap photos between two slots
  const handleSwapSlots = (targetSlotId: string) => {
    if (!selectedSlotId || selectedSlotId === targetSlotId) return;
    commitSnapshot();

    const slotA = project.slots.find((s) => s.id === selectedSlotId);
    const slotB = project.slots.find((s) => s.id === targetSlotId);
    if (!slotA || !slotB) return;

    const imgA = slotA.imageSrc;
    const imgB = slotB.imageSrc;

    setProject((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => {
        if (s.id === selectedSlotId) return { ...s, imageSrc: imgB };
        if (s.id === targetSlotId) return { ...s, imageSrc: imgA };
        return s;
      }),
    }));
  };

  // Remove photo from slot
  const handleRemovePhoto = (slotId: string) => {
    commitSnapshot();
    setProject((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === slotId ? { ...s, imageSrc: undefined } : s)),
    }));
  };

  // Update selected slot parameters (zoom, offset)
  const updateSlot = (slotId: string, partial: Partial<CollageSlot>) => {
    setProject((prev) => ({
      ...prev,
      slots: prev.slots.map((s) => (s.id === slotId ? { ...s, ...partial } : s)),
    }));
  };

  // Save project
  const handleSaveProject = async () => {
    const updated = { ...project, updatedAt: Date.now() };
    await StorageService.saveProject(updated as any);
    onSave?.(updated);
    alert('Collage saved to My Projects!');
  };

  // Export collage
  const handleExport = async (format: 'png' | 'jpeg' = 'png') => {
    setIsExporting(true);
    try {
      const exportCanvas = document.createElement('canvas');
      await renderCollageProject(project, exportCanvas, 1);
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const blob = await canvasToBlob(exportCanvas, format, 0.95);
      const fileName = `${project.name.replace(/\s+/g, '_')}.${format}`;
      const result = await ExportService.saveExportedFile(blob, fileName, mime, {
        dialogTitle: 'Save or Share Collage',
        shareText: `Chroma Studio Collage: ${project.name}`,
      });
      if (!result.success) {
        alert(result.error || 'Failed to export collage.');
      }
    } catch (err: any) {
      console.error('Export error', err);
      alert(err?.message || 'Failed to export collage.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between overflow-hidden selection:bg-primary-container selection:text-white">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilePicked}
        accept="image/*"
        className="hidden"
      />

      {/* Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant shadow-xs">
        <div className="h-14 px-4 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors border border-outline-variant cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div>
              <h2 className="text-[14px] font-bold text-on-surface leading-tight">{project.name}</h2>
              <span className="text-[10px] font-mono text-outline">
                {project.aspectRatio} • {project.slots.length} Photos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={historyPast.length === 0}
              className={`w-8 h-8 rounded-lg flex items-center justify-center border border-outline-variant transition-all ${
                historyPast.length > 0
                  ? 'bg-surface-container-lowest text-on-surface hover:border-primary cursor-pointer'
                  : 'bg-surface-container-lowest text-outline opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">undo</span>
            </button>
            <button
              onClick={handleRedo}
              disabled={historyFuture.length === 0}
              className={`w-8 h-8 rounded-lg flex items-center justify-center border border-outline-variant transition-all ${
                historyFuture.length > 0
                  ? 'bg-surface-container-lowest text-on-surface hover:border-primary cursor-pointer'
                  : 'bg-surface-container-lowest text-outline opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">redo</span>
            </button>

            <button
              onClick={handleSaveProject}
              className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant text-[11px] font-semibold text-on-surface hover:border-primary flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">save</span>
              <span className="hidden sm:inline">Save</span>
            </button>

            <button
              onClick={() => handleExport('png')}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-[12px] font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Studio Viewport */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row gap-4 items-center justify-center overflow-y-auto">
        {/* Canvas Display */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[380px] w-full relative">
          <div className="relative shadow-2xl rounded-2xl overflow-hidden border-2 border-outline-variant bg-surface-container-low max-w-full max-h-[70vh] flex items-center justify-center">
            <canvas ref={canvasRef} className="block max-w-full max-h-[70vh] object-contain" />
          </div>

          <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-outline">
            <span>Select slot to zoom, pan, swap or replace</span>
          </div>
        </div>

        {/* Controls Panel */}
        <div className="w-full md:w-80 bg-surface-container-lowest rounded-2xl border border-outline-variant p-3.5 flex flex-col gap-3 shadow-sm max-h-[78vh] overflow-y-auto">
          {/* Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-surface-container-low rounded-xl border border-outline-variant">
            {(['layout', 'slot', 'style', 'freeform'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-surface-container-highest text-primary shadow-xs'
                    : 'text-outline hover:text-on-surface'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Layouts Tab: Choose Grid Arragement */}
          {activeTab === 'layout' && (
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-bold text-on-surface">Choose Layout</span>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {COLLAGE_LAYOUTS.map((layout) => (
                  <button
                    key={layout.id}
                    onClick={() => handleSelectLayout(layout)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                      project.layoutId === layout.id
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-outline-variant bg-surface-container-low hover:border-outline'
                    }`}
                  >
                    <div className="w-full h-12 bg-surface-container-highest rounded-lg border border-outline-variant flex items-center justify-center relative overflow-hidden">
                      <div className="grid grid-cols-2 w-full h-full p-1 gap-0.5 pointer-events-none">
                        {layout.slots.slice(0, 4).map((_, i) => (
                          <div key={i} className="bg-primary/20 rounded-xs" />
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-bold text-on-surface truncate">
                        {layout.name}
                      </h4>
                      <span className="text-[9px] font-mono text-outline">
                        {layout.photoCount} Photos • {layout.aspectRatio}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Slot Customization Tab */}
          {activeTab === 'slot' && (
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-bold text-on-surface">Photo Slots</span>

              <div className="grid grid-cols-3 gap-2">
                {project.slots.map((slot, index) => (
                  <button
                    key={slot.id}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      selectedSlotId === slot.id
                        ? 'border-primary bg-primary/10 font-bold'
                        : 'border-outline-variant bg-surface-container-low'
                    }`}
                  >
                    <div className="w-full h-14 rounded-lg bg-surface-container-lowest overflow-hidden border border-outline-variant flex items-center justify-center">
                      {slot.imageSrc ? (
                        <img
                          src={slot.imageSrc}
                          alt={`Slot ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-outline text-[18px]">
                          add_photo_alternate
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-on-surface">Slot {index + 1}</span>
                  </button>
                ))}
              </div>

              {selectedSlot && (
                <div className="p-3 bg-surface-container-low rounded-xl border border-primary space-y-3 mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-on-surface">
                      Slot Selected
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTriggerReplacePhoto(selectedSlot.id)}
                        className="px-2 py-1 rounded bg-primary text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px]">refresh</span>
                        <span>Replace</span>
                      </button>
                      <button
                        onClick={() => handleRemovePhoto(selectedSlot.id)}
                        className="p-1 rounded text-error hover:bg-error/10 cursor-pointer"
                        title="Remove photo"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Zoom Slider */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-outline">Zoom</span>
                      <span className="font-mono text-primary">
                        {Math.round((selectedSlot.zoom || 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={selectedSlot.zoom || 1}
                      onPointerDown={handleInteractionStart}
                      onPointerUp={handleInteractionEnd}
                      onChange={(e) =>
                        updateSlot(selectedSlot.id, { zoom: parseFloat(e.target.value) })
                      }
                      className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Pan Offset Sliders */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] text-outline">Pan X</span>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        value={selectedSlot.offsetX || 0}
                        onPointerDown={handleInteractionStart}
                        onPointerUp={handleInteractionEnd}
                        onChange={(e) =>
                          updateSlot(selectedSlot.id, { offsetX: parseInt(e.target.value, 10) })
                        }
                        className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-outline">Pan Y</span>
                      <input
                        type="range"
                        min="-150"
                        max="150"
                        value={selectedSlot.offsetY || 0}
                        onPointerDown={handleInteractionStart}
                        onPointerUp={handleInteractionEnd}
                        onChange={(e) =>
                          updateSlot(selectedSlot.id, { offsetY: parseInt(e.target.value, 10) })
                        }
                        className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Swap With Other Slot */}
                  <div className="pt-2 border-t border-outline-variant">
                    <span className="text-[10px] font-bold text-outline uppercase block mb-1">
                      Swap with slot:
                    </span>
                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                      {project.slots
                        .filter((s) => s.id !== selectedSlot.id)
                        .map((s, idx) => (
                          <button
                            key={s.id}
                            onClick={() => handleSwapSlots(s.id)}
                            className="px-2 py-1 rounded bg-surface-container-lowest border border-outline-variant text-[10px] font-mono hover:border-primary cursor-pointer"
                          >
                            Slot {idx + 1}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Styling: Spacing, Borders, Background */}
          {activeTab === 'style' && (
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-bold text-on-surface">Collage Geometry & Styling</span>

              {/* Spacing Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-outline">Grid Spacing</span>
                  <span className="font-mono text-primary">{project.spacing}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={project.spacing}
                  onPointerDown={handleInteractionStart}
                  onPointerUp={handleInteractionEnd}
                  onChange={(e) =>
                    setProject((prev) => ({ ...prev, spacing: parseInt(e.target.value, 10) }))
                  }
                  className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer"
                />
              </div>

              {/* Padding Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-outline">Outer Margin</span>
                  <span className="font-mono text-primary">{project.padding}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="48"
                  value={project.padding}
                  onPointerDown={handleInteractionStart}
                  onPointerUp={handleInteractionEnd}
                  onChange={(e) =>
                    setProject((prev) => ({ ...prev, padding: parseInt(e.target.value, 10) }))
                  }
                  className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer"
                />
              </div>

              {/* Corner Radius */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-outline">Corner Radius</span>
                  <span className="font-mono text-primary">{project.cornerRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="48"
                  value={project.cornerRadius}
                  onPointerDown={handleInteractionStart}
                  onPointerUp={handleInteractionEnd}
                  onChange={(e) =>
                    setProject((prev) => ({ ...prev, cornerRadius: parseInt(e.target.value, 10) }))
                  }
                  className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer"
                />
              </div>

              {/* Border Width & Color */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-outline-variant">
                <div className="space-y-1">
                  <span className="text-[10px] text-outline">Border Width</span>
                  <input
                    type="number"
                    min="0"
                    max="16"
                    value={project.borderWidth}
                    onChange={(e) => {
                      commitSnapshot();
                      setProject((prev) => ({
                        ...prev,
                        borderWidth: parseInt(e.target.value, 10) || 0,
                      }));
                    }}
                    className="w-full p-1 text-[11px] bg-surface-container-low border border-outline-variant rounded-lg font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-outline">Border Color</span>
                  <input
                    type="color"
                    value={project.borderColor || '#ffffff'}
                    onChange={(e) => {
                      commitSnapshot();
                      setProject((prev) => ({ ...prev, borderColor: e.target.value }));
                    }}
                    className="w-full h-8 rounded border border-outline-variant cursor-pointer p-0"
                  />
                </div>
              </div>

              {/* Background Color Swatches */}
              <div className="space-y-1.5 pt-1 border-t border-outline-variant">
                <span className="text-[10px] font-bold uppercase text-outline">Background</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={project.background.value.startsWith('#') ? project.background.value : '#fff8f7'}
                    onChange={(e) => {
                      commitSnapshot();
                      setProject((prev) => ({
                        ...prev,
                        background: { type: 'color', value: e.target.value },
                      }));
                    }}
                    className="w-10 h-10 rounded border border-outline-variant cursor-pointer p-0"
                  />
                  <div className="flex flex-wrap gap-1">
                    {['#fff8f7', '#140000', '#281715', '#ffffff', '#e6bdb8'].map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          commitSnapshot();
                          setProject((prev) => ({
                            ...prev,
                            background: { type: 'color', value: c },
                          }));
                        }}
                        className="w-6 h-6 rounded-md border border-outline-variant cursor-pointer"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Freeform Arrangement Mode */}
          {activeTab === 'freeform' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-on-surface">Freeform Mode</span>
                <button
                  onClick={() => {
                    commitSnapshot();
                    setProject((prev) => ({ ...prev, isFreeform: !prev.isFreeform }));
                  }}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                    project.isFreeform
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-container-low text-on-surface border-outline-variant'
                  }`}
                >
                  {project.isFreeform ? 'Active' : 'Disabled'}
                </button>
              </div>

              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Freeform mode enables absolute positioning, rotation, layering, and freely floating photos outside rigid grid borders.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
