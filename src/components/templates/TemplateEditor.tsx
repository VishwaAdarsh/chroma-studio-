import React, { useCallback, useEffect, useRef, useState } from 'react';
import { canvasToBlob, renderDesignProject } from '../../engine/designRenderer';
import { StorageService } from '../../services/storage';
import { ExportService } from '../../services/exportService';
import {
  CanvasBackground,
  DesignElement,
  DesignProject,
  ImageDesignElement,
  ReadyMadeTemplate,
  TextDesignElement,
} from '../../types/design';

interface TemplateEditorProps {
  initialTemplate?: ReadyMadeTemplate;
  existingProject?: DesignProject;
  onBack: () => void;
  onSave?: (project: DesignProject) => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({
  initialTemplate,
  existingProject,
  onBack,
  onSave,
}) => {
  // Initialize project state
  const [project, setProject] = useState<DesignProject>(() => {
    if (existingProject) return existingProject;
    if (initialTemplate) {
      return {
        id: 'tmpl-proj-' + Date.now(),
        name: `${initialTemplate.name} Design`,
        type: 'template',
        templateId: initialTemplate.id,
        width: initialTemplate.width,
        height: initialTemplate.height,
        background: { ...initialTemplate.background },
        elements: JSON.parse(JSON.stringify(initialTemplate.elements)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
    // Fallback square design
    return {
      id: 'tmpl-proj-' + Date.now(),
      name: 'Untitled Design',
      type: 'template',
      width: 1080,
      height: 1080,
      background: { type: 'color', value: '#fff8f7' },
      elements: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  // Active element selection
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'photos' | 'text' | 'layers' | 'background'>('photos');
  const [isExporting, setIsExporting] = useState(false);

  // Undo / Redo History
  const [historyPast, setHistoryPast] = useState<DesignProject[]>([]);
  const [historyFuture, setHistoryFuture] = useState<DesignProject[]>([]);
  const isInteractingRef = useRef(false);
  const preSnapshotRef = useRef<DesignProject | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replacingPlaceholderIdRef = useRef<string | null>(null);

  // Push history snapshot
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
    const previous = historyPast[historyPast.length - 1];
    setHistoryFuture((fut) => [JSON.parse(JSON.stringify(project)), ...fut]);
    setHistoryPast((past) => past.slice(0, -1));
    setProject(previous);
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryPast((past) => [...past.slice(-20), JSON.parse(JSON.stringify(project))]);
    setHistoryFuture((fut) => fut.slice(1));
    setProject(next);
  };

  // Render project onto canvas whenever project updates
  useEffect(() => {
    let active = true;
    if (canvasRef.current) {
      renderDesignProject(project, canvasRef.current, 0.45).catch((err) => {
        if (active) console.error('Canvas render error', err);
      });
    }
    return () => {
      active = false;
    };
  }, [project]);

  // Selected element
  const selectedElement = project.elements.find((e) => e.id === selectedElementId) || null;

  // Image placeholders
  const imageElements = project.elements.filter(
    (e): e is ImageDesignElement => e.type === 'image'
  );

  // Replace photo handler
  const handleTriggerReplacePhoto = (elementId: string) => {
    replacingPlaceholderIdRef.current = elementId;
    fileInputRef.current?.click();
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = replacingPlaceholderIdRef.current;
    if (!file || !targetId) return;

    commitSnapshot();
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        setProject((prev) => ({
          ...prev,
          elements: prev.elements.map((el) => {
            if (el.id === targetId && el.type === 'image') {
              return {
                ...el,
                src,
                zoom: 1,
                offsetX: 0,
                offsetY: 0,
              };
            }
            return el;
          }),
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Update specific element property
  const updateElement = <T extends DesignElement>(id: string, partial: Partial<T>) => {
    setProject((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        if (el.id === id) {
          return { ...el, ...partial } as DesignElement;
        }
        return el;
      }),
    }));
  };

  // Change background
  const handleBackgroundChange = (bg: CanvasBackground) => {
    commitSnapshot();
    setProject((prev) => ({ ...prev, background: bg }));
  };

  // Add new text element
  const handleAddText = () => {
    commitSnapshot();
    const newText: TextDesignElement = {
      id: 'text-' + Date.now(),
      type: 'text',
      text: 'Double tap to edit',
      fontFamily: 'Inter, sans-serif',
      fontSize: 28,
      color: '#281715',
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'left',
      x: project.width * 0.2,
      y: project.height * 0.4,
      width: project.width * 0.6,
      height: 60,
      rotation: 0,
      opacity: 1,
      zIndex: project.elements.length + 1,
      visible: true,
    };

    setProject((prev) => ({
      ...prev,
      elements: [...prev.elements, newText],
    }));
    setSelectedElementId(newText.id);
    setActiveTab('text');
  };

  // Duplicate element
  const handleDuplicateElement = (id: string) => {
    const el = project.elements.find((e) => e.id === id);
    if (!el) return;
    commitSnapshot();
    const copy: DesignElement = {
      ...JSON.parse(JSON.stringify(el)),
      id: 'el-' + Date.now(),
      x: el.x + 20,
      y: el.y + 20,
      zIndex: project.elements.length + 1,
    };
    setProject((prev) => ({ ...prev, elements: [...prev.elements, copy] }));
    setSelectedElementId(copy.id);
  };

  // Delete element
  const handleDeleteElement = (id: string) => {
    commitSnapshot();
    setProject((prev) => ({
      ...prev,
      elements: prev.elements.filter((e) => e.id !== id),
    }));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  // Save project
  const handleSaveProject = async () => {
    const updatedProject = { ...project, updatedAt: Date.now() };
    await StorageService.saveProject(updatedProject as any);
    onSave?.(updatedProject);
    alert('Template design saved to My Projects!');
  };

  // Master High-Resolution Export
  const handleExport = async (format: 'png' | 'jpeg' = 'png') => {
    setIsExporting(true);
    try {
      const exportCanvas = document.createElement('canvas');
      await renderDesignProject(project, exportCanvas, 1);
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const blob = await canvasToBlob(exportCanvas, format, 0.95);
      const fileName = `${project.name.replace(/\s+/g, '_')}_design.${format}`;
      const result = await ExportService.saveExportedFile(blob, fileName, mime, {
        dialogTitle: 'Save or Share Template Design',
        shareText: `Chroma Studio Design: ${project.name}`,
      });
      if (!result.success) {
        alert(result.error || 'Failed to export design.');
      }
    } catch (err: any) {
      console.error('Export error', err);
      alert(err?.message || 'Failed to export design.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between overflow-hidden selection:bg-primary-container selection:text-white">
      {/* Hidden File Input for Image Replacement */}
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
          {/* Back & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors border border-outline-variant cursor-pointer"
              title="Back"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div>
              <h2 className="text-[14px] font-bold text-on-surface leading-tight truncate max-w-[200px] sm:max-w-xs">
                {project.name}
              </h2>
              <span className="text-[10px] font-mono text-outline">
                {project.width} × {project.height}px
              </span>
            </div>
          </div>

          {/* History & Export */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={historyPast.length === 0}
              className={`w-8 h-8 rounded-lg flex items-center justify-center border border-outline-variant transition-all ${
                historyPast.length > 0
                  ? 'bg-surface-container-lowest text-on-surface hover:border-primary cursor-pointer'
                  : 'bg-surface-container-lowest text-outline opacity-40 cursor-not-allowed'
              }`}
              title="Undo"
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
              title="Redo"
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

      {/* Main Workspace Layout */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row gap-4 items-center justify-center overflow-y-auto">
        {/* Left/Center Canvas Viewport */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[380px] w-full relative">
          <div className="relative shadow-2xl rounded-xl overflow-hidden border-2 border-outline-variant bg-surface-container-low max-w-full max-h-[70vh] flex items-center justify-center">
            <canvas ref={canvasRef} className="block max-w-full max-h-[70vh] object-contain" />
          </div>

          <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-outline">
            <span>Tap placeholder on right panel to replace photo</span>
          </div>
        </div>

        {/* Right Editor Side Panel */}
        <div className="w-full md:w-80 bg-surface-container-lowest rounded-2xl border border-outline-variant p-3.5 flex flex-col gap-3 shadow-sm max-h-[78vh] overflow-y-auto">
          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-surface-container-low rounded-xl border border-outline-variant">
            {(['photos', 'text', 'background', 'layers'] as const).map((tab) => (
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

          {/* Photos Tab: One-Tap Photo Replacement & Controls */}
          {activeTab === 'photos' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-on-surface">Photo Slots</span>
                <span className="text-[10px] font-mono text-primary font-bold">
                  {imageElements.length} Available
                </span>
              </div>

              {imageElements.length === 0 ? (
                <div className="p-4 text-center text-outline text-[11px] bg-surface-container-low rounded-xl">
                  No photo placeholders found in this template.
                </div>
              ) : (
                imageElements.map((imgEl, index) => (
                  <div
                    key={imgEl.id}
                    className={`p-3 rounded-xl border transition-all ${
                      selectedElementId === imgEl.id
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-on-surface">
                        Slot {index + 1}: {imgEl.placeholderLabel || 'Photo'}
                      </span>
                      <button
                        onClick={() => handleTriggerReplacePhoto(imgEl.id)}
                        className="px-2.5 py-1 rounded-md bg-primary text-white text-[10px] font-bold flex items-center gap-1 shadow-xs hover:brightness-110 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px]">add_photo_alternate</span>
                        <span>Replace</span>
                      </button>
                    </div>

                    {/* Preview Thumbnail of current photo */}
                    <div className="w-full h-24 rounded-lg bg-surface-container-lowest overflow-hidden border border-outline-variant relative mb-2">
                      {imgEl.src ? (
                        <img
                          src={imgEl.src}
                          alt="Slot preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-outline gap-1">
                          <span className="material-symbols-outlined text-[20px]">photo</span>
                          <span className="text-[9px]">Empty Slot</span>
                        </div>
                      )}
                    </div>

                    {/* Zoom & Offset adjustments */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-outline">Zoom</span>
                        <span className="font-mono text-primary">
                          {Math.round((imgEl.zoom || 1) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={imgEl.zoom || 1}
                        onPointerDown={handleInteractionStart}
                        onPointerUp={handleInteractionEnd}
                        onChange={(e) =>
                          updateElement<ImageDesignElement>(imgEl.id, {
                            zoom: parseFloat(e.target.value),
                          })
                        }
                        className="w-full h-1.5 bg-surface-container-high rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Text Tab: Add, Edit, Font & Color */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-on-surface">Text Elements</span>
                <button
                  onClick={handleAddText}
                  className="px-2 py-1 rounded bg-surface-container-high text-primary text-[10px] font-bold flex items-center gap-1 hover:border-primary border border-outline-variant cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">add</span>
                  <span>Add Text</span>
                </button>
              </div>

              {selectedElement && selectedElement.type === 'text' ? (
                <div className="p-3 bg-surface-container-low rounded-xl border border-primary space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-outline">Content</label>
                    <textarea
                      value={(selectedElement as TextDesignElement).text}
                      onChange={(e) => {
                        commitSnapshot();
                        updateElement<TextDesignElement>(selectedElement.id, { text: e.target.value });
                      }}
                      rows={3}
                      className="w-full p-2 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:border-primary resize-none"
                    />
                  </div>

                  {/* Font Family */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-outline">Font</label>
                    <select
                      value={(selectedElement as TextDesignElement).fontFamily}
                      onChange={(e) => {
                        commitSnapshot();
                        updateElement<TextDesignElement>(selectedElement.id, {
                          fontFamily: e.target.value,
                        });
                      }}
                      className="w-full p-1.5 text-[11px] bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface focus:outline-none"
                    >
                      <option value="Inter, sans-serif">Inter (Modern Sans)</option>
                      <option value="Cinzel, Georgia, serif">Cinzel (Editorial Serif)</option>
                      <option value="monospace">Monospace (Terminal / Data)</option>
                      <option value="Georgia, serif">Georgia (Classic)</option>
                    </select>
                  </div>

                  {/* Font Size & Color */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-outline">Size</label>
                      <input
                        type="number"
                        min="10"
                        max="140"
                        value={(selectedElement as TextDesignElement).fontSize}
                        onChange={(e) => {
                          commitSnapshot();
                          updateElement<TextDesignElement>(selectedElement.id, {
                            fontSize: parseInt(e.target.value, 10) || 16,
                          });
                        }}
                        className="w-full p-1 text-[11px] bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-outline">Color</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={(selectedElement as TextDesignElement).color || '#281715'}
                          onChange={(e) => {
                            commitSnapshot();
                            updateElement<TextDesignElement>(selectedElement.id, {
                              color: e.target.value,
                            });
                          }}
                          className="w-8 h-8 rounded border border-outline-variant cursor-pointer p-0"
                        />
                        <span className="text-[10px] font-mono text-outline">
                          {(selectedElement as TextDesignElement).color}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Alignment & Weight */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => {
                          commitSnapshot();
                          updateElement<TextDesignElement>(selectedElement.id, { textAlign: align });
                        }}
                        className={`flex-1 py-1 rounded text-[10px] font-bold uppercase border cursor-pointer ${
                          (selectedElement as TextDesignElement).textAlign === align
                            ? 'bg-primary text-white border-primary'
                            : 'bg-surface-container-lowest text-on-surface border-outline-variant'
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>

                  {/* Actions: Duplicate / Delete */}
                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                    <button
                      onClick={() => handleDuplicateElement(selectedElement.id)}
                      className="text-[10px] font-semibold text-on-surface hover:text-primary flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">content_copy</span>
                      <span>Duplicate</span>
                    </button>
                    <button
                      onClick={() => handleDeleteElement(selectedElement.id)}
                      className="text-[10px] font-semibold text-error hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px]">delete</span>
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-[11px] text-outline">Select text to customize:</span>
                  {project.elements
                    .filter((e): e is TextDesignElement => e.type === 'text')
                    .map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedElementId(t.id)}
                        className="w-full p-2 rounded-lg bg-surface-container-low border border-outline-variant text-left hover:border-primary truncate text-[11px] font-semibold cursor-pointer"
                      >
                        {t.text || 'Empty Text'}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Background Customization */}
          {activeTab === 'background' && (
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-bold text-on-surface">Canvas Background</span>

              {/* Preset Gradients */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Warm Fidelity', val: 'linear-gradient(135deg, #fff8f7, #ffe9e6)' },
                  { name: 'Obsidian Night', val: 'linear-gradient(135deg, #281715, #140000)' },
                  { name: 'Crimson Glow', val: 'linear-gradient(135deg, #bf0411, #700f0c)' },
                  { name: 'Minimal Ivory', val: 'linear-gradient(135deg, #ffffff, #fff0ee)' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleBackgroundChange({ type: 'gradient', value: preset.val })}
                    className="p-2 rounded-lg border border-outline-variant text-left flex flex-col gap-1.5 hover:border-primary cursor-pointer"
                  >
                    <div
                      className="w-full h-8 rounded-md border border-outline-variant/40"
                      style={{ background: preset.val }}
                    />
                    <span className="text-[10px] font-bold text-on-surface truncate">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Solid Color Picker */}
              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant space-y-2">
                <span className="text-[10px] font-bold uppercase text-outline">Solid Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={project.background.value.startsWith('#') ? project.background.value : '#fff8f7'}
                    onChange={(e) => handleBackgroundChange({ type: 'color', value: e.target.value })}
                    className="w-10 h-10 rounded border border-outline-variant cursor-pointer p-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-mono text-on-surface font-semibold">
                      {project.background.value}
                    </span>
                    <span className="text-[9px] text-outline">Click swatch to pick color</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Layers List */}
          {activeTab === 'layers' && (
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-bold text-on-surface">Layers Order</span>
              <div className="space-y-1">
                {[...project.elements].reverse().map((el) => (
                  <div
                    key={el.id}
                    onClick={() => setSelectedElementId(el.id)}
                    className={`p-2 rounded-lg border flex items-center justify-between text-[11px] cursor-pointer transition-all ${
                      selectedElementId === el.id
                        ? 'border-primary bg-primary/10 font-bold'
                        : 'border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="material-symbols-outlined text-[15px] text-primary">
                        {el.type === 'image' ? 'image' : el.type === 'text' ? 'title' : 'category'}
                      </span>
                      <span className="truncate">
                        {el.type === 'text'
                          ? (el as TextDesignElement).text
                          : el.type === 'image'
                          ? (el as ImageDesignElement).placeholderLabel || 'Photo'
                          : 'Shape'}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteElement(el.id);
                      }}
                      className="text-outline hover:text-error"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
