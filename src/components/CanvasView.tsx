import React, { useRef, useState, useEffect } from 'react';
import type { GeometryState, HistogramData } from '../types/editor';

interface CanvasViewProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  originalImageSrc: string;
  isComparing: boolean;
  zoomLevel: number;
  histogram: HistogramData | null;
  currentEV: number;
  activeAspect: string;
  onAutoTone: () => void;
  onOpenAiEnhance?: () => void;
  onOpenColorLab: () => void;
  onOpenAiAssistant?: () => void;
  isCropping?: boolean;
  crop?: GeometryState['crop'];
  onCropChange?: (crop: GeometryState['crop']) => void;
  onCropInteractionStart?: () => void;
  onCropInteractionEnd?: () => void;
  sourceDimensions?: { width: number; height: number };
  onResetZoom?: () => void;
  onZoomChange?: (zoom: number) => void;
  // Inpainting & Mask Painting
  isInpainting?: boolean;
  maskCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
  brushSize?: number;
  brushMode?: 'brush' | 'eraser';
  onMaskStrokeStart?: () => void;
  onMaskStrokeEnd?: () => void;
}

type CropHandle =
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'move';

export const CanvasView: React.FC<CanvasViewProps> = ({
  canvasRef,
  originalImageSrc,
  isComparing,
  zoomLevel,
  histogram,
  currentEV,
  activeAspect,
  onAutoTone,
  onOpenAiEnhance,
  onOpenColorLab,
  onOpenAiAssistant,
  isCropping = false,
  crop,
  onCropChange,
  onCropInteractionStart,
  onCropInteractionEnd,
  sourceDimensions = { width: 1920, height: 1080 },
  onResetZoom,
  onZoomChange,
  isInpainting = false,
  maskCanvasRef,
  brushSize = 25,
  brushMode = 'brush',
  onMaskStrokeStart,
  onMaskStrokeEnd,
}) => {
  const [showGrid, setShowGrid] = useState(false);
  const [wandAnimating, setWandAnimating] = useState(false);

  // Pan Offset state (for panning when zoomed in)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Crop Dragging References
  const isDraggingCropRef = useRef(false);
  const activeHandleRef = useRef<CropHandle | null>(null);
  const cropStartPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cropInitialRectRef = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const handleMagicAutoTone = () => {
    setWandAnimating(true);
    if (onOpenAiEnhance) {
      onOpenAiEnhance();
    } else {
      onAutoTone();
    }
    setTimeout(() => setWandAnimating(false), 300);
  };

  // Mask Drawing State & Synchronization
  const isMaskDrawingRef = useRef(false);
  const lastMaskPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isInpainting && canvasRef.current && maskCanvasRef?.current) {
      const mainCanvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas.width !== mainCanvas.width || maskCanvas.height !== mainCanvas.height) {
        maskCanvas.width = mainCanvas.width;
        maskCanvas.height = mainCanvas.height;
      }
    }
  }, [isInpainting, canvasRef, maskCanvasRef]);

  const getMaskCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef?.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMaskPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getMaskCoords(e);
    const canvas = maskCanvasRef?.current;
    if (!coords || !canvas) return;

    onMaskStrokeStart?.();
    isMaskDrawingRef.current = true;
    lastMaskPointRef.current = coords;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (brushMode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(236, 72, 153, 0.65)';
      }
      ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleMaskPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isMaskDrawingRef.current || !lastMaskPointRef.current) return;
    const coords = getMaskCoords(e);
    const canvas = maskCanvasRef?.current;
    if (!coords || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize;
      if (brushMode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.65)';
      }
      ctx.moveTo(lastMaskPointRef.current.x, lastMaskPointRef.current.y);
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      lastMaskPointRef.current = coords;
    }
  };

  const handleMaskPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isMaskDrawingRef.current) {
      isMaskDrawingRef.current = false;
      lastMaskPointRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      onMaskStrokeEnd?.();
    }
  };

  // Generate SVG histogram path
  const getHistogramPath = (data: number[] | undefined, maxCount: number) => {
    if (!data || data.length === 0 || maxCount === 0) return '';
    const points: string[] = [];
    const step = 256 / 32;
    for (let i = 0; i < 256; i += step) {
      const idx = Math.floor(i);
      const val = data[idx] || 0;
      const x = (idx / 255) * 100;
      const y = 30 - Math.min(28, (val / maxCount) * 28);
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return `M 0,30 L ${points.join(' L ')} L 100,30 Z`;
  };

  // Pan Pointer Handlers (when zoomed in)
  const handleViewportPointerDown = (e: React.PointerEvent) => {
    if (isCropping || isInpainting) return;
    if (zoomLevel > 1) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleViewportPointerMove = (e: React.PointerEvent) => {
    if (isPanningRef.current && zoomLevel > 1) {
      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      // Clamp pan bounds based on zoom
      const maxPan = 180 * (zoomLevel - 1);
      setPanOffset({
        x: Math.max(-maxPan, Math.min(maxPan, newX)),
        y: Math.max(-maxPan, Math.min(maxPan, newY)),
      });
    }
  };

  const handleViewportPointerUp = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Interactive Crop Handle Pointer Handlers
  const handleCropPointerDown = (handle: CropHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    if (!crop || !onCropChange) return;

    isDraggingCropRef.current = true;
    activeHandleRef.current = handle;
    cropStartPointerRef.current = { x: e.clientX, y: e.clientY };
    cropInitialRectRef.current = { ...crop };
    e.currentTarget.setPointerCapture(e.pointerId);
    onCropInteractionStart?.();
  };

  const handleCropPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCropRef.current || !activeHandleRef.current || !crop || !onCropChange) return;
    if (!viewportRef.current) return;

    const vpRect = viewportRef.current.getBoundingClientRect();
    if (vpRect.width <= 0 || vpRect.height <= 0) return;

    const deltaX = (e.clientX - cropStartPointerRef.current.x) / vpRect.width;
    const deltaY = (e.clientY - cropStartPointerRef.current.y) / vpRect.height;
    const initial = cropInitialRectRef.current;
    const handle = activeHandleRef.current;

    let newX = initial.x;
    let newY = initial.y;
    let newW = initial.width;
    let newH = initial.height;

    const minSize = 0.08;

    if (handle === 'move') {
      newX = Math.max(0, Math.min(1 - initial.width, initial.x + deltaX));
      newY = Math.max(0, Math.min(1 - initial.height, initial.y + deltaY));
    } else {
      if (handle === 'left' || handle === 'topLeft' || handle === 'bottomLeft') {
        const candidateX = Math.max(0, Math.min(initial.x + initial.width - minSize, initial.x + deltaX));
        newW = initial.width + (initial.x - candidateX);
        newX = candidateX;
      }
      if (handle === 'right' || handle === 'topRight' || handle === 'bottomRight') {
        newW = Math.max(minSize, Math.min(1 - initial.x, initial.width + deltaX));
      }
      if (handle === 'top' || handle === 'topLeft' || handle === 'topRight') {
        const candidateY = Math.max(0, Math.min(initial.y + initial.height - minSize, initial.y + deltaY));
        newH = initial.height + (initial.y - candidateY);
        newY = candidateY;
      }
      if (handle === 'bottom' || handle === 'bottomLeft' || handle === 'bottomRight') {
        newH = Math.max(minSize, Math.min(1 - initial.y, initial.height + deltaY));
      }
    }

    onCropChange({
      ...crop,
      x: Math.max(0, Math.min(1 - newW, newX)),
      y: Math.max(0, Math.min(1 - newH, newY)),
      width: Math.max(minSize, Math.min(1, newW)),
      height: Math.max(minSize, Math.min(1, newH)),
    });
  };

  const handleCropPointerUp = (e: React.PointerEvent) => {
    if (isDraggingCropRef.current) {
      isDraggingCropRef.current = false;
      activeHandleRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      onCropInteractionEnd?.();
    }
  };

  const activeCrop = crop || { x: 0, y: 0, width: 1, height: 1, aspectRatio: 'free' };

  return (
    <div
      ref={viewportRef}
      onPointerDown={handleViewportPointerDown}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={handleViewportPointerUp}
      onPointerCancel={handleViewportPointerUp}
      className={`relative w-full aspect-[4/5] max-h-[46vh] sm:max-h-[55vh] rounded-xl overflow-hidden bg-[#070B14] shadow-md flex items-center justify-center border border-outline-variant select-none group touch-none ${
        zoomLevel > 1 && !isCropping ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {/* Container for Zoom / Pan */}
      <div
        className="w-full h-full flex items-center justify-center transition-transform duration-100 ease-out"
        style={{
          transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
        }}
      >
        {/* Render Canvas with Checkerboard Background for Transparencies */}
        <div className="relative max-w-full max-h-full flex items-center justify-center checkerboard-bg rounded-lg overflow-hidden shadow-2xl">
          <canvas
            ref={canvasRef}
            className={`max-w-full max-h-full object-contain shadow-xs transition-opacity duration-150 ${
              isComparing ? 'opacity-0' : 'opacity-100'
            }`}
          />
          {isInpainting && (
            <canvas
              ref={maskCanvasRef}
              onPointerDown={handleMaskPointerDown}
              onPointerMove={handleMaskPointerMove}
              onPointerUp={handleMaskPointerUp}
              onPointerCancel={handleMaskPointerUp}
              className="absolute inset-0 w-full h-full object-contain pointer-events-auto touch-none z-20 cursor-crosshair"
            />
          )}
        </div>

        {/* Hold-to-compare Original Image Overlay */}
        {originalImageSrc && (
          <img
            src={originalImageSrc}
            alt="Original unprocessed RAW"
            className={`absolute max-w-full max-h-full object-contain pointer-events-none transition-opacity duration-150 ${
              isComparing ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>

      {/* Interactive Crop Boundary Overlay (When on Crop Tab) */}
      {isCropping && (
        <div className="absolute inset-0 z-30 pointer-events-auto">
          {/* Dimmed Outside Shading */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="crop-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={`${activeCrop.x * 100}%`}
                  y={`${activeCrop.y * 100}%`}
                  width={`${activeCrop.width * 100}%`}
                  height={`${activeCrop.height * 100}%`}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.55)"
              mask="url(#crop-mask)"
            />
          </svg>

          {/* Interactive Crop Rectangle */}
          <div
            style={{
              left: `${activeCrop.x * 100}%`,
              top: `${activeCrop.y * 100}%`,
              width: `${activeCrop.width * 100}%`,
              height: `${activeCrop.height * 100}%`,
            }}
            className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move select-none"
            onPointerDown={(e) => handleCropPointerDown('move', e)}
            onPointerMove={handleCropPointerMove}
            onPointerUp={handleCropPointerUp}
            onPointerCancel={handleCropPointerUp}
          >
            {/* Rule of Thirds Grid inside active crop */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
              <div className="border-r border-b border-white/40" />
              <div className="border-r border-b border-white/40" />
              <div className="border-b border-white/40" />
              <div className="border-r border-b border-white/40" />
              <div className="border-r border-b border-white/40" />
              <div className="border-b border-white/40" />
              <div className="border-r border-white/40" />
              <div className="border-r border-white/40" />
              <div />
            </div>

            {/* Corner Handles (L-Brackets) */}
            {/* Top-Left */}
            <div
              onPointerDown={(e) => handleCropPointerDown('topLeft', e)}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              className="absolute -top-3 -left-3 w-8 h-8 border-t-3 border-l-3 border-white cursor-nwse-resize z-40 drop-shadow touch-none"
            />
            {/* Top-Right */}
            <div
              onPointerDown={(e) => handleCropPointerDown('topRight', e)}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              className="absolute -top-3 -right-3 w-8 h-8 border-t-3 border-r-3 border-white cursor-nesw-resize z-40 drop-shadow touch-none"
            />
            {/* Bottom-Left */}
            <div
              onPointerDown={(e) => handleCropPointerDown('bottomLeft', e)}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              className="absolute -bottom-3 -left-3 w-8 h-8 border-b-3 border-l-3 border-white cursor-nesw-resize z-40 drop-shadow touch-none"
            />
            {/* Bottom-Right */}
            <div
              onPointerDown={(e) => handleCropPointerDown('bottomRight', e)}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              className="absolute -bottom-3 -right-3 w-8 h-8 border-b-3 border-r-3 border-white cursor-nwse-resize z-40 drop-shadow touch-none"
            />

            {/* Edge Grip Handles */}
            <div
              onPointerDown={(e) => handleCropPointerDown('top', e)}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              className="absolute -top-3 inset-x-8 h-6 cursor-ns-resize z-30 flex items-center justify-center touch-none"
            >
              <div className="w-8 h-1 bg-white rounded-full shadow" />
            </div>
            <div
              onPointerDown={(e) => handleCropPointerDown('bottom', e)}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              className="absolute -bottom-3 inset-x-8 h-6 cursor-ns-resize z-30 flex items-center justify-center touch-none"
            >
              <div className="w-8 h-1 bg-white rounded-full shadow" />
            </div>
            <div
              onPointerDown={(e) => handleCropPointerDown('left', e)}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              className="absolute -left-3 inset-y-8 w-6 cursor-ew-resize z-30 flex items-center justify-center touch-none"
            >
              <div className="h-8 w-1 bg-white rounded-full shadow" />
            </div>
            <div
              onPointerDown={(e) => handleCropPointerDown('right', e)}
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              className="absolute -right-3 inset-y-8 w-6 cursor-ew-resize z-30 flex items-center justify-center touch-none"
            >
              <div className="h-8 w-1 bg-white rounded-full shadow" />
            </div>
          </div>
        </div>
      )}

      {/* Comparison Badge */}
      {isComparing && (
        <div className="absolute top-3 left-3 bg-surface-container-lowest/90 backdrop-blur-md px-2.5 py-1 rounded text-primary font-mono text-[10px] font-bold tracking-wider border border-outline-variant shadow-sm z-20">
          ORIGINAL RAW
        </div>
      )}

      {/* Floating Top HUD: Live Mini Histogram & Clipping Indicators */}
      <div className="absolute top-2.5 right-2.5 bg-surface-container-lowest/90 backdrop-blur-md p-1.5 rounded-lg flex flex-col gap-1 shadow-md border border-outline-variant z-20 pointer-events-auto">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[9px] font-mono font-semibold tracking-wider text-on-surface-variant">
            HISTOGRAM
          </span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" title="Shadow clipping safe" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Highlights active" />
          </div>
        </div>

        {/* SVG Mini Histogram Chart */}
        <svg className="w-24 h-7 text-primary overflow-visible" fill="none" viewBox="0 0 100 30">
          {histogram && (
            <>
              {/* Luminance fill */}
              <path
                d={getHistogramPath(histogram.l, histogram.maxCount)}
                fill="currentColor"
                fillOpacity="0.18"
              />
              {/* Luminance main stroke */}
              <path
                d={getHistogramPath(histogram.l, histogram.maxCount)}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Secondary ghost channels */}
              <path
                d={getHistogramPath(histogram.r, histogram.maxCount)}
                stroke="#e42b27"
                strokeWidth="1"
                strokeOpacity="0.5"
                fill="none"
              />
              <path
                d={getHistogramPath(histogram.b, histogram.maxCount)}
                stroke="#006481"
                strokeWidth="1"
                strokeOpacity="0.5"
                fill="none"
              />
            </>
          )}
        </svg>

        <div className="flex justify-between items-center text-[9px] text-on-surface-variant font-mono px-0.5">
          <span>0</span>
          <span className="text-primary font-semibold">
            EV {currentEV >= 0 ? `+${currentEV.toFixed(2)}` : currentEV.toFixed(2)}
          </span>
          <span>255</span>
        </div>
      </div>

      {/* Rule-of-Thirds Grid Overlay */}
      {showGrid && !isCropping && (
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-primary/20 bg-primary/5" />
          ))}
        </div>
      )}

      {/* Zoom Indicator / Reset-to-Fit Badge */}
      {zoomLevel > 1 && (
        <button
          onClick={() => {
            onResetZoom?.();
            setPanOffset({ x: 0, y: 0 });
          }}
          className="absolute top-2.5 left-2.5 z-20 px-2 py-1 rounded bg-black/60 text-white font-mono text-[10px] font-semibold backdrop-blur-md flex items-center gap-1 hover:bg-black/80 cursor-pointer shadow"
          title="Reset Zoom to Fit"
        >
          <span className="material-symbols-outlined text-[13px]">zoom_out_map</span>
          <span>{zoomLevel.toFixed(1)}x (Fit)</span>
        </button>
      )}

      {/* Floating Canvas Quick-Adjust Capsule Dock */}
      <div className="absolute bottom-2 sm:bottom-3 inset-x-0 mx-auto w-fit max-w-[95%] bg-[#070B14]/90 backdrop-blur-xl px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-lg flex items-center gap-1 sm:gap-1.5 z-20 border border-white/10">
        {/* Aspect Ratio Badge */}
        <div
          className="h-8 px-2 sm:px-2.5 rounded-full text-on-surface-variant flex items-center gap-1 font-mono text-[11px] sm:text-[12px]"
          title="Current Aspect Ratio"
        >
          <span className="material-symbols-outlined text-[15px] sm:text-[16px]">crop_rotate</span>
          <span>{activeAspect}</span>
        </div>

        <div className="w-px h-4 bg-outline-variant" />

        {/* Magic Auto Tone Button */}
        <button
          onClick={handleMagicAutoTone}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full text-primary hover:bg-primary/10 flex items-center justify-center active:scale-90 transition-all cursor-pointer touch-manipulation ${
            wandAnimating ? 'scale-125' : ''
          }`}
          title="Magic Auto Tone (One-Tap Balance)"
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[17px]">auto_fix_high</span>
        </button>

        {/* Grid Guide Toggle */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center active:scale-90 transition-all cursor-pointer touch-manipulation ${
            showGrid
              ? 'text-white bg-primary'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
          }`}
          title="Toggle Rule-of-Thirds Grid"
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[17px]">grid_goldenratio</span>
        </button>

        {/* Zoom Toggle (Fit -> 1.6x -> 2.4x -> Fit) */}
        {onZoomChange && (
          <button
            onClick={() => {
              if (zoomLevel === 1) onZoomChange(1.6);
              else if (zoomLevel === 1.6) onZoomChange(2.4);
              else {
                onZoomChange(1);
                setPanOffset({ x: 0, y: 0 });
              }
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high flex items-center justify-center active:scale-90 transition-all cursor-pointer touch-manipulation"
            title="Toggle Zoom level"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[17px]">
              {zoomLevel > 1 ? 'zoom_out' : 'zoom_in'}
            </span>
          </button>
        )}

        {/* Color Lab Quick Shortcut */}
        <button
          onClick={onOpenColorLab}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high flex items-center justify-center relative active:scale-90 transition-all cursor-pointer touch-manipulation"
          title="Open Color Lab & Palette"
        >
          <span className="material-symbols-outlined text-[16px] sm:text-[17px]">palette</span>
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_4px_rgba(191,4,17,0.6)]" />
        </button>

        {/* AI Assistant Quick Shortcut */}
        {onOpenAiAssistant && (
          <button
            onClick={onOpenAiAssistant}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full text-on-surface-variant hover:text-[#EC4899] hover:bg-surface-container-high flex items-center justify-center relative active:scale-90 transition-all cursor-pointer touch-manipulation"
            title="Open AI Photo Assistant"
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[17px] text-transparent bg-clip-text bg-gradient-to-tr from-[#8B5CF6] to-[#EC4899]">
              auto_awesome
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
