import React, { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
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
import { ToneCurvesEditor } from './components/ToneCurvesEditor';
import { ToolNavigation } from './components/ToolNavigation';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { AuthModal, AuthViewMode } from './components/auth/AuthModal';
import { ExportService } from './services/exportService';

// Performance Optimization: Code-split heavy sub-editors and modal views
const SettingsModal = lazy(() => import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })));
const TemplatesStudio = lazy(() => import('./components/templates/TemplatesStudio').then((m) => ({ default: m.TemplatesStudio })));
const TemplateEditor = lazy(() => import('./components/templates/TemplateEditor').then((m) => ({ default: m.TemplateEditor })));
const CollageStudio = lazy(() => import('./components/collage/CollageStudio').then((m) => ({ default: m.CollageStudio })));
const CollageEditor = lazy(() => import('./components/collage/CollageEditor').then((m) => ({ default: m.CollageEditor })));
const CarouselStudio = lazy(() => import('./components/carousel/CarouselStudio').then((m) => ({ default: m.CarouselStudio })));
const CarouselEditor = lazy(() => import('./components/carousel/CarouselEditor').then((m) => ({ default: m.CarouselEditor })));
const MyProjectsView = lazy(() => import('./components/projects/MyProjectsView').then((m) => ({ default: m.MyProjectsView })));
const ProfileModal = lazy(() => import('./components/profile/ProfileModal').then((m) => ({ default: m.ProfileModal })));
const UpgradeModal = lazy(() => import('./components/subscription/UpgradeModal').then((m) => ({ default: m.UpgradeModal })));
const AiImageGenModal = lazy(() => import('./components/modals/AiImageGenModal').then((m) => ({ default: m.AiImageGenModal })));

const StudioSuspenseFallback = () => (
  <div className="min-h-screen w-full bg-[#09070A] flex flex-col items-center justify-center gap-4 select-none">
    <div className="relative flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#00E5FF]/20 via-[#7C3AED]/30 to-[#FF9A3C]/20 blur-xl animate-pulse" />
      <img
        src="/brand/chroma-logo-symbol-transparent.png"
        alt="Chroma Studio"
        className="w-16 h-16 object-contain relative z-10 animate-pulse"
      />
    </div>
    <div className="flex flex-col items-center gap-1.5 z-10">
      <span className="text-[12px] font-bold text-white tracking-[0.25em] uppercase">Chroma Studio</span>
      <div className="w-20 h-0.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-[#00E5FF] via-[#7C3AED] to-[#FF9A3C] w-full animate-pulse" />
      </div>
    </div>
  </div>
);
import type {
  ReadyMadeTemplate,
  DesignProject,
  CollageProject,
  CarouselProject,
} from './types/design';
import type { CarouselFamilyDefinition } from './data/carouselTemplates';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_BACKGROUND_REPLACEMENT,
  DEFAULT_CURVES,
  DEFAULT_GEOMETRY,
  DEFAULT_WHEELS,
  DEFAULT_HSL,
  DEFAULT_CUTOUT,
} from './constants/defaults';
import { PRESETS } from './data/presets';
import { SAMPLE_IMAGES, SampleImage } from './data/samples';
import { blendPresetAdjustments, calculateAutoTone, processImage } from './engine/pipeline';
import { AutosaveSession, StorageService } from './services/storage';
import { generateUUID } from './services/cloudProjectService';
import {
  AdjustmentParameters,
  BackgroundReplacementState,
  ColorWheels,
  CutoutState,
  DominantColor,
  EditorTab,
  EnhancementState,
  ExportSettings,
  GeometryState,
  HistogramData,
  HistorySnapshot,
  HslAdjustments,
  InpaintOperation,
  InpaintState,
  Preset,
  Project,
  ToneCurves,
} from './types/editor';
import { HslColorMixer } from './components/HslColorMixer';
import { CutoutPanel } from './components/panels/CutoutPanel';
import { BackgroundReplacementPanel } from './components/panels/BackgroundReplacementPanel';
import { AiAssistantPanel } from './components/panels/AiAssistantPanel';
import { AiEnhancePanel } from './components/panels/AiEnhancePanel';
import { InpaintPanel } from './components/panels/InpaintPanel';
import { AiImageGenPanel } from './components/panels/AiImageGenPanel';
import type { AiEditPlan } from './services/ai';
import { segmentationService } from './services/segmentation';
import { inpaintingService } from './services/inpainting';

function ChromaStudioApp() {
  const {
    user,
    loading,
    isGuest,
    isRecoveryMode,
    authModalOpen,
    authModalMode,
    authModalReason,
    openAuthModal,
    closeAuthModal,
    consumePendingDestination,
  } = useAuth();
  const {
    upgradeModalOpen,
    upgradeReason,
    closeUpgradeModal,
  } = useSubscription();
  // Navigation & Modal States
  const [currentView, setCurrentView] = useState<
    | 'home'
    | 'editor'
    | 'templates-browse'
    | 'template-edit'
    | 'collage-browse'
    | 'collage-edit'
    | 'carousel-browse'
    | 'carousel-edit'
    | 'my-projects'
  >('home');
  const [activeTab, setActiveTab] = useState<EditorTab>('adjust');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    if (isRecoveryMode) {
      openAuthModal('reset_password', 'Create a new password for your Chroma Studio account');
    }
  }, [isRecoveryMode, openAuthModal]);

  // Creative Studios Active Projects & Models
  const [activeTemplate, setActiveTemplate] = useState<ReadyMadeTemplate | undefined>();
  const [activeTemplateProject, setActiveTemplateProject] = useState<DesignProject | undefined>();
  const [activeCollageImages, setActiveCollageImages] = useState<string[]>([]);
  const [activeCollageProject, setActiveCollageProject] = useState<CollageProject | undefined>();
  const [activeCarouselFamily, setActiveCarouselFamily] = useState<CarouselFamilyDefinition | undefined>();
  const [activeCarouselProject, setActiveCarouselProject] = useState<CarouselProject | undefined>();

  // Active Project Data
  const [projectId, setProjectId] = useState<string>(() => generateUUID());
  const [projectName, setProjectName] = useState<string>('IMG_4829_RAW.DNG');
  const [imageSrc, setImageSrc] = useState<string>('');
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });

  // Editing State
  const [adjustments, setAdjustments] = useState<AdjustmentParameters>(DEFAULT_ADJUSTMENTS);
  const adjustmentsRef = useRef<AdjustmentParameters>(adjustments);
  useEffect(() => {
    adjustmentsRef.current = adjustments;
  }, [adjustments]);

  // Frame scheduler references for 60fps continuous slider dragging
  const pendingRenderTaskRef = useRef<{
    adjustments?: AdjustmentParameters;
    isInteractive: boolean;
  } | null>(null);
  const renderRafIdRef = useRef<number | null>(null);
  const scheduleRenderRef = useRef<((adj?: AdjustmentParameters, isInteractive?: boolean) => void) | null>(null);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [presetIntensity, setPresetIntensity] = useState<number>(100);
  const [geometry, setGeometry] = useState<GeometryState>(DEFAULT_GEOMETRY);
  const [curves, setCurves] = useState<ToneCurves>(DEFAULT_CURVES);
  const [wheels, setWheels] = useState<ColorWheels>(DEFAULT_WHEELS);
  const [hsl, setHsl] = useState<HslAdjustments>(DEFAULT_HSL);
  const [cutout, setCutout] = useState<CutoutState>(DEFAULT_CUTOUT);
  const [backgroundReplacement, setBackgroundReplacement] = useState<BackgroundReplacementState>(DEFAULT_BACKGROUND_REPLACEMENT);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [enhancement, setEnhancement] = useState<EnhancementState | undefined>(undefined);
  const [aiSubMode, setAiSubMode] = useState<'enhance' | 'assistant' | 'generate'>('enhance');
  const [isAiGenModalOpen, setIsAiGenModalOpen] = useState(false);

  // Inpainting & Object Removal State
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inpaintState, setInpaintState] = useState<InpaintState>({ operations: [] });
  const [brushSize, setBrushSize] = useState(25);
  const [brushMode, setBrushMode] = useState<'brush' | 'eraser'>('brush');
  const [maskPastStrokes, setMaskPastStrokes] = useState<ImageData[]>([]);
  const [maskFutureStrokes, setMaskFutureStrokes] = useState<ImageData[]>([]);
  const [isInpaintProcessing, setIsInpaintProcessing] = useState(false);
  const [inpaintProgress, setInpaintProgress] = useState(0);
  const [inpaintStatus, setInpaintStatus] = useState('');
  const [inpaintPreviewUrl, setInpaintPreviewUrl] = useState<string | null>(null);

  // Copied recipe for copy/paste edits workflow
  const [clipboardEdits, setClipboardEdits] = useState<{
    adjustments: AdjustmentParameters;
    wheels?: ColorWheels;
    curves?: ToneCurves;
    hsl?: HslAdjustments;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('chroma_studio_copied_recipe');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Undo / Redo History
  const [historyPast, setHistoryPast] = useState<HistorySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<HistorySnapshot[]>([]);

  // Interactivity States
  const [isComparing, setIsComparing] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [favorites, setFavorites] = useState<string[]>(StorageService.getFavorites());
  const [recentProjects, setRecentProjects] = useState<Project[]>(() =>
    StorageService.getProjectsSync(user ? user.id : null)
  );

  // Load projects from IndexedDB & trigger auto-migration scoped strictly to authenticated user
  useEffect(() => {
    let mounted = true;
    const targetUserId = user ? user.id : null;
    StorageService.getProjects(targetUserId).then((projects) => {
      if (mounted) setRecentProjects(projects);
    });
    return () => {
      mounted = false;
    };
  }, [user]);

  // Check for recoverable unsaved session
  const [recoverableSession, setRecoverableSession] = useState<AutosaveSession | null>(null);

  useEffect(() => {
    const session = StorageService.getAutosaveSession();
    if (session && session.view === 'editor' && session.imageSrc) {
      setRecoverableSession(session);
    }
  }, []);

  const handleRestoreSession = () => {
    if (!recoverableSession) return;
    setProjectId(recoverableSession.projectId);
    setProjectName(recoverableSession.projectName);
    if (recoverableSession.adjustments) setAdjustments(recoverableSession.adjustments);
    if (recoverableSession.geometry) setGeometry(recoverableSession.geometry);
    if (recoverableSession.curves) setCurves(recoverableSession.curves);
    if (recoverableSession.wheels) setWheels(recoverableSession.wheels);
    if (recoverableSession.adjustments?.hsl) setHsl(recoverableSession.adjustments.hsl);
    if (recoverableSession.adjustments?.cutout) setCutout(recoverableSession.adjustments.cutout);
    if (recoverableSession.activePresetId !== undefined) setActivePresetId(recoverableSession.activePresetId);
    if (recoverableSession.presetIntensity !== undefined) setPresetIntensity(recoverableSession.presetIntensity);
    if (recoverableSession.originalDimensions) setOriginalDimensions(recoverableSession.originalDimensions);

    loadImage(recoverableSession.imageSrc!, recoverableSession.projectName);
    setRecoverableSession(null);
  };

  const handleDismissSession = () => {
    StorageService.clearAutosaveSession();
    setRecoverableSession(null);
  };

  // Pipeline Output
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [dominantColors, setDominantColors] = useState<DominantColor[]>([]);

  // AI Edit Plan Preview State
  const [aiPreviewState, setAiPreviewState] = useState<{
    adjustments: AdjustmentParameters | null;
    presetId?: string | null;
    presetIntensity?: number;
  } | null>(null);

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
    hsl: JSON.parse(JSON.stringify(hsl)),
    cutout: {
      ...cutout,
      maskAlpha: cutout.maskAlpha,
    },
    backgroundReplacement: JSON.parse(JSON.stringify(backgroundReplacement)),
    enhancement: enhancement ? { ...enhancement } : undefined,
    inpaint: JSON.parse(JSON.stringify(inpaintState)),
    currentImageSrc: imageSrc,
  }), [adjustments, activePresetId, presetIntensity, geometry, curves, wheels, hsl, cutout, backgroundReplacement, enhancement, inpaintState, imageSrc]);

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
      // Trigger full fidelity render on release with histogram
      scheduleRenderRef.current?.(undefined, false);
    }
  }, [captureSnapshot]);

  // Undo
  const handleUndo = useCallback(() => {
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
    if (previous.hsl) setHsl(previous.hsl);
    else setHsl(DEFAULT_HSL);
    if (previous.cutout) setCutout(previous.cutout);
    else setCutout(DEFAULT_CUTOUT);
    if (previous.backgroundReplacement) setBackgroundReplacement(previous.backgroundReplacement);
    else setBackgroundReplacement(DEFAULT_BACKGROUND_REPLACEMENT);
    if (previous.enhancement) setEnhancement(previous.enhancement);
    else setEnhancement(undefined);
    if (previous.inpaint) setInpaintState(previous.inpaint);
    else setInpaintState({ operations: [] });
    if (previous.currentImageSrc && previous.currentImageSrc !== imageSrc) {
      loadImage(previous.currentImageSrc);
    }
  }, [historyPast, captureSnapshot, imageSrc]);

  // Redo
  const handleRedo = useCallback(() => {
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
    if (next.hsl) setHsl(next.hsl);
    else setHsl(DEFAULT_HSL);
    if (next.cutout) setCutout(next.cutout);
    else setCutout(DEFAULT_CUTOUT);
    if (next.backgroundReplacement) setBackgroundReplacement(next.backgroundReplacement);
    else setBackgroundReplacement(DEFAULT_BACKGROUND_REPLACEMENT);
    if (next.enhancement) setEnhancement(next.enhancement);
    else setEnhancement(undefined);
    if (next.inpaint) setInpaintState(next.inpaint);
    else setInpaintState({ operations: [] });
    if (next.currentImageSrc && next.currentImageSrc !== imageSrc) {
      loadImage(next.currentImageSrc);
    }
  }, [historyFuture, captureSnapshot, imageSrc]);

  // Render Pipeline Execution with adaptive preview resolution
  const executeRender = useCallback(
    (customAdj?: AdjustmentParameters, isInteractive?: boolean) => {
      const img = imageElementRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return;

      const interactive = isInteractive ?? isInteractingRef.current;
      const effectiveAdjustments = customAdj || aiPreviewState?.adjustments || adjustmentsRef.current;
      const effectivePresetId =
        aiPreviewState?.presetId !== undefined ? aiPreviewState.presetId : activePresetId;
      const effectivePresetIntensity =
        aiPreviewState?.presetIntensity !== undefined ? aiPreviewState.presetIntensity : presetIntensity;

      const customPresets = StorageService.getCustomTemplates();
      const activePreset =
        PRESETS.find((p) => p.id === effectivePresetId) ||
        customPresets.find((p) => p.id === effectivePresetId) ||
        null;

      const {
        adjustments: blendedAdj,
        wheels: finalWheels,
        curves: finalCurves,
        hsl: finalHsl,
      } = blendPresetAdjustments(
        effectiveAdjustments,
        activePreset,
        effectivePresetIntensity,
        wheels,
        curves,
        hsl
      );

      // Adaptive Preview Resolution:
      // - While actively scrubbing/dragging: use 720p preview for instant 60fps throughput
      // - When idle/settled: use crisp 1440p preview
      const maxPreviewDim = interactive ? 720 : 1440;
      const naturalMax = Math.max(
        img.naturalWidth || originalDimensions.width,
        img.naturalHeight || originalDimensions.height
      );
      const previewScale = naturalMax > maxPreviewDim ? maxPreviewDim / naturalMax : 1;

      try {
        const result = processImage(
          img,
          img.naturalWidth || originalDimensions.width,
          img.naturalHeight || originalDimensions.height,
          blendedAdj,
          geometry,
          finalCurves || curves,
          finalWheels || wheels,
          canvas,
          previewScale,
          finalHsl || hsl,
          cutout,
          backgroundReplacement,
          bgImageRef.current,
          { skipMetrics: interactive }
        );

        // Only commit metrics (histogram/colors) to React state when settled to avoid re-render storms during dragging
        if (!interactive) {
          setHistogram(result.histogram);
          setDominantColors(result.dominantColors);
        }
      } catch (err) {
        console.error('Rendering pipeline error:', err);
      }
    },
    [
      activePresetId,
      presetIntensity,
      geometry,
      curves,
      wheels,
      hsl,
      cutout,
      backgroundReplacement,
      aiPreviewState,
      originalDimensions,
    ]
  );

  // Frame scheduler: coalesces multiple slider events within one display refresh,
  // guaranteeing latest values are always rendered without dropping or lagging.
  const scheduleRender = useCallback(
    (customAdj?: AdjustmentParameters, isInteractive?: boolean) => {
      pendingRenderTaskRef.current = {
        adjustments: customAdj || adjustmentsRef.current,
        isInteractive: isInteractive ?? isInteractingRef.current,
      };

      if (renderRafIdRef.current !== null) {
        return;
      }

      renderRafIdRef.current = requestAnimationFrame(() => {
        renderRafIdRef.current = null;
        const task = pendingRenderTaskRef.current;
        if (task) {
          pendingRenderTaskRef.current = null;
          executeRender(task.adjustments, task.isInteractive);

          // If a new task was queued while executeRender was running, schedule next frame immediately
          const nextRef = pendingRenderTaskRef as React.RefObject<{
            adjustments?: AdjustmentParameters;
            isInteractive: boolean;
          } | null>;
          if (nextRef.current) {
            scheduleRender(nextRef.current.adjustments, nextRef.current.isInteractive);
          }
        }
      });
    },
    [executeRender]
  );

  useEffect(() => {
    scheduleRenderRef.current = scheduleRender;
  }, [scheduleRender]);

  const runPipeline = useCallback(() => {
    scheduleRender(undefined, false);
  }, [scheduleRender]);

  // Preload background image asset whenever custom image or AI generated scene changes
  useEffect(() => {
    const src =
      backgroundReplacement.mode === 'image'
        ? backgroundReplacement.imageSrc
        : backgroundReplacement.mode === 'ai'
        ? backgroundReplacement.aiGeneratedSrc
        : null;

    if (src) {
      const bgImg = new Image();
      bgImg.crossOrigin = 'anonymous';
      bgImg.onload = () => {
        bgImageRef.current = bgImg;
        runPipeline();
      };
      bgImg.src = src;
    } else {
      bgImageRef.current = null;
      runPipeline();
    }
  }, [
    backgroundReplacement.mode,
    backgroundReplacement.imageSrc,
    backgroundReplacement.aiGeneratedSrc,
    runPipeline,
  ]);

  // Re-run pipeline when parameters change
  useEffect(() => {
    if (imageSrc && currentView === 'editor') {
      runPipeline();
    }
  }, [runPipeline, imageSrc, currentView]);

  // Reset active ephemeral AI previews and inpaint preview when switching tool tabs
  useEffect(() => {
    setAiPreviewState(null);
    setInpaintPreviewUrl(null);
  }, [activeTab]);

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
    img.onerror = () => {
      alert(`Could not load image: "${title || 'Selected file'}". Please check file permissions or try another photograph.`);
    };
    img.src = src;
  };

  // Handlers for starting with Sample
  const handleStartWithSample = (sample: SampleImage) => {
    setProjectId(generateUUID());
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setActivePresetId(null);
    setPresetIntensity(100);
    setGeometry(DEFAULT_GEOMETRY);
    setCurves(DEFAULT_CURVES);
    setWheels(DEFAULT_WHEELS);
    setHsl(DEFAULT_HSL);
    setCutout(DEFAULT_CUTOUT);
    setBackgroundReplacement(DEFAULT_BACKGROUND_REPLACEMENT);
    setHistoryPast([]);
    setHistoryFuture([]);
    loadImage(sample.url, `${sample.title}.RAW`);
  };

  const handleOpenGeneratedInEditor = async (imageUrl: string, title?: string) => {
    // Preserve current project in storage before opening new AI generated project
    if (imageSrc) {
      await saveCurrentProjectToStorage();
    }
    setProjectId(generateUUID());
    setProjectName(title || 'AI Generated Image');
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setActivePresetId(null);
    setPresetIntensity(100);
    setGeometry(DEFAULT_GEOMETRY);
    setCurves(DEFAULT_CURVES);
    setWheels(DEFAULT_WHEELS);
    setHsl(DEFAULT_HSL);
    setCutout(DEFAULT_CUTOUT);
    setBackgroundReplacement(DEFAULT_BACKGROUND_REPLACEMENT);
    setEnhancement(undefined);
    setInpaintState({ operations: [] });
    setHistoryPast([]);
    setHistoryFuture([]);
    loadImage(imageUrl, title || 'AI Generated Image');
    setCurrentView('editor');
    setActiveTab('adjust');
  };

  const handleUseGeneratedAsBackdrop = useCallback(
    (imageUrl: string) => {
      commitImmediateHistory();
      setBackgroundReplacement((prev) => ({
        ...prev,
        enabled: true,
        mode: 'image',
        imageSrc: imageUrl,
      }));
      setActiveTab('backdrop');
      setIsAiGenModalOpen(false);
    },
    [commitImmediateHistory]
  );

  // Handlers for importing user photo
  const handleImportFile = (file: File) => {
    // Security & file validation
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.dng', '.raw', '.heic', '.heif'];
    const fileNameLower = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileNameLower.endsWith(ext));
    const hasValidMime = file.type.startsWith('image/') || file.type === '';

    if (!hasValidExt && !hasValidMime) {
      alert(`Unsupported file format: "${file.name}". Please import a JPG, PNG, WebP, DNG or RAW photograph.`);
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert(`File size too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum supported size is 100MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) {
        setProjectId(generateUUID());
        setAdjustments(DEFAULT_ADJUSTMENTS);
        setActivePresetId(null);
        setPresetIntensity(100);
        setGeometry(DEFAULT_GEOMETRY);
        setCurves(DEFAULT_CURVES);
        setWheels(DEFAULT_WHEELS);
        setHsl(DEFAULT_HSL);
        setCutout(DEFAULT_CUTOUT);
        setHistoryPast([]);
        setHistoryFuture([]);
        loadImage(src, file.name);
      }
    };
    reader.onerror = () => {
      alert(`Failed to read "${file.name}". Please verify the file is readable and try again.`);
    };
    reader.readAsDataURL(file);
  };

  // Open an existing project (supports Photo, Template, Collage, and Carousel)
  const handleOpenProject = (project: any) => {
    if (project.type === 'template') {
      setActiveTemplate(undefined);
      setActiveTemplateProject(project as DesignProject);
      setCurrentView('template-edit');
      return;
    }
    if (project.type === 'collage') {
      setActiveCollageImages([]);
      setActiveCollageProject(project as CollageProject);
      setCurrentView('collage-edit');
      return;
    }
    if (project.type === 'carousel') {
      setActiveCarouselFamily(undefined);
      setActiveCarouselProject(project as CarouselProject);
      setCurrentView('carousel-edit');
      return;
    }

    // Default: Photo Editor project
    setProjectId(project.id);
    setProjectName(project.name);
    setAdjustments(project.adjustments);
    setActivePresetId(project.activePresetId);
    setPresetIntensity(project.presetIntensity);
    setGeometry(project.geometry);
    setCurves(project.curves);
    setWheels(project.wheels);
    if (project.hsl) setHsl(project.hsl);
    else setHsl(DEFAULT_HSL);
    if (project.cutout) setCutout(project.cutout);
    else setCutout(DEFAULT_CUTOUT);
    if (project.backgroundReplacement) setBackgroundReplacement(project.backgroundReplacement);
    else setBackgroundReplacement(DEFAULT_BACKGROUND_REPLACEMENT);
    if (project.enhancement) setEnhancement(project.enhancement);
    else setEnhancement(undefined);
    if (project.inpaint) setInpaintState(project.inpaint);
    else setInpaintState({ operations: [] });
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
      hsl,
      cutout,
      backgroundReplacement,
      enhancement,
      inpaint: inpaintState,
      userId: user?.id,
    };
    await StorageService.saveProject(project);
    const updated = await StorageService.getProjects(user ? user.id : null);
    setRecentProjects(updated);
  };

  // Android Back Button & System Navigation Lifecycle
  useEffect(() => {
    let removeListener: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#070B14' }).catch(() => {});
    }

    CapacitorApp.addListener('backButton', () => {
      if (authModalOpen) {
        closeAuthModal();
      } else if (isProfileOpen) {
        setIsProfileOpen(false);
      } else if (isExportOpen) {
        setIsExportOpen(false);
      } else if (isSettingsOpen) {
        setIsSettingsOpen(false);
      } else if (currentView === 'editor') {
        saveCurrentProjectToStorage();
        StorageService.clearAutosaveSession();
        setCurrentView('home');
      } else if (
        currentView === 'template-edit' ||
        currentView === 'collage-edit' ||
        currentView === 'carousel-edit'
      ) {
        if (currentView === 'template-edit') setCurrentView('templates-browse');
        if (currentView === 'collage-edit') setCurrentView('collage-browse');
        if (currentView === 'carousel-edit') setCurrentView('carousel-browse');
      } else if (
        currentView === 'templates-browse' ||
        currentView === 'collage-browse' ||
        currentView === 'carousel-browse' ||
        currentView === 'my-projects'
      ) {
        setCurrentView('home');
      } else if (currentView === 'home') {
        CapacitorApp.exitApp();
      }
    }).then((handle) => {
      removeListener = () => handle.remove();
    });

    return () => {
      if (removeListener) removeListener();
    };
  }, [
    authModalOpen,
    closeAuthModal,
    isExportOpen,
    isSettingsOpen,
    isProfileOpen,
    currentView,
    projectId,
    projectName,
    imageSrc,
    originalDimensions,
    adjustments,
    activePresetId,
    presetIntensity,
    geometry,
    curves,
    wheels,
  ]);

  // Handle successful authentication and route to pending destination
  const handleAuthSuccess = useCallback(() => {
    closeAuthModal();
    const dest = consumePendingDestination();
    if (!dest) return;

    switch (dest.type) {
      case 'editor':
        if (dest.sample) {
          handleStartWithSample(dest.sample);
        } else if (dest.file) {
          handleImportFile(dest.file);
        } else if (!imageSrc) {
          handleStartWithSample(SAMPLE_IMAGES[0]);
        } else {
          setCurrentView('editor');
        }
        break;
      case 'open-project':
        if (dest.project) {
          handleOpenProject(dest.project);
        }
        break;
      case 'template-edit':
        if (dest.template) {
          setActiveTemplate(dest.template);
          setActiveTemplateProject(undefined);
          setCurrentView('template-edit');
        }
        break;
      case 'collage-edit':
        if (dest.images) {
          setActiveCollageImages(dest.images);
          setActiveCollageProject(undefined);
          setCurrentView('collage-edit');
        }
        break;
      case 'carousel-edit':
        if (dest.family) {
          setActiveCarouselFamily(dest.family);
          setActiveCarouselProject(undefined);
          setCurrentView('carousel-edit');
        }
        break;
      case 'my-projects':
        setCurrentView('my-projects');
        break;
      case 'profile':
        setIsProfileOpen(true);
        break;
      default:
        break;
    }
  }, [closeAuthModal, consumePendingDestination, imageSrc]);

  // Handle post-redirect auth restoration (e.g. Google OAuth or page reload)
  useEffect(() => {
    if (user && !loading) {
      const dest = consumePendingDestination();
      if (!dest) return;

      switch (dest.type) {
        case 'editor':
          if (dest.sample) handleStartWithSample(dest.sample);
          else if (dest.file) handleImportFile(dest.file);
          else if (!imageSrc) handleStartWithSample(SAMPLE_IMAGES[0]);
          else setCurrentView('editor');
          break;
        case 'open-project':
          if (dest.project) handleOpenProject(dest.project);
          break;
        case 'template-edit':
          if (dest.template) {
            setActiveTemplate(dest.template);
            setActiveTemplateProject(undefined);
            setCurrentView('template-edit');
          }
          break;
        case 'collage-edit':
          if (dest.images) {
            setActiveCollageImages(dest.images);
            setActiveCollageProject(undefined);
            setCurrentView('collage-edit');
          }
          break;
        case 'carousel-edit':
          if (dest.family) {
            setActiveCarouselFamily(dest.family);
            setActiveCarouselProject(undefined);
            setCurrentView('carousel-edit');
          }
          break;
        case 'my-projects':
          setCurrentView('my-projects');
          break;
        case 'profile':
          setIsProfileOpen(true);
          break;
        default:
          break;
      }
    }
  }, [user, loading]);

  // Periodic autosave for active photo editor sessions
  useEffect(() => {
    if (currentView !== 'editor' || !imageSrc) return;

    const timer = setTimeout(() => {
      StorageService.saveAutosaveSession({
        timestamp: Date.now(),
        view: 'editor',
        projectId,
        projectName,
        imageSrc,
        originalDimensions,
        adjustments,
        geometry,
        curves,
        wheels,
        activePresetId,
        presetIntensity,
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    currentView,
    imageSrc,
    projectId,
    projectName,
    originalDimensions,
    adjustments,
    geometry,
    curves,
    wheels,
    activePresetId,
    presetIntensity,
  ]);

  // Instantaneous Adjustment Change Handlers with immediate 60fps frame scheduling
  const handleAdjustmentChange = useCallback((param: keyof AdjustmentParameters, value: number) => {
    setAdjustments((prev) => {
      const next = { ...prev, [param]: value };
      adjustmentsRef.current = next;
      scheduleRender(next, isInteractingRef.current);
      return next;
    });
  }, [scheduleRender]);

  const handleResetAdjustmentParam = useCallback((param: keyof AdjustmentParameters) => {
    commitImmediateHistory();
    setAdjustments((prev) => {
      const next = { ...prev, [param]: DEFAULT_ADJUSTMENTS[param] };
      adjustmentsRef.current = next;
      scheduleRender(next, false);
      return next;
    });
  }, [commitImmediateHistory, scheduleRender]);

  const handleResetAdjustmentGroup = useCallback((group: 'tone' | 'color') => {
    commitImmediateHistory();
    setAdjustments((prev) => {
      const next = { ...prev };
      if (group === 'tone') {
        next.exposure = 0;
        next.brightness = 0;
        next.contrast = 0;
        next.highlights = 0;
        next.shadows = 0;
        next.whites = 0;
        next.blacks = 0;
      } else {
        next.temperature = 0;
        next.tint = 0;
        next.saturation = 0;
        next.vibrance = 0;
      }
      adjustmentsRef.current = next;
      scheduleRender(next, false);
      return next;
    });
  }, [commitImmediateHistory, scheduleRender]);

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

  // AI Plan Application & Interactive Preview Handlers
  const handleApplyAiPlan = useCallback(
    (plan: AiEditPlan) => {
      commitImmediateHistory();
      if (plan.parameters && Object.keys(plan.parameters).length > 0) {
        setAdjustments((prev) => ({
          ...prev,
          ...plan.parameters,
        }));
      }
      if (plan.presetId) {
        setActivePresetId(plan.presetId);
        if (plan.presetIntensity !== undefined) {
          setPresetIntensity(plan.presetIntensity);
        }
      }
      setAiPreviewState(null);
    },
    [commitImmediateHistory]
  );

  const handlePreviewAiPlan = useCallback(
    (
      previewAdj: AdjustmentParameters | null,
      presetId?: string | null,
      intensity?: number
    ) => {
      if (previewAdj) {
        setAiPreviewState({
          adjustments: previewAdj,
          presetId,
          presetIntensity: intensity,
        });
      } else {
        setAiPreviewState(null);
      }
    },
    []
  );

  // AI Background Removal Handlers
  const [isCutoutAiProcessing, setIsCutoutAiProcessing] = useState(false);
  const [cutoutAiProgress, setCutoutAiProgress] = useState(0);
  const [cutoutAiStatus, setCutoutAiStatus] = useState('');

  const handleRunCutoutAi = useCallback(
    async (provider: 'on-device' | 'cloud', userConsent = false) => {
      if (isCutoutAiProcessing || !imageElementRef.current) return;
      commitImmediateHistory();
      setIsCutoutAiProcessing(true);
      setCutoutAiProgress(10);
      setCutoutAiStatus('Analyzing image contours...');

      try {
        const result = await segmentationService.removeBackground(imageElementRef.current, {
          provider,
          tolerance: cutout.tolerance,
          feather: cutout.feather,
          invert: cutout.invert,
          userConsent,
          onProgress: (pct, status) => {
            setCutoutAiProgress(pct);
            setCutoutAiStatus(status);
          },
        });

        setCutout((prev) => ({
          ...prev,
          enabled: true,
          mode: 'ai',
          maskData: result.maskData,
          maskAlpha: result.alphaArray,
          provider: result.provider,
          confidence: result.confidence,
          hasUserConsent: userConsent ? true : prev.hasUserConsent,
        }));
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          alert(`Background removal failed: ${err.message || 'Unknown error'}`);
        }
      } finally {
        setIsCutoutAiProcessing(false);
        setCutoutAiProgress(0);
        setCutoutAiStatus('');
      }
    },
    [commitImmediateHistory, cutout.tolerance, cutout.feather, cutout.invert]
  );

  const handleCancelCutoutAi = useCallback(() => {
    segmentationService.cancelCurrentOperation();
    setIsCutoutAiProcessing(false);
    setCutoutAiProgress(0);
    setCutoutAiStatus('');
  }, []);

  // AI Image Enhancement Handlers
  const handleApplyEnhancement = useCallback(
    (enhancedParams: Partial<AdjustmentParameters>, state: EnhancementState) => {
      commitImmediateHistory();
      setAdjustments((prev) => ({
        ...prev,
        ...enhancedParams,
      }));
      setEnhancement(state);
      setAiPreviewState(null);
    },
    [commitImmediateHistory]
  );

  const handlePreviewEnhancement = useCallback(
    (previewParams: Partial<AdjustmentParameters> | null) => {
      if (previewParams) {
        setAiPreviewState({
          adjustments: {
            ...adjustments,
            ...previewParams,
          },
        });
      } else {
        setAiPreviewState(null);
      }
    },
    [adjustments]
  );

  // Inpainting & Mask Stroke Handlers
  const handleMaskStrokeStart = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setMaskPastStrokes((prev) => [...prev.slice(-19), snapshot]);
    setMaskFutureStrokes([]);
  }, []);

  const handleUndoMaskStroke = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas || maskPastStrokes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const currentSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const previous = maskPastStrokes[maskPastStrokes.length - 1];
    setMaskPastStrokes((prev) => prev.slice(0, -1));
    setMaskFutureStrokes((prev) => [currentSnapshot, ...prev]);
    ctx.putImageData(previous, 0, 0);
  }, [maskPastStrokes]);

  const handleRedoMaskStroke = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas || maskFutureStrokes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const currentSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const next = maskFutureStrokes[0];
    setMaskFutureStrokes((prev) => prev.slice(1));
    setMaskPastStrokes((prev) => [...prev.slice(-19), currentSnapshot]);
    ctx.putImageData(next, 0, 0);
  }, [maskFutureStrokes]);

  const handleClearMask = useCallback(() => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setMaskPastStrokes((prev) => [...prev.slice(-19), snapshot]);
    setMaskFutureStrokes([]);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setInpaintPreviewUrl(null);
  }, []);

  const handleRunInpaint = useCallback(
    async (provider: 'on-device' | 'cloud-ai', userConsent = false) => {
      if (isInpaintProcessing || !imageElementRef.current || !maskCanvasRef.current) return;
      setIsInpaintProcessing(true);
      setInpaintProgress(10);
      setInpaintStatus('Analyzing painted mask...');

      try {
        const result = await inpaintingService.inpaintObject(
          imageElementRef.current,
          maskCanvasRef.current,
          {
            provider,
            userConsent,
            onProgress: (pct, status) => {
              setInpaintProgress(pct);
              setInpaintStatus(status);
            },
          }
        );
        setInpaintPreviewUrl(result.inpaintedDataUrl);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          alert(`Object removal failed: ${err.message || 'Unknown error'}`);
        }
      } finally {
        setIsInpaintProcessing(false);
        setInpaintProgress(0);
        setInpaintStatus('');
      }
    },
    []
  );

  const handleApplyInpaint = useCallback(() => {
    if (!inpaintPreviewUrl) return;
    commitImmediateHistory();
    // Update current image source with the inpainted result
    loadImage(inpaintPreviewUrl, projectName);
    // Record in inpaintState
    const newOp: InpaintOperation = {
      id: `inpaint_${Date.now()}`,
      timestamp: Date.now(),
      maskData: inpaintPreviewUrl,
      provider: 'on-device',
      explanation: 'Unwanted object removed and texture reconstructed.',
    };
    setInpaintState((prev) => ({
      operations: [...prev.operations, newOp],
    }));
    // Clear mask canvas and preview
    const canvas = maskCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    setMaskPastStrokes([]);
    setMaskFutureStrokes([]);
    setInpaintPreviewUrl(null);
  }, [inpaintPreviewUrl, commitImmediateHistory, projectName]);

  const handleDiscardInpaint = useCallback(() => {
    setInpaintPreviewUrl(null);
  }, []);

  const handleRetryInpaint = useCallback(() => {
    setInpaintPreviewUrl(null);
  }, []);

  const handleCancelInpaintProcessing = useCallback(() => {
    inpaintingService.cancelCurrentOperation();
    setIsInpaintProcessing(false);
    setInpaintProgress(0);
    setInpaintStatus('');
  }, []);

  // Toggle Favorite
  const handleToggleFavorite = (pId: string) => {
    const updated = StorageService.toggleFavorite(pId);
    setFavorites(updated);
  };

  // Intelligent Histogram-Driven Auto-Tone Handler
  const handleMagicAutoTone = () => {
    commitImmediateHistory();
    setAdjustments((prev) => calculateAutoTone(histogram, prev));
  };

  // Copy Edits / Adjustments Recipe to in-memory & persistent clipboard
  const handleCopyEdits = useCallback(() => {
    const recipe = {
      adjustments: { ...adjustments },
      wheels: { ...wheels },
      curves: JSON.parse(JSON.stringify(curves)),
      hsl: JSON.parse(JSON.stringify(hsl)),
    };
    setClipboardEdits(recipe);
    try {
      localStorage.setItem('chroma_studio_copied_recipe', JSON.stringify(recipe));
    } catch {}
  }, [adjustments, wheels, curves, hsl]);

  // Paste Edits / Adjustments Recipe
  const handlePasteEdits = useCallback(() => {
    if (!clipboardEdits) return;
    commitImmediateHistory();
    if (clipboardEdits.adjustments) setAdjustments(clipboardEdits.adjustments);
    if (clipboardEdits.wheels) setWheels(clipboardEdits.wheels);
    if (clipboardEdits.curves) setCurves(clipboardEdits.curves);
    if (clipboardEdits.hsl) setHsl(clipboardEdits.hsl);
  }, [clipboardEdits, commitImmediateHistory]);

  // Reset All Adjustments back to clean neutral baseline
  const handleResetAllAdjustments = useCallback(() => {
    commitImmediateHistory();
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setActivePresetId(null);
    setPresetIntensity(100);
    setCurves(DEFAULT_CURVES);
    setWheels(DEFAULT_WHEELS);
    setHsl(DEFAULT_HSL);
    setCutout(DEFAULT_CUTOUT);
    setBackgroundReplacement(DEFAULT_BACKGROUND_REPLACEMENT);
  }, [commitImmediateHistory]);

  // Keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView !== 'editor') return;
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyEdits();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteEdits();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, handleCopyEdits, handlePasteEdits, handleUndo, handleRedo]);

  // High-Fidelity Master Export Function
  const handleExport = async (settings: ExportSettings) => {
    if (!imageElementRef.current) return;
    const img = imageElementRef.current;

    const customPresets = StorageService.getCustomTemplates();
    const activePreset =
      PRESETS.find((p) => p.id === activePresetId) ||
      customPresets.find((p) => p.id === activePresetId) ||
      null;

    const {
      adjustments: blendedAdj,
      wheels: exportWheels,
      curves: exportCurves,
      hsl: exportHsl,
    } = blendPresetAdjustments(
      adjustments,
      activePreset,
      presetIntensity,
      wheels,
      curves,
      hsl
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
      settings.scale,
      exportHsl || hsl,
      cutout,
      backgroundReplacement,
      bgImageRef.current
    );

    // For JPEG export with transparent cutout: composite onto an intentional background color (default White)
    // to prevent black compression artifacts since JPEG standard lacks alpha channel.
    let exportCanvas: HTMLCanvasElement = offscreen;
    let cleanupMatteCanvas = false;

    if (settings.format === 'jpeg' && cutout?.enabled && !backgroundReplacement?.enabled) {
      const matteCanvas = document.createElement('canvas');
      matteCanvas.width = offscreen.width;
      matteCanvas.height = offscreen.height;
      const mCtx = matteCanvas.getContext('2d');
      if (mCtx) {
        mCtx.fillStyle = cutout.matteColor || '#ffffff';
        mCtx.fillRect(0, 0, matteCanvas.width, matteCanvas.height);
        mCtx.drawImage(offscreen, 0, 0);
        exportCanvas = matteCanvas;
        cleanupMatteCanvas = true;
      }
    }

    // Encode to Blob instead of heavy base64 DataURL
    const mimeType =
      settings.format === 'png'
        ? 'image/png'
        : settings.format === 'webp'
        ? 'image/webp'
        : 'image/jpeg';

    const blob = await new Promise<Blob | null>((resolve) =>
      exportCanvas.toBlob((b) => resolve(b), mimeType, settings.quality)
    );

    // Release canvas memory
    offscreen.width = 0;
    offscreen.height = 0;
    if (cleanupMatteCanvas) {
      exportCanvas.width = 0;
      exportCanvas.height = 0;
    }

    if (!blob) throw new Error('Failed to create export blob');

    // Universal Native (Android Filesystem & Share) and Web Browser Export Pipeline
    const baseName = projectName.replace(/\.[^/.]+$/, '');
    const fileName = `${baseName}_graded.${settings.format}`;
    const exportResult = await ExportService.saveExportedFile(blob, fileName, mimeType, {
      dialogTitle: 'Save or Share Photo',
      shareText: `Chroma Studio: ${baseName}`,
    });

    if (!exportResult.success) {
      throw new Error(exportResult.error || 'Failed to export photo on this device');
    }

    // Auto-save project upon export
    await saveCurrentProjectToStorage();
  };

  // Refresh projects helper
  const refreshProjectsList = async () => {
    const projs = await StorageService.getProjects(user ? user.id : null);
    setRecentProjects(projs);
  };

  // Loading state splash screen to eliminate auth flicker
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#070B14] flex flex-col items-center justify-center gap-4 text-white">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899] p-0.5 animate-pulse shadow-lg shadow-purple-500/20">
          <div className="w-full h-full bg-[#070B14] rounded-2xl flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]">
              palette
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-base font-bold tracking-tight text-white/90">Chroma Studio</h1>
          <p className="text-xs text-white/40">Initializing creative workspace...</p>
        </div>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'home':
        return (
          <>
            {recoverableSession && (
              <div className="fixed top-16 inset-x-4 z-50 max-w-lg mx-auto bg-surface-container-high border-2 border-primary text-on-surface p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[22px]">history</span>
                  <div>
                    <h4 className="text-[12px] font-bold text-on-surface leading-tight">Recover Previous Session?</h4>
                    <p className="text-[10px] text-on-surface-variant">
                      {recoverableSession.projectName} from {new Date(recoverableSession.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDismissSession}
                    className="px-2.5 py-1 text-[11px] font-semibold text-outline hover:text-on-surface cursor-pointer"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={handleRestoreSession}
                    className="px-3 py-1 bg-primary text-white text-[11px] font-bold rounded-lg shadow-sm hover:brightness-110 cursor-pointer"
                  >
                    Restore
                  </button>
                </div>
              </div>
            )}
            <HomeDashboard
              onStartWithSample={handleStartWithSample}
              onOpenProject={handleOpenProject}
              onImportFile={handleImportFile}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenTemplates={() => setCurrentView('templates-browse')}
              onOpenCollage={() => setCurrentView('collage-browse')}
              onOpenCarousel={() => setCurrentView('carousel-browse')}
              onOpenProjectsView={() => setCurrentView('my-projects')}
              onOpenProfile={() => setIsProfileOpen(true)}
              onOpenAuth={() => openAuthModal('signin', 'Sign in to access your creative studio and saved projects')}
              onOpenAiImageGen={() => setIsAiGenModalOpen(true)}
              onSelectTemplate={(template) => {
                setActiveTemplate(template);
                setActiveTemplateProject(undefined);
                setCurrentView('template-edit');
              }}
              recentProjects={recentProjects}
            />
          </>
        );

      case 'templates-browse':
        return (
          <TemplatesStudio
            onBack={() => setCurrentView('home')}
            onSelectTemplate={(template) => {
              setActiveTemplate(template);
              setActiveTemplateProject(undefined);
              setCurrentView('template-edit');
            }}
          />
        );

      case 'template-edit':
        return (
          <TemplateEditor
            initialTemplate={activeTemplate}
            existingProject={activeTemplateProject}
            onBack={() => {
              refreshProjectsList();
              setCurrentView('templates-browse');
            }}
            onSave={() => refreshProjectsList()}
          />
        );

      case 'collage-browse':
        return (
          <CollageStudio
            onBack={() => setCurrentView('home')}
            onStartCollage={(images) => {
              setActiveCollageImages(images);
              setActiveCollageProject(undefined);
              setCurrentView('collage-edit');
            }}
          />
        );

      case 'collage-edit':
        return (
          <CollageEditor
            initialImages={activeCollageImages}
            existingProject={activeCollageProject}
            onBack={() => {
              refreshProjectsList();
              setCurrentView('collage-browse');
            }}
            onSave={() => refreshProjectsList()}
          />
        );

      case 'carousel-browse':
        return (
          <CarouselStudio
            onBack={() => setCurrentView('home')}
            onSelectCarousel={(family) => {
              setActiveCarouselFamily(family);
              setActiveCarouselProject(undefined);
              setCurrentView('carousel-edit');
            }}
          />
        );

      case 'carousel-edit':
        return (
          <CarouselEditor
            initialFamily={activeCarouselFamily}
            existingProject={activeCarouselProject}
            onBack={() => {
              refreshProjectsList();
              setCurrentView('carousel-browse');
            }}
            onSave={() => refreshProjectsList()}
          />
        );

      case 'my-projects':
        return (
          <MyProjectsView
            projects={recentProjects}
            onOpenProject={handleOpenProject}
            onRefresh={refreshProjectsList}
            onBack={() => setCurrentView('home')}
          />
        );

      case 'editor':
      default:
        return (
          <div className="min-h-screen min-h-[100dvh] h-[100dvh] w-full bg-[#070B14] text-[#F8FAFC] flex flex-col justify-between selection:bg-[#8B5CF6]/40 selection:text-white overflow-hidden">
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
              onResetAll={handleResetAllAdjustments}
              onCopyEdits={handleCopyEdits}
              onPasteEdits={handlePasteEdits}
              canPasteEdits={clipboardEdits !== null}
              onOpenExport={() => setIsExportOpen(true)}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenProfile={() => setIsProfileOpen(true)}
              isComparing={isComparing}
              onStartComparing={() => setIsComparing(true)}
              onStopComparing={() => setIsComparing(false)}
              zoomLevel={zoomLevel}
              onToggleZoom={() => setZoomLevel((z) => (z === 1 ? 1.6 : 1))}
              historyStepsCount={historyPast.length}
            />

            {/* Main Studio Canvas Viewport */}
            <main className="flex-1 w-full max-w-5xl mx-auto pt-[calc(3.75rem+env(safe-area-inset-top,0px))] pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] px-2.5 sm:px-3 flex flex-col justify-between gap-2.5 sm:gap-3 overflow-hidden">
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
                onOpenAiEnhance={() => {
                  setActiveTab('ai');
                  setAiSubMode('enhance');
                }}
                onOpenColorLab={() => setActiveTab('colorlab')}
                onOpenAiAssistant={() => {
                  setActiveTab('ai');
                  setAiSubMode('assistant');
                }}
                isCropping={activeTab === 'crop'}
                crop={geometry.crop}
                onCropChange={(crop) => setGeometry((prev) => ({ ...prev, crop }))}
                onCropInteractionStart={handleInteractionStart}
                onCropInteractionEnd={handleInteractionEnd}
                sourceDimensions={originalDimensions}
                onZoomChange={setZoomLevel}
                onResetZoom={() => setZoomLevel(1)}
                isInpainting={activeTab === 'inpaint'}
                maskCanvasRef={maskCanvasRef}
                brushSize={brushSize}
                brushMode={brushMode}
                onMaskStrokeStart={handleMaskStrokeStart}
              />

              {/* Active Tool Panel Container */}
              <div className="w-full flex flex-col gap-2 min-h-[120px] max-h-[38vh] sm:max-h-[44vh] overflow-y-auto no-scrollbar overscroll-contain">
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
                    currentHsl={hsl}
                    imageElement={imageElementRef.current}
                    canvasElement={canvasRef.current}
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
                    sourceDimensions={originalDimensions}
                    onChange={(geo) => setGeometry(geo)}
                    onInteractionStart={handleInteractionStart}
                    onInteractionEnd={handleInteractionEnd}
                    onReset={() => {
                      commitImmediateHistory();
                      setGeometry(DEFAULT_GEOMETRY);
                    }}
                  />
                )}

                {activeTab === 'curves' && (
                  <ToneCurvesEditor
                    curves={curves}
                    onChange={(c) => setCurves(c)}
                    onReset={() => {
                      commitImmediateHistory();
                      setCurves(DEFAULT_CURVES);
                    }}
                    onInteractionStart={handleInteractionStart}
                    onInteractionEnd={handleInteractionEnd}
                  />
                )}

                {activeTab === 'colorlab' && (
                  <div className="flex flex-col gap-3">
                    <HslColorMixer
                      hsl={hsl}
                      onChange={(newHsl) => setHsl(newHsl)}
                      onResetChannel={(ch) => {
                        commitImmediateHistory();
                        setHsl((prev) => ({
                          ...prev,
                          [ch]: { hue: 0, saturation: 0, luminance: 0 },
                        }));
                      }}
                      onResetAll={() => {
                        commitImmediateHistory();
                        setHsl(DEFAULT_HSL);
                      }}
                      onInteractionStart={handleInteractionStart}
                      onInteractionEnd={handleInteractionEnd}
                    />
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

                {activeTab === 'cutout' && (
                  <CutoutPanel
                    cutout={cutout}
                    onChange={(newCutout) => setCutout(newCutout)}
                    onReset={() => {
                      commitImmediateHistory();
                      setCutout(DEFAULT_CUTOUT);
                    }}
                    onInteractionStart={handleInteractionStart}
                    onInteractionEnd={handleInteractionEnd}
                    onRunAiSegmentation={handleRunCutoutAi}
                    isProcessing={isCutoutAiProcessing}
                    progressPercent={cutoutAiProgress}
                    progressStatus={cutoutAiStatus}
                    onCancel={handleCancelCutoutAi}
                    onToggleCompare={() => setIsComparing((prev) => !prev)}
                    isComparing={isComparing}
                    onOpenBackdrop={() => setActiveTab('backdrop')}
                  />
                )}

                {activeTab === 'backdrop' && (
                  <BackgroundReplacementPanel
                    backgroundState={backgroundReplacement}
                    cutout={cutout}
                    onChange={(newState) => setBackgroundReplacement(newState)}
                    onReset={() => {
                      commitImmediateHistory();
                      setBackgroundReplacement(DEFAULT_BACKGROUND_REPLACEMENT);
                    }}
                    onInteractionStart={handleInteractionStart}
                    onInteractionEnd={handleInteractionEnd}
                    onRunAiSegmentation={handleRunCutoutAi}
                    isSegmenting={isCutoutAiProcessing}
                    onToggleCompare={() => setIsComparing((prev) => !prev)}
                    isComparing={isComparing}
                  />
                )}

                {activeTab === 'inpaint' && (
                  <InpaintPanel
                    onRunInpaint={handleRunInpaint}
                    isProcessing={isInpaintProcessing}
                    progressPercent={inpaintProgress}
                    progressStatus={inpaintStatus}
                    onCancelProcessing={handleCancelInpaintProcessing}
                    brushSize={brushSize}
                    onBrushSizeChange={setBrushSize}
                    brushMode={brushMode}
                    onBrushModeChange={setBrushMode}
                    onUndoStroke={handleUndoMaskStroke}
                    onRedoStroke={handleRedoMaskStroke}
                    canUndoStroke={maskPastStrokes.length > 0}
                    canRedoStroke={maskFutureStrokes.length > 0}
                    onClearMask={handleClearMask}
                    onApply={handleApplyInpaint}
                    onDiscard={handleDiscardInpaint}
                    onRetry={handleRetryInpaint}
                    hasResult={inpaintPreviewUrl !== null}
                    onToggleCompare={() => setIsComparing((prev) => !prev)}
                    isComparing={isComparing}
                    onClose={() => setActiveTab('adjust')}
                  />
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

                {activeTab === 'ai' && (
                  <div className="space-y-2">
                    {/* Unified AI Hub Navigation */}
                    <div className="flex items-center gap-1 p-1 bg-[#070B14]/80 rounded-xl border border-white/5 max-w-lg mx-auto overflow-x-auto no-scrollbar">
                      <button
                        onClick={() => {
                          setAiPreviewState(null);
                          setAiSubMode('enhance');
                        }}
                        className={`flex-1 min-w-[70px] py-1 px-2 rounded-lg text-[10px] sm:text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer min-h-[36px] ${
                          aiSubMode === 'enhance'
                            ? 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-semibold shadow-xs'
                            : 'text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
                        <span>Enhance</span>
                      </button>

                      <button
                        onClick={() => {
                          setAiPreviewState(null);
                          setAiSubMode('assistant');
                        }}
                        className={`flex-1 min-w-[70px] py-1 px-2 rounded-lg text-[10px] sm:text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer min-h-[36px] ${
                          aiSubMode === 'assistant'
                            ? 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-semibold shadow-xs'
                            : 'text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">psychology</span>
                        <span>Assistant</span>
                      </button>

                      <button
                        onClick={() => {
                          setAiPreviewState(null);
                          setAiSubMode('generate');
                        }}
                        className={`flex-1 min-w-[70px] py-1 px-2 rounded-lg text-[10px] sm:text-[11px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer min-h-[36px] ${
                          aiSubMode === 'generate'
                            ? 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white font-semibold shadow-xs'
                            : 'text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[15px]">brush</span>
                        <span>Generate</span>
                      </button>

                      <button
                        onClick={() => {
                          setAiPreviewState(null);
                          setActiveTab('cutout');
                        }}
                        className="flex-1 min-w-[65px] py-1 px-2 rounded-lg text-[10px] sm:text-[11px] font-medium flex items-center justify-center gap-1 text-[#94A3B8] hover:text-white hover:bg-white/5 transition-all cursor-pointer min-h-[36px]"
                        title="Isolate subject & remove background"
                      >
                        <span className="material-symbols-outlined text-[15px]">person_remove</span>
                        <span>Cutout</span>
                      </button>

                      <button
                        onClick={() => {
                          setAiPreviewState(null);
                          setActiveTab('backdrop');
                        }}
                        className="flex-1 min-w-[75px] py-1 px-2 rounded-lg text-[10px] sm:text-[11px] font-medium flex items-center justify-center gap-1 text-[#94A3B8] hover:text-white hover:bg-white/5 transition-all cursor-pointer min-h-[36px]"
                        title="Replace background with color, image, or AI backdrop"
                      >
                        <span className="material-symbols-outlined text-[15px]">wallpaper</span>
                        <span>Backdrop</span>
                      </button>

                      <button
                        onClick={() => {
                          setAiPreviewState(null);
                          setActiveTab('inpaint');
                        }}
                        className="flex-1 min-w-[60px] py-1 px-2 rounded-lg text-[10px] sm:text-[11px] font-medium flex items-center justify-center gap-1 text-[#94A3B8] hover:text-white hover:bg-white/5 transition-all cursor-pointer min-h-[36px]"
                        title="Erase unwanted objects with AI inpainting"
                      >
                        <span className="material-symbols-outlined text-[15px]">cleaning_services</span>
                        <span>Erase</span>
                      </button>
                    </div>

                    {aiSubMode === 'enhance' ? (
                      <AiEnhancePanel
                        currentAdjustments={adjustments}
                        imageElement={imageElementRef.current}
                        onApplyEnhancement={handleApplyEnhancement}
                        onPreviewEnhancement={handlePreviewEnhancement}
                        onClose={() => setActiveTab('adjust')}
                        onToggleCompare={() => setIsComparing((prev) => !prev)}
                        isComparing={isComparing}
                      />
                    ) : aiSubMode === 'assistant' ? (
                      <AiAssistantPanel
                        currentAdjustments={adjustments}
                        currentPresetId={activePresetId}
                        currentPresetIntensity={presetIntensity}
                        onApplyPlan={handleApplyAiPlan}
                        onPreviewPlan={handlePreviewAiPlan}
                        onCancel={() => setAiPreviewState(null)}
                        onSwitchTab={(tab) => setActiveTab(tab)}
                      />
                    ) : (
                      <AiImageGenPanel
                        onOpenInEditor={(url, title) => handleOpenGeneratedInEditor(url, title)}
                        onUseAsBackdrop={imageSrc ? handleUseGeneratedAsBackdrop : undefined}
                        onClose={() => setActiveTab('adjust')}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Primary Bottom Navigation Dock */}
              <ToolNavigation activeTab={activeTab} onSelectTab={setActiveTab} />
            </main>
          </div>
        );
    }
  };

  return (
    <Suspense fallback={<StudioSuspenseFallback />}>
      {renderCurrentView()}

      {/* Global Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        originalWidth={originalDimensions.width}
        originalHeight={originalDimensions.height}
        onExport={handleExport}
      />

      {/* Global AI Image Generation Modal */}
      {isAiGenModalOpen && (
        <AiImageGenModal
          isOpen={isAiGenModalOpen}
          onClose={() => setIsAiGenModalOpen(false)}
          onOpenInEditor={handleOpenGeneratedInEditor}
          onUseAsBackdrop={imageSrc ? handleUseGeneratedAsBackdrop : undefined}
        />
      )}

      {/* Global Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onClearProjects={() => setRecentProjects([])}
        />
      )}

      {/* Global Canva-Inspired Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
        reason={authModalReason}
        onSuccess={handleAuthSuccess}
      />

      {/* Global Profile Modal */}
      {isProfileOpen && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          onOpenAuth={() => {
            setIsProfileOpen(false);
            openAuthModal('signin', 'Sign in to manage your profile and cloud sync');
          }}
          onClearLocalData={() => setRecentProjects([])}
        />
      )}

      {/* Global Pro Upgrade Modal */}
      {upgradeModalOpen && (
        <UpgradeModal
          isOpen={upgradeModalOpen}
          onClose={closeUpgradeModal}
          reason={upgradeReason}
        />
      )}
    </Suspense>
  );
}

export function App() {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <ChromaStudioApp />
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default App;
