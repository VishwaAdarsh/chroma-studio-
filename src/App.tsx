import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CanvasView } from './components/CanvasView';
import { ColorPaletteAssistant } from './components/ColorPaletteAssistant';
import { ColorWheelsEditor } from './components/ColorWheelsEditor';
import { ExportModal } from './components/ExportModal';
import { Header } from './components/Header';
import { HomeDashboard } from './components/HomeDashboard';
import { AdjustPanel } from './components/panels/AdjustPanel';
import { CropPanel } from './components/panels/CropPanel';
import { EffectsPanel } from './components/panels/EffectsPanel';
import { LooksPanel } from './components/panels/LooksPanel';
import { SettingsModal } from './components/SettingsModal';
import { ToneCurvesEditor } from './components/ToneCurvesEditor';
import { ToolNavigation } from './components/ToolNavigation';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_GEOMETRY,
  DEFAULT_WHEELS,
} from './constants/defaults';
import { PRESETS } from './data/presets';
import { SAMPLE_IMAGES, SampleImage } from './data/samples';
import { blendPresetAdjustments, processImage } from './engine/pipeline';
import { StorageService } from './services/storage';
import {
  AdjustmentParameters,
  ColorWheels,
  DominantColor,
  EditorTab,
  ExportSettings,
  GeometryState,
  HistogramData,
  Preset,
  Project,
  ToneCurves,
} from './types/editor';

interface HistorySnapshot {
  adjustments: AdjustmentParameters;
  activePresetId: string | null;
  presetIntensity: number;
  geometry: GeometryState;
  curves: ToneCurves;
  wheels: ColorWheels;
}

export function App() {
  // Navigation & Modal States
  const [currentView, setCurrentView] = useState<'home' | 'editor'>('home');
  const [activeTab, setActiveTab] = useState<EditorTab>('adjust');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active Project Data
  const [projectId, setProjectId] = useState<string>('proj-' + Date.now());
  const [projectName, setProjectName] = useState<string>('IMG_4829_RAW.DNG');
  const [imageSrc, setImageSrc] = useState<string>('');
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });

  // Editing State
  const [adjustments, setAdjustments] = useState<AdjustmentParameters>(DEFAULT_ADJUSTMENTS);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetIntensity, setPresetIntensity] = useState<number>(100);
  const [geometry, setGeometry] = useState<GeometryState>(DEFAULT_GEOMETRY);
  const [curves, setCurves] = useState<ToneCurves>(DEFAULT_CURVES);
  const [wheels, setWheels] = useState<ColorWheels>(DEFAULT_WHEELS);

  // Undo / Redo History
  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([]);

  // Interactivity States
  const [isComparing, setIsComparing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [favorites, setFavorites] = useState<string[]>(StorageService.getFavorites());
  const [recentProjects, setRecentProjects] = useState<Project[]>(StorageService.getProjectsSync());

  // Load projects from IndexedDB & trigger auto-migration
  useEffect(() => {
    let mounted = true;
    StorageService.getProjects().then((projects) => {
      if (mounted) setRecentProjects(projects);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Pipeline Output
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [dominantColors, setDominantColors] = useState<DominantColor[]>([]);

  // Canvas & Image References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  const isRenderingRef = useRef(false);

  // Interaction tracking for single-commit slider/wheel drag gestures
  const isInteractingRef = useRef(false);
  const preInteractionSnapshotRef = useRef<HistorySnapshot | null>(null);

  // Capture complete immutable state snapshot
  const captureSnapshot = useCallback((): HistorySnapshot => ({
    adjustments: { ...adjustments },
    activePresetId,
    presetIntensity,
    geometry: JSON.parse(JSON.stringify(geometry)),
    curves: JSON.parse(JSON.stringify(curves)),
    wheels: JSON.parse(JSON.stringify(wheels)),
  }), [adjustments, activePresetId, presetIntensity, geometry, curves, wheels]);

  // Push immediate state to undo stack (for discrete operations)
  const commitImmediateHistory = useCallback(() => {
    const snapshot = captureSnapshot();
    setHistoryPast((past) => [...past.slice(-24), snapshot]);
    setHistoryFuture([]);
  }, [captureSnapshot]);

  // Called when user initiates a continuous drag gesture (slider/wheel)
  const handleInteractionStart = useCallback(() => {
    if (!isInteractingRef.current) {
      preInteractionSnapshotRef.current = captureSnapshot();
      isInteractingRef.current = true;
    }
  }, [captureSnapshot]);

  // Called when user completes the drag gesture
  const handleInteractionEnd = useCallback(() => {
    if (isInteractingRef.current && preInteractionSnapshotRef.current) {
      const prev = preInteractionSnapshotRef.current;
      const curr = captureSnapshot();
      // Only push to past history if values actually changed during the gesture
      if (JSON.stringify(prev) !== JSON.stringify(curr)) {
        setHistoryPast((past) => [...past.slice(-24), prev]);
        setHistoryFuture([]);
      }
      isInteractingRef.current = false;
      preInteractionSnapshotRef.current = null;
    }
  }, [captureSnapshot]);

  // Undo
  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    const newPast = historyPast.slice(0, -1);
    const currentSnapshot = captureSnapshot();

    setHistoryFuture((prev) => [currentSnapshot, ...prev]);
    setHistoryPast(newPast);

    setAdjustments(previous.adjustments);
    setActivePresetId(previous.activePresetId);
    setPresetIntensity(previous.presetIntensity);
    setGeometry(previous.geometry);
    setCurves(previous.curves);
    setWheels(previous.wheels);
  };

  // Redo
  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    const newFuture = historyFuture.slice(1);
    const currentSnapshot = captureSnapshot();

    setHistoryPast((prev) => [...prev.slice(-24), currentSnapshot]);
    setHistoryFuture(newFuture);

    setAdjustments(next.adjustments);
    setActivePresetId(next.activePresetId);
    setPresetIntensity(next.presetIntensity);
    setGeometry(next.geometry);
    setCurves(next.curves);
    setWheels(next.wheels);
  };

  // Render Pipeline
  const runPipeline = useCallback(() => {
    if (!imageElementRef.current || !canvasRef.current || isRenderingRef.current) return;

    isRenderingRef.current = true;
    requestAnimationFrame(() => {
      try {
        const img = imageElementRef.current;
        const canvas = canvasRef.current;
        if (!img || !canvas) return;

        const customPresets = StorageService.getCustomTemplates();
        const activePreset =
          PRESETS.find((p) => p.id === activePresetId) ||
          customPresets.find((p) => p.id === activePresetId) ||
          null;

        const { adjustments: blendedAdj, wheels: finalWheels, curves: finalCurves } =
          blendPresetAdjustments(
            adjustments,
            activePreset,
            presetIntensity,
            wheels,
            curves
          );

        const result = processImage(
          img,
          img.naturalWidth || originalDimensions.width,
          img.naturalHeight || originalDimensions.height,
          blendedAdj,
          geometry,
          finalCurves || curves,
          finalWheels || wheels,
          canvas
        );

        setHistogram(result.histogram);
        setDominantColors(result.dominantColors);
      } catch (err) {
        console.error('Rendering pipeline error:', err);
      } finally {
        isRenderingRef.current = false;
      }
    });
  }, [
    adjustments,
    activePresetId,
    presetIntensity,
    geometry,
    curves,
    wheels,
    originalDimensions,
  ]);

  // Re-run pipeline when parameters change
  useEffect(() => {
    if (imageSrc && currentView === 'editor') {
      runPipeline();
    }
  }, [runPipeline, imageSrc, currentView]);

  // Load an image into memory
  const loadImage = (src: string, title?: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageElementRef.current = img;
      setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
      setImageSrc(src);
      if (title) setProjectName(title);
      setCurrentView('editor');
    };
    img.src = src;
  };

  // Handlers for starting with Sample
  const handleStartWithSample = (sample: SampleImage) => {
    setProjectId('proj-' + Date.now());
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setActivePresetId(null);
    setPresetIntensity(100);
    setGeometry(DEFAULT_GEOMETRY);
    setCurves(DEFAULT_CURVES);
    setWheels(DEFAULT_WHEELS);
    setHistoryPast([]);
    setHistoryFuture([]);
    loadImage(sample.url, `${sample.title}.RAW`);
  };

  // Handlers for importing user photo
  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) {
        setProjectId('proj-' + Date.now());
        setAdjustments(DEFAULT_ADJUSTMENTS);
        setActivePresetId(null);
        setPresetIntensity(100);
        setGeometry(DEFAULT_GEOMETRY);
        setCurves(DEFAULT_CURVES);
        setWheels(DEFAULT_WHEELS);
        setHistoryPast([]);
        setHistoryFuture([]);
        loadImage(src, file.name);
      }
    };
    reader.readAsDataURL(file);
  };

  // Open an existing project
  const handleOpenProject = (project: Project) => {
    setProjectId(project.id);
    setProjectName(project.name);
    setAdjustments(project.adjustments);
    setActivePresetId(project.activePresetId);
    setPresetIntensity(project.presetIntensity);
    setGeometry(project.geometry);
    setCurves(project.curves);
    setWheels(project.wheels);
    setHistoryPast([]);
    setHistoryFuture([]);
    loadImage(project.imageSrc, project.name);
  };

  // Auto-Save project to storage when exiting editor
  const saveCurrentProjectToStorage = async () => {
    if (!imageSrc) return;
    const project: Project = {
      id: projectId,
      name: projectName,
      imageSrc,
      originalName: projectName,
      width: originalDimensions.width,
      height: originalDimensions.height,
      fileSize: 1024 * 1024,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      adjustments,
      activePresetId,
      presetIntensity,
      geometry,
      curves,
      wheels,
    };
    await StorageService.saveProject(project);
    const updated = await StorageService.getProjects();
    setRecentProjects(updated);
  };

  // Adjustment Change Handlers
  const handleAdjustmentChange = (param: keyof AdjustmentParameters, value: number) => {
    setAdjustments((prev) => ({ ...prev, [param]: value }));
  };

  const handleResetAdjustmentParam = (param: keyof AdjustmentParameters) => {
    commitImmediateHistory();
    setAdjustments((prev) => ({ ...prev, [param]: DEFAULT_ADJUSTMENTS[param] }));
  };

  const handleResetAdjustmentGroup = (group: 'tone' | 'color') => {
    commitImmediateHistory();
    if (group === 'tone') {
      setAdjustments((prev) => ({
        ...prev,
        exposure: 0,
        brightness: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        whites: 0,
        blacks: 0,
      }));
    } else {
      setAdjustments((prev) => ({
        ...prev,
        temperature: 0,
        tint: 0,
        saturation: 0,
        vibrance: 0,
      }));
    }
  };

  // Preset Selection Handlers
  const handleSelectPreset = (preset: Preset | null) => {
    commitImmediateHistory();
    if (preset) {
      setActivePresetId(preset.id);
      setPresetIntensity(preset.defaultIntensity || 100);
    } else {
      setActivePresetId(null);
      setPresetIntensity(100);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = (pId: string) => {
    const updated = StorageService.toggleFavorite(pId);
    setFavorites(updated);
  };

  // Magic Auto-Tone Handler
  const handleMagicAutoTone = () => {
    commitImmediateHistory();
    setAdjustments((prev) => ({
      ...prev,
      exposure: 0.35,
      contrast: 18,
      highlights: -15,
      shadows: 22,
      whites: 12,
      clarity: 14,
      vibrance: 16,
    }));
  };

  // High-Fidelity Master Export Function
  const handleExport = async (settings: ExportSettings) => {
    if (!imageElementRef.current) return;
    const img = imageElementRef.current;

    const customPresets = StorageService.getCustomTemplates();
    const activePreset =
      PRESETS.find((p) => p.id === activePresetId) ||
      customPresets.find((p) => p.id === activePresetId) ||
      null;

    const { adjustments: blendedAdj, wheels: exportWheels, curves: exportCurves } =
      blendPresetAdjustments(
        adjustments,
        activePreset,
        presetIntensity,
        wheels,
        curves
      );

    // Render on offscreen canvas at requested scale
    const offscreen = document.createElement('canvas');
    processImage(
      img,
      img.naturalWidth || originalDimensions.width,
      img.naturalHeight || originalDimensions.height,
      blendedAdj,
      geometry,
      exportCurves || curves,
      exportWheels || wheels,
      offscreen,
      settings.scale
    );

    // Encode to Blob instead of heavy base64 DataURL
    const mimeType =
      settings.format === 'png'
        ? 'image/png'
        : settings.format === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

    const blob = await new Promise<Blob | null>((resolve) =>
      offscreen.toBlob((b) => resolve(b), mimeType, settings.quality)
    );

    // Release offscreen canvas memory
    offscreen.width = 0;
    offscreen.height = 0;

    if (!blob) throw new Error('Failed to create export blob');

    // Trigger download via temporary Object URL
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const baseName = projectName.replace(/\.[^/.]+$/, '');
    link.download = `${baseName}_graded.${settings.format}`;
    link.href = objectUrl;
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

    // Auto-save project upon export
    await saveCurrentProjectToStorage();
  };

  // If in Home View, display HomeDashboard
  if (currentView === 'home') {
    return (
      <>
        <HomeDashboard
          onStartWithSample={handleStartWithSample}
          onOpenProject={handleOpenProject}
          onImportFile={handleImportFile}
          onOpenSettings={() => setIsSettingsOpen(true)}
          recentProjects={recentProjects}
        />
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onClearProjects={() => setRecentProjects([])}
        />
      </>
    );
  }

  // Otherwise, display Main Photo Editor View
  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between selection:bg-primary-container selection:text-white overflow-hidden">
      {/* Top Header */}
      <Header
        projectName={projectName}
        onRenameProject={setProjectName}
        onBackToHome={() => {
          saveCurrentProjectToStorage();
          setCurrentView('home');
        }}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isComparing={isComparing}
        onStartComparing={() => setIsComparing(true)}
        onStopComparing={() => setIsComparing(false)}
        zoomLevel={zoomLevel}
        onToggleZoom={() => setZoomLevel((z) => (z === 1 ? 1.6 : 1))}
        historyStepsCount={historyPast.length}
      />

      {/* Main Studio Canvas Viewport */}
      <main className="flex-1 w-full max-w-5xl mx-auto pt-16 pb-2 px-3 flex flex-col justify-between gap-3">
        {/* Canvas Surface */}
        <CanvasView
          canvasRef={canvasRef}
          originalImageSrc={imageSrc}
          isComparing={isComparing}
          zoomLevel={zoomLevel}
          histogram={histogram}
          currentEV={adjustments.exposure}
          activeAspect={geometry.crop.aspectRatio}
          onAutoTone={handleMagicAutoTone}
          onOpenColorLab={() => setActiveTab('colorlab')}
        />

        {/* Active Tool Panel Container */}
        <div className="w-full flex flex-col gap-2 min-h-[140px]">
          {activeTab === 'looks' && (
            <LooksPanel
              activePresetId={activePresetId}
              presetIntensity={presetIntensity}
              onSelectPreset={handleSelectPreset}
              onChangeIntensity={setPresetIntensity}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
              currentAdjustments={adjustments}
              currentWheels={wheels}
              currentCurves={curves}
            />
          )}

          {activeTab === 'adjust' && (
            <AdjustPanel
              adjustments={adjustments}
              onChange={handleAdjustmentChange}
              onResetParam={handleResetAdjustmentParam}
              onResetGroup={handleResetAdjustmentGroup}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
            />
          )}

          {activeTab === 'crop' && (
            <CropPanel
              geometry={geometry}
              onChange={(geo) => {
                commitImmediateHistory();
                setGeometry(geo);
              }}
              onReset={() => {
                commitImmediateHistory();
                setGeometry(DEFAULT_GEOMETRY);
              }}
            />
          )}

          {activeTab === 'curves' && (
            <ToneCurvesEditor
              curves={curves}
              onChange={(c) => {
                commitImmediateHistory();
                setCurves(c);
              }}
              onReset={() => {
                commitImmediateHistory();
                setCurves(DEFAULT_CURVES);
              }}
            />
          )}

          {activeTab === 'colorlab' && (
            <div className="flex flex-col gap-3">
              <ColorWheelsEditor
                wheels={wheels}
                onChange={setWheels}
                onReset={() => {
                  commitImmediateHistory();
                  setWheels(DEFAULT_WHEELS);
                }}
                onInteractionStart={handleInteractionStart}
                onInteractionEnd={handleInteractionEnd}
              />
              <ColorPaletteAssistant
                dominantColors={dominantColors}
                onSelectPresetRecommendation={(pId) => {
                  const p = PRESETS.find((preset) => preset.id === pId);
                  if (p) handleSelectPreset(p);
                }}
              />
            </div>
          )}

          {activeTab === 'effects' && (
            <EffectsPanel
              adjustments={adjustments}
              onChange={handleAdjustmentChange}
              onResetParam={handleResetAdjustmentParam}
              onInteractionStart={handleInteractionStart}
              onInteractionEnd={handleInteractionEnd}
            />
          )}
        </div>

        {/* Primary Bottom Navigation Dock */}
        <ToolNavigation activeTab={activeTab} onSelectTab={setActiveTab} />
      </main>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        originalWidth={originalDimensions.width}
        originalHeight={originalDimensions.height}
        onExport={handleExport}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearProjects={() => setRecentProjects([])}
      />
    </div>
  );
}

export default App;
