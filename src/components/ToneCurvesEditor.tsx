import React, { useRef, useState } from 'react';
import type { CurvePoint, ToneCurves } from '../types/editor';
import { buildCurveLUT } from '../engine/pipeline';

interface ToneCurvesEditorProps {
  curves: ToneCurves;
  onChange: (curves: ToneCurves) => void;
  onReset: () => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

type Channel = 'rgb' | 'red' | 'green' | 'blue';

export const ToneCurvesEditor: React.FC<ToneCurvesEditorProps> = ({
  curves,
  onChange,
  onReset,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const [activeChannel, setActiveChannel] = useState<Channel>('rgb');
  const [selectedPointIdx, setSelectedPointIdx] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragPointIdxRef = useRef<number | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);

  const currentPoints = curves[activeChannel];

  const channelColors: Record<Channel, string> = {
    rgb: '#bf0411',
    red: '#e42b27',
    green: '#006481',
    blue: '#a7382e',
  };

  const channelLabels: Record<Channel, string> = {
    rgb: 'RGB Master',
    red: 'Red',
    green: 'Green',
    blue: 'Blue',
  };

  // Build accurate SVG path from the 256-entry curve LUT
  const getLUTPathData = (pts: CurvePoint[]) => {
    const lut = buildCurveLUT(pts);
    const step = 4; // Sample every 4 values for 64 smooth path segments
    let d = `M 0,${160 - (lut[0] / 255) * 160}`;
    for (let i = step; i < 256; i += step) {
      const x = (i / 255) * 160;
      const y = 160 - (lut[i] / 255) * 160;
      d += ` L ${x.toFixed(1)},${y.toFixed(1)}`;
    }
    d += ` L 160,${160 - (lut[255] / 255) * 160}`;
    return d;
  };

  // Convert client pointer coordinates to curve [0, 255] space
  const clientToCurveCoord = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!graphRef.current) return { x: 0, y: 0 };
    const rect = graphRef.current.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    return {
      x: Math.round(normX * 255),
      y: Math.round(normY * 255),
    };
  };

  // Pointer Down on a specific control point
  const handlePointPointerDown = (idx: number, e: React.PointerEvent) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragPointIdxRef.current = idx;
    setSelectedPointIdx(idx);
    e.currentTarget.setPointerCapture(e.pointerId);
    onInteractionStart?.();
  };

  // Pointer Move on point
  const handlePointPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || dragPointIdxRef.current === null) return;
    const idx = dragPointIdxRef.current;
    const { x: rawX, y: rawY } = clientToCurveCoord(e.clientX, e.clientY);

    const pts = [...currentPoints];
    const n = pts.length;

    let targetX = rawX;
    const targetY = Math.max(0, Math.min(255, rawY));

    if (idx === 0) {
      // Start endpoint is anchored to x = 0
      targetX = 0;
    } else if (idx === n - 1) {
      // End endpoint is anchored to x = 255
      targetX = 255;
    } else {
      // Intermediate points must stay strictly ordered between neighbors
      const minX = pts[idx - 1].x + 2;
      const maxX = pts[idx + 1].x - 2;
      targetX = Math.max(minX, Math.min(maxX, rawX));
    }

    pts[idx] = { x: targetX, y: targetY };
    onChange({
      ...curves,
      [activeChannel]: pts,
    });
  };

  // Pointer Up
  const handlePointPointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      dragPointIdxRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      onInteractionEnd?.();
    }
  };

  // Add new control point by clicking on graph area
  const handleGraphClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (currentPoints.length >= 8) return;
    const { x, y } = clientToCurveCoord(e.clientX, e.clientY);

    // Don't add if too close to existing point in X
    const tooClose = currentPoints.some((pt) => Math.abs(pt.x - x) < 8);
    if (tooClose) return;

    onInteractionStart?.();
    const newPoints = [...currentPoints, { x, y }].sort((a, b) => a.x - b.x);
    const newIdx = newPoints.findIndex((pt) => pt.x === x && pt.y === y);
    setSelectedPointIdx(newIdx >= 0 ? newIdx : null);

    onChange({
      ...curves,
      [activeChannel]: newPoints,
    });
    onInteractionEnd?.();
  };

  // Delete selected intermediate point
  const handleDeleteSelectedPoint = () => {
    if (selectedPointIdx === null) return;
    if (selectedPointIdx === 0 || selectedPointIdx === currentPoints.length - 1) return; // cannot delete endpoints

    onInteractionStart?.();
    const newPoints = currentPoints.filter((_, i) => i !== selectedPointIdx);
    setSelectedPointIdx(null);
    onChange({
      ...curves,
      [activeChannel]: newPoints,
    });
    onInteractionEnd?.();
  };

  // Reset active channel to linear
  const handleResetActiveChannel = () => {
    onInteractionStart?.();
    setSelectedPointIdx(null);
    onChange({
      ...curves,
      [activeChannel]: [
        { x: 0, y: 0 },
        { x: 255, y: 255 },
      ],
    });
    onInteractionEnd?.();
  };

  const selectedPt =
    selectedPointIdx !== null && selectedPointIdx < currentPoints.length
      ? currentPoints[selectedPointIdx]
      : null;

  return (
    <div className="w-full bg-surface-container-low p-3 rounded-xl border border-outline-variant space-y-3 shadow-xs">
      {/* Channel Tabs & Reset */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-surface-container-lowest rounded-lg border border-outline-variant shadow-xs">
          {(['rgb', 'red', 'green', 'blue'] as Channel[]).map((ch) => (
            <button
              key={ch}
              onClick={() => {
                setActiveChannel(ch);
                setSelectedPointIdx(null);
              }}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                activeChannel === ch
                  ? 'bg-surface-container-high text-on-surface shadow-xs font-bold'
                  : 'text-outline hover:text-on-surface'
              }`}
              style={{
                color: activeChannel === ch ? channelColors[ch] : undefined,
              }}
            >
              {ch}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleResetActiveChannel}
            className="text-[10px] text-outline hover:text-primary px-2 py-1 rounded bg-surface-container-high border border-outline-variant font-semibold cursor-pointer"
            title="Reset current channel to flat line"
          >
            Reset {activeChannel.toUpperCase()}
          </button>
          <button
            onClick={onReset}
            className="text-[10px] text-outline hover:text-primary flex items-center gap-0.5 px-2 py-1 rounded bg-surface-container-high border border-outline-variant font-semibold cursor-pointer"
            title="Reset all 4 curve channels"
          >
            <span className="material-symbols-outlined text-[12px]">refresh</span>
            <span>ALL</span>
          </button>
        </div>
      </div>

      {/* SVG Interactive Tone Curve Workspace */}
      <div className="flex flex-col items-center gap-2">
        <div
          ref={graphRef}
          onClick={handleGraphClick}
          className="relative w-[160px] h-[160px] bg-surface-container-lowest rounded-lg border border-outline-variant overflow-hidden shadow-inner cursor-crosshair select-none touch-none"
        >
          {/* Grid Lines (4x4) */}
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="border-r border-b border-outline-variant/30" />
            ))}
          </div>

          {/* Diagonal Linear Reference */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <line x1="0" y1="160" x2="160" y2="0" stroke="#e6bdb8" strokeDasharray="3,3" />
          </svg>

          {/* Real LUT Curve Path */}
          <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
            <path
              d={getLUTPathData(currentPoints)}
              fill="none"
              stroke={channelColors[activeChannel]}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Interactive Control Points */}
          {currentPoints.map((pt, idx) => {
            const posX = (pt.x / 255) * 160;
            const posY = 160 - (pt.y / 255) * 160;
            const isSelected = selectedPointIdx === idx;

            return (
              <div
                key={idx}
                onPointerDown={(e) => handlePointPointerDown(idx, e)}
                onPointerMove={handlePointPointerMove}
                onPointerUp={handlePointPointerUp}
                onPointerCancel={handlePointPointerUp}
                className={`absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md cursor-grab active:cursor-grabbing transition-transform ${
                  isSelected ? 'scale-130 ring-2 ring-primary ring-offset-1' : 'hover:scale-120'
                }`}
                style={{
                  left: `${posX}px`,
                  top: `${posY}px`,
                  backgroundColor: channelColors[activeChannel],
                }}
                title={`Point ${idx + 1}: (${pt.x}, ${pt.y})`}
              />
            );
          })}
        </div>

        {/* Selected Point Readout & Actions */}
        <div className="flex items-center justify-between w-[160px] text-[10px] font-mono text-on-surface-variant">
          {selectedPt ? (
            <>
              <span>
                IN:<strong className="text-primary">{selectedPt.x}</strong> OUT:
                <strong className="text-primary">{selectedPt.y}</strong>
              </span>
              {selectedPointIdx !== null &&
                selectedPointIdx > 0 &&
                selectedPointIdx < currentPoints.length - 1 && (
                  <button
                    onClick={handleDeleteSelectedPoint}
                    className="text-error hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Delete selected point"
                  >
                    <span className="material-symbols-outlined text-[12px]">delete</span>
                    <span>DEL</span>
                  </button>
                )}
            </>
          ) : (
            <span className="text-[9px] text-outline text-center w-full">
              Tap graph to add point • Drag to edit
            </span>
          )}
        </div>
      </div>

      {/* Quick Curve Presets */}
      <div className="grid grid-cols-4 gap-1.5 pt-1">
        <button
          onClick={() => {
            onInteractionStart?.();
            onChange({
              ...curves,
              [activeChannel]: [
                { x: 0, y: 0 },
                { x: 64, y: 45 },
                { x: 192, y: 215 },
                { x: 255, y: 255 },
              ],
            });
            onInteractionEnd?.();
          }}
          className="py-1 px-1 rounded-lg bg-surface-container-lowest text-[10px] font-medium text-on-surface hover:border-primary border border-outline-variant transition-all text-center shadow-xs cursor-pointer"
        >
          S-Curve
        </button>

        <button
          onClick={() => {
            onInteractionStart?.();
            onChange({
              ...curves,
              [activeChannel]: [
                { x: 0, y: 35 },
                { x: 128, y: 128 },
                { x: 255, y: 240 },
              ],
            });
            onInteractionEnd?.();
          }}
          className="py-1 px-1 rounded-lg bg-surface-container-lowest text-[10px] font-medium text-on-surface hover:border-primary border border-outline-variant transition-all text-center shadow-xs cursor-pointer"
        >
          Matte Lift
        </button>

        <button
          onClick={() => {
            onInteractionStart?.();
            onChange({
              ...curves,
              [activeChannel]: [
                { x: 0, y: 0 },
                { x: 128, y: 135 },
                { x: 210, y: 200 },
                { x: 255, y: 235 },
              ],
            });
            onInteractionEnd?.();
          }}
          className="py-1 px-1 rounded-lg bg-surface-container-lowest text-[10px] font-medium text-on-surface hover:border-primary border border-outline-variant transition-all text-center shadow-xs cursor-pointer"
        >
          Roll-off
        </button>

        <button
          onClick={() => {
            onInteractionStart?.();
            onChange({
              ...curves,
              [activeChannel]: [
                { x: 0, y: 0 },
                { x: 255, y: 255 },
              ],
            });
            onInteractionEnd?.();
          }}
          className="py-1 px-1 rounded-lg bg-surface-container-lowest text-[10px] font-medium text-on-surface hover:border-primary border border-outline-variant transition-all text-center shadow-xs cursor-pointer"
        >
          Linear
        </button>
      </div>
    </div>
  );
};
