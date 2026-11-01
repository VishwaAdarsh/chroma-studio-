import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { SettingsModal } from './components/SettingsModal';
import { ToneCurvesEditor } from './components/ToneCurvesEditor';
import { ToolNavigation } from './components/ToolNavigation';
import { TemplatesStudio } from './components/templates/TemplatesStudio';
import { TemplateEditor } from './components/templates/TemplateEditor';
import { CollageStudio } from './components/collage/CollageStudio';
import { CollageEditor } from './components/collage/CollageEditor';
import { CarouselStudio } from './components/carousel/CarouselStudio';
import { CarouselEditor } from './components/carousel/CarouselEditor';
import { MyProjectsView } from './components/projects/MyProjectsView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthModal, AuthViewMode } from './components/auth/AuthModal';
import { ProfileModal } from './components/profile/ProfileModal';
import type {
  ReadyMadeTemplate,
  DesignProject,
  CollageProject,
  CarouselProject,
} from './types/design';
import type { CarouselFamilyDefinition } from './data/carouselTemplates';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_GEOMETRY,
  DEFAULT_WHEELS,
} from './constants/defaults';
import { PRESETS } from './data/presets';
import { SAMPLE_IMAGES, SampleImage } from './data/samples';
import { blendPresetAdjustments, processImage } from './engine/pipeline';
import { AutosaveSession, StorageService } from './services/storage';
import { generateUUID } from './services/cloudProjectService';
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

        // Responsive interactive preview scaling: avoid allocating massive pixel buffers on scrub
        const maxPreviewDim = 1440;
        const naturalMax = Math.max(
          img.naturalWidth || originalDimensions.width,
          img.naturalHeight || originalDimensions.height
        );
        const previewScale = naturalMax > maxPreviewDim ? maxPreviewDim / naturalMax : 1;

        const result = processImage(
          img,
          img.naturalWidth || originalDimensions.width,
          img.naturalHeight || originalDimensions.height,
          blendedAdj,
          geometry,
          finalCurves || curves,
          finalWheels || wheels,
          canvas,
          previewScale
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
    setHistoryPast([]);
    setHistoryFuture([]);
    loadImage(sample.url, `${sample.title}.RAW`);
  };

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
      userId: user?.id,
    };
    await StorageService.saveProject(project);
    const updated = await StorageService.getProjects();
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

  // Refresh projects helper
  const refreshProjectsList = async () => {
    const projs = await StorageService.getProjects();
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
          <div className="min-h-screen w-full bg-[#070B14] text-[#F8FAFC] flex flex-col justify-between selection:bg-[#8B5CF6]/40 selection:text-white overflow-hidden">
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
              onOpenProfile={() => setIsProfileOpen(true)}
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
                isCropping={activeTab === 'crop'}
                crop={geometry.crop}
                onCropChange={(crop) => setGeometry((prev) => ({ ...prev, crop }))}
                onCropInteractionStart={handleInteractionStart}
                onCropInteractionEnd={handleInteractionEnd}
                sourceDimensions={originalDimensions}
                onZoomChange={setZoomLevel}
                onResetZoom={() => setZoomLevel(1)}
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
          </div>
        );
    }
  };

  return (
    <>
      {renderCurrentView()}

      {/* Global Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        originalWidth={originalDimensions.width}
        originalHeight={originalDimensions.height}
        onExport={handleExport}
      />

      {/* Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onClearProjects={() => setRecentProjects([])}
      />

      {/* Global Canva-Inspired Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
        reason={authModalReason}
        onSuccess={handleAuthSuccess}
      />

      {/* Global Profile Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onOpenAuth={() => {
          setIsProfileOpen(false);
          openAuthModal('signin', 'Sign in to manage your profile and cloud sync');
        }}
        onClearLocalData={() => setRecentProjects([])}
      />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <ChromaStudioApp />
    </AuthProvider>
  );
}

export default App;
