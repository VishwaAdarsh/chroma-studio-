import React, { useCallback, useEffect, useRef, useState } from 'react';
import { canvasToBlob, renderCarouselSlide } from '../../engine/designRenderer';
import { StorageService } from '../../services/storage';
import { ExportService } from '../../services/exportService';
import {
  CarouselFormat,
  CarouselProject,
  CarouselSlide,
  DesignElement,
  ImageDesignElement,
  TextDesignElement,
} from '../../types/design';
import { CarouselFamilyDefinition } from '../../data/carouselTemplates';

interface CarouselEditorProps {
  initialFamily?: CarouselFamilyDefinition;
  existingProject?: CarouselProject;
  onBack: () => void;
  onSave?: (project: CarouselProject) => void;
}

export const CarouselEditor: React.FC<CarouselEditorProps> = ({
  initialFamily,
  existingProject,
  onBack,
  onSave,
}) => {
  const [project, setProject] = useState<CarouselProject>(() => {
    if (existingProject) return existingProject;
    if (initialFamily) {
      let width = 1080;
      let height = 1350; // default 4:5
      if (initialFamily.format === '1:1') height = 1080;
      if (initialFamily.format === '9:16') height = 1920;
      if (initialFamily.format === '16:9') height = 608;

      return {
        id: 'carousel-' + Date.now(),
        name: initialFamily.name,
        type: 'carousel',
        format: initialFamily.format,
        width,
        height,
        slides: JSON.parse(JSON.stringify(initialFamily.slides)),
        activeSlideIndex: 0,
        theme: { ...initialFamily.theme },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    return {
      id: 'carousel-' + Date.now(),
      name: 'Instagram Carousel Post',
      type: 'carousel',
      format: '4:5',
      width: 1080,
      height: 1350,
      slides: [],
      activeSlideIndex: 0,
      theme: {
        fontFamily: 'Inter, sans-serif',
        primaryColor: '#bf0411',
        accentColor: '#ffe2de',
        bgColor: '#fff8f7',
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'photos' | 'text' | 'slides' | 'style'>('photos');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');

  // Undo / Redo
  const [historyPast, setHistoryPast] = useState<CarouselProject[]>([]);
  const [historyFuture, setHistoryFuture] = useState<CarouselProject[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const singleFileInputRef = useRef<HTMLInputElement | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);
  const targetElementIdRef = useRef<string | null>(null);

  const commitSnapshot = useCallback(() => {
    setHistoryPast((past) => [...past.slice(-20), JSON.parse(JSON.stringify(project))]);
    setHistoryFuture([]);
  }, [project]);

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryFuture((fut) => [JSON.parse(JSON.stringify(project)), ...fut]);
    setHistoryPast((past) => past.slice(0, -1));
    setProject(prev);
    setActiveSlideIndex(Math.min(activeSlideIndex, prev.slides.length - 1));
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryPast((past) => [...past.slice(-20), JSON.parse(JSON.stringify(project))]);
    setHistoryFuture((fut) => fut.slice(1));
    setProject(next);
    setActiveSlideIndex(Math.min(activeSlideIndex, next.slides.length - 1));
  };

  const activeSlide: CarouselSlide | undefined = project.slides[activeSlideIndex] || project.slides[0];

  // Render active slide onto main canvas
  useEffect(() => {
    let active = true;
    if (canvasRef.current && activeSlide) {
      renderCarouselSlide(
        activeSlide,
        project.width,
        project.height,
        canvasRef.current,
        0.4
      ).catch((err) => {
        if (active) console.error('Carousel slide render error', err);
      });
    }
    return () => {
      active = false;
    };
  }, [activeSlide, project.width, project.height]);

  // Replace photo in current slide
  const handleTriggerReplace = (elId: string) => {
    targetElementIdRef.current = elId;
    singleFileInputRef.current?.click();
  };

  const handleSingleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = targetElementIdRef.current;
    if (!file || !targetId || !activeSlide) return;

    commitSnapshot();
    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (src) {
        setProject((prev) => ({
          ...prev,
          slides: prev.slides.map((s, idx) => {
            if (idx === activeSlideIndex) {
              return {
                ...s,
                elements: s.elements.map((el) =>
                  el.id === targetId ? { ...el, src, zoom: 1, offsetX: 0, offsetY: 0 } : el
                ),
              };
            }
            return s;
          }),
        }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Batch Quick-Fill: Select multiple photos and distribute across slides in order!
  const handleBatchFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    commitSnapshot();
    const readers = Array.from(files).map((f) => {
      return new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = (ev) => res(ev.target?.result as string);
        r.readAsDataURL(f);
      });
    });

    Promise.all(readers).then((urls) => {
      let urlIdx = 0;
      setProject((prev) => ({
        ...prev,
        slides: prev.slides.map((slide) => {
          return {
            ...slide,
            elements: slide.elements.map((el) => {
              if (el.type === 'image' && urlIdx < urls.length) {
                const filled = { ...el, src: urls[urlIdx], zoom: 1, offsetX: 0, offsetY: 0 };
                urlIdx++;
                return filled;
              }
              return el;
            }),
          };
        }),
      }));
    });
    e.target.value = '';
  };

  // Slide Management
  const handleAddSlide = (type: CarouselSlide['slideType']) => {
    commitSnapshot();
    const newSlide: CarouselSlide = {
      id: 'slide-' + Date.now(),
      title: `Slide ${project.slides.length + 1}`,
      slideType: type,
      background: { ...activeSlide.background },
      elements: [
        {
          id: 'photo-new',
          type: 'image',
          placeholderId: 'photo-new',
          placeholderLabel: 'New Photo',
          isPlaceholder: true,
          src: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1080&q=80',
          x: 80,
          y: 120,
          width: 920,
          height: 800,
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
          borderRadius: 16,
          rotation: 0,
          opacity: 1,
          zIndex: 1,
          visible: true,
        },
        {
          id: 'text-new',
          type: 'text',
          text: `Slide ${project.slides.length + 1} Headline`,
          fontFamily: project.theme.fontFamily,
          fontSize: 36,
          color: '#281715',
          fontWeight: 'bold',
          fontStyle: 'normal',
          textAlign: 'left',
          x: 80,
          y: 980,
          width: 920,
          height: 60,
          rotation: 0,
          opacity: 1,
          zIndex: 2,
          visible: true,
        },
      ],
    };

    setProject((prev) => ({
      ...prev,
      slides: [...prev.slides, newSlide],
    }));
    setActiveSlideIndex(project.slides.length);
  };

  const handleDeleteSlide = (index: number) => {
    if (project.slides.length <= 1) {
      alert('Carousel must have at least 1 slide.');
      return;
    }
    commitSnapshot();
    const newSlides = project.slides.filter((_, i) => i !== index);
    setProject((prev) => ({ ...prev, slides: newSlides }));
    setActiveSlideIndex(Math.max(0, index - 1));
  };

  const handleDuplicateSlide = (index: number) => {
    commitSnapshot();
    const target = project.slides[index];
    const copy: CarouselSlide = {
      ...JSON.parse(JSON.stringify(target)),
      id: 'slide-' + Date.now(),
      title: `${target.title} (Copy)`,
    };
    const newSlides = [...project.slides];
    newSlides.splice(index + 1, 0, copy);
    setProject((prev) => ({ ...prev, slides: newSlides }));
    setActiveSlideIndex(index + 1);
  };

  const handleMoveSlide = (index: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= project.slides.length) return;

    commitSnapshot();
    const newSlides = [...project.slides];
    const [moved] = newSlides.splice(index, 1);
    newSlides.splice(targetIdx, 0, moved);

    setProject((prev) => ({ ...prev, slides: newSlides }));
    setActiveSlideIndex(targetIdx);
  };

  // Text updating on current slide
  const updateSlideText = (elementId: string, newText: string) => {
    commitSnapshot();
    setProject((prev) => ({
      ...prev,
      slides: prev.slides.map((s, idx) => {
        if (idx === activeSlideIndex) {
          return {
            ...s,
            elements: s.elements.map((el) =>
              el.id === elementId && el.type === 'text' ? { ...el, text: newText } : el
            ),
          };
        }
        return s;
      }),
    }));
  };

  // Save Project
  const handleSaveProject = async () => {
    const updated = { ...project, updatedAt: Date.now() };
    await StorageService.saveProject(updated as any);
    onSave?.(updated);
    alert('Carousel project saved to My Projects!');
  };

  // Export current slide
  const handleExportCurrentSlide = async () => {
    if (!activeSlide) return;
    setIsExporting(true);
    try {
      const exportCanvas = document.createElement('canvas');
      await renderCarouselSlide(activeSlide, project.width, project.height, exportCanvas, 1);
      const blob = await canvasToBlob(exportCanvas, 'png', 0.95);
      const fileName = `${project.name}_slide_${String(activeSlideIndex + 1).padStart(2, '0')}.png`;
      const result = await ExportService.saveExportedFile(blob, fileName, 'image/png', {
        dialogTitle: 'Save or Share Carousel Slide',
        shareText: `Slide ${activeSlideIndex + 1} of ${project.name}`,
      });
      if (!result.success) {
        alert(result.error || 'Failed to export slide.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to export slide.');
    } finally {
      setIsExporting(false);
    }
  };

  // Sequential Export of ALL Slides
  const handleExportAllSlides = async () => {
    setIsExporting(true);
    try {
      for (let i = 0; i < project.slides.length; i++) {
        setExportProgress(`Exporting slide ${i + 1} of ${project.slides.length}...`);
        const slide = project.slides[i];
        const exportCanvas = document.createElement('canvas');
        await renderCarouselSlide(slide, project.width, project.height, exportCanvas, 1);
        const blob = await canvasToBlob(exportCanvas, 'png', 0.95);
        const fileName = `${project.name.replace(/\s+/g, '_')}_slide_${String(i + 1).padStart(2, '0')}.png`;
        // For batch export on native, save files without repeated share prompts except possibly on the last slide
        await ExportService.saveExportedFile(blob, fileName, 'image/png', {
          dialogTitle: `Save Slide ${i + 1}`,
          skipSharePrompt: i < project.slides.length - 1,
        });
        await new Promise((res) => setTimeout(res, 200));
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to export all slides.');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  const imageElements = activeSlide?.elements.filter(
    (e): e is ImageDesignElement => e.type === 'image'
  ) || [];

  const textElements = activeSlide?.elements.filter(
    (e): e is TextDesignElement => e.type === 'text'
  ) || [];

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between overflow-hidden selection:bg-primary-container selection:text-white">
      {/* Hidden file pickers */}
      <input
        type="file"
        ref={singleFileInputRef}
        onChange={handleSingleFilePicked}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={batchFileInputRef}
        onChange={handleBatchFilePicked}
        accept="image/*"
        multiple
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
                {project.format} • Slide {activeSlideIndex + 1} of {project.slides.length}
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

            {/* Export Dropdown / Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleExportCurrentSlide}
                disabled={isExporting}
                className="px-2.5 py-1.5 rounded-lg bg-surface-container-highest border border-outline-variant text-on-surface text-[11px] font-semibold hover:border-primary cursor-pointer"
                title="Export this slide"
              >
                Slide {activeSlideIndex + 1}
              </button>
              <button
                onClick={handleExportAllSlides}
                disabled={isExporting}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-[12px] font-bold shadow-md shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>{isExporting ? exportProgress || 'Exporting...' : 'Export All'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row gap-4 items-center justify-center overflow-y-auto">
        {/* Canvas Surface & Slide Strip */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[380px] w-full relative">
          <div className="relative shadow-2xl rounded-2xl overflow-hidden border-2 border-outline-variant bg-surface-container-low max-w-full max-h-[64vh] flex items-center justify-center">
            <canvas ref={canvasRef} className="block max-w-full max-h-[64vh] object-contain" />
          </div>

          {/* Slide Strip Navigator */}
          <div className="w-full mt-3 flex items-center justify-center gap-2 overflow-x-auto py-1 px-2 no-scrollbar">
            {project.slides.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveSlideIndex(idx)}
                className={`relative flex-shrink-0 w-14 h-18 rounded-lg overflow-hidden border-2 transition-all cursor-pointer flex flex-col items-center justify-between p-1 bg-surface-container-low ${
                  activeSlideIndex === idx
                    ? 'border-primary shadow-md scale-105'
                    : 'border-outline-variant hover:border-outline opacity-70'
                }`}
              >
                <span className="text-[9px] font-mono font-bold text-on-surface">#{idx + 1}</span>
                <span className="text-[8px] uppercase tracking-tighter text-outline truncate w-full text-center">
                  {s.slideType}
                </span>
              </button>
            ))}

            {/* Quick Add Slide */}
            <button
              onClick={() => handleAddSlide('photo')}
              className="flex-shrink-0 w-14 h-18 rounded-lg border-2 border-dashed border-outline-variant hover:border-primary flex flex-col items-center justify-center text-outline hover:text-primary gap-1 cursor-pointer bg-surface-container-low"
              title="Add Slide"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span className="text-[8px] font-bold">ADD</span>
            </button>
          </div>
        </div>

        {/* Side Control Panel */}
        <div className="w-full md:w-80 bg-surface-container-lowest rounded-2xl border border-outline-variant p-3.5 flex flex-col gap-3 shadow-sm max-h-[78vh] overflow-y-auto">
          {/* Tabs */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-surface-container-low rounded-xl border border-outline-variant">
            {(['photos', 'text', 'slides', 'style'] as const).map((tab) => (
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

          {/* Photos Tab: Slide Photos & Batch Quick-Fill */}
          {activeTab === 'photos' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-on-surface">Slide Photos</span>
                <button
                  onClick={() => batchFileInputRef.current?.click()}
                  className="px-2 py-1 rounded-md bg-primary text-white text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                  title="Select multiple photos to fill all slides automatically"
                >
                  <span className="material-symbols-outlined text-[13px]">bolt</span>
                  <span>Batch Fill</span>
                </button>
              </div>

              {imageElements.length === 0 ? (
                <div className="p-4 text-center text-outline text-[11px] bg-surface-container-low rounded-xl">
                  No image elements on this slide.
                </div>
              ) : (
                imageElements.map((imgEl, idx) => (
                  <div
                    key={imgEl.id}
                    className="p-3 bg-surface-container-low rounded-xl border border-outline-variant flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-on-surface">
                        Photo {idx + 1}: {imgEl.placeholderLabel || 'Image'}
                      </span>
                      <button
                        onClick={() => handleTriggerReplace(imgEl.id)}
                        className="px-2.5 py-1 rounded bg-primary text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[12px]">refresh</span>
                        <span>Replace</span>
                      </button>
                    </div>

                    <div className="w-full h-24 rounded-lg bg-surface-container-lowest overflow-hidden border border-outline-variant relative">
                      <img
                        src={imgEl.src}
                        alt="Slide photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Text Tab: Slide Typography */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-bold text-on-surface">Slide Text</span>

              {textElements.length === 0 ? (
                <div className="p-4 text-center text-outline text-[11px] bg-surface-container-low rounded-xl">
                  No editable text on this slide.
                </div>
              ) : (
                textElements.map((txtEl) => (
                  <div
                    key={txtEl.id}
                    className="p-3 bg-surface-container-low rounded-xl border border-outline-variant space-y-1.5"
                  >
                    <span className="text-[10px] font-bold uppercase text-outline">
                      {txtEl.id}
                    </span>
                    <textarea
                      value={txtEl.text}
                      onChange={(e) => updateSlideText(txtEl.id, e.target.value)}
                      rows={2}
                      className="w-full p-2 text-[12px] bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Slides Tab: Reorder, Duplicate, Delete */}
          {activeTab === 'slides' && (
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-bold text-on-surface">Slide Actions</span>

              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>Current Slide</span>
                  <span className="text-primary font-bold">
                    #{activeSlideIndex + 1} of {project.slides.length}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleMoveSlide(activeSlideIndex, 'left')}
                    disabled={activeSlideIndex === 0}
                    className="flex-1 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant text-[11px] font-semibold hover:border-primary disabled:opacity-30 cursor-pointer"
                  >
                    ← Move Left
                  </button>
                  <button
                    onClick={() => handleMoveSlide(activeSlideIndex, 'right')}
                    disabled={activeSlideIndex === project.slides.length - 1}
                    className="flex-1 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant text-[11px] font-semibold hover:border-primary disabled:opacity-30 cursor-pointer"
                  >
                    Move Right →
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleDuplicateSlide(activeSlideIndex)}
                    className="flex-1 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant text-[11px] font-semibold hover:border-primary cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                    <span>Duplicate</span>
                  </button>
                  <button
                    onClick={() => handleDeleteSlide(activeSlideIndex)}
                    disabled={project.slides.length <= 1}
                    className="flex-1 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant text-[11px] font-semibold text-error hover:bg-error/10 disabled:opacity-30 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[13px]">delete</span>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Style Tab: Theme & Background */}
          {activeTab === 'style' && (
            <div className="flex flex-col gap-3">
              <span className="text-[12px] font-bold text-on-surface">Slide Theme & Background</span>

              <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant space-y-2">
                <span className="text-[10px] font-bold uppercase text-outline">Background Color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeSlide.background.value.startsWith('#') ? activeSlide.background.value : '#fff8f7'}
                    onChange={(e) => {
                      commitSnapshot();
                      setProject((prev) => ({
                        ...prev,
                        slides: prev.slides.map((s, idx) =>
                          idx === activeSlideIndex
                            ? { ...s, background: { type: 'color', value: e.target.value } }
                            : s
                        ),
                      }));
                    }}
                    className="w-10 h-10 rounded border border-outline-variant cursor-pointer p-0"
                  />
                  <span className="text-[11px] font-mono font-semibold">
                    {activeSlide.background.value}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
