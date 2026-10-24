import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CURVES,
  DEFAULT_GEOMETRY,
  DEFAULT_WHEELS,
} from '../constants/defaults';
import type { AdjustmentParameters, ColorWheels, GeometryState, ToneCurves } from '../types/editor';

interface HistorySnapshot {
  adjustments: AdjustmentParameters;
  activePresetId: string | null;
  presetIntensity: number;
  geometry: GeometryState;
  curves: ToneCurves;
  wheels: ColorWheels;
}

class HistoryManager {
  public historyPast: HistorySnapshot[] = [];
  public historyFuture: HistorySnapshot[] = [];
  public isInteracting = false;
  public preInteractionSnapshot: HistorySnapshot | null = null;

  public state: HistorySnapshot = {
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    activePresetId: null,
    presetIntensity: 100,
    geometry: JSON.parse(JSON.stringify(DEFAULT_GEOMETRY)),
    curves: JSON.parse(JSON.stringify(DEFAULT_CURVES)),
    wheels: JSON.parse(JSON.stringify(DEFAULT_WHEELS)),
  };

  public captureSnapshot(): HistorySnapshot {
    return {
      adjustments: { ...this.state.adjustments },
      activePresetId: this.state.activePresetId,
      presetIntensity: this.state.presetIntensity,
      geometry: JSON.parse(JSON.stringify(this.state.geometry)),
      curves: JSON.parse(JSON.stringify(this.state.curves)),
      wheels: JSON.parse(JSON.stringify(this.state.wheels)),
    };
  }

  public onInteractionStart() {
    if (!this.isInteracting) {
      this.preInteractionSnapshot = this.captureSnapshot();
      this.isInteracting = true;
    }
  }

  public setAdjustment(param: keyof AdjustmentParameters, value: number) {
    this.state.adjustments[param] = value;
  }

  public onInteractionEnd() {
    if (this.isInteracting && this.preInteractionSnapshot) {
      const prev = this.preInteractionSnapshot;
      const curr = this.captureSnapshot();
      if (JSON.stringify(prev) !== JSON.stringify(curr)) {
        this.historyPast.push(prev);
        this.historyFuture = [];
      }
      this.isInteracting = false;
      this.preInteractionSnapshot = null;
    }
  }

  public commitImmediate() {
    this.historyPast.push(this.captureSnapshot());
    this.historyFuture = [];
  }

  public undo() {
    if (this.historyPast.length === 0) return;
    const previous = this.historyPast.pop()!;
    this.historyFuture.unshift(this.captureSnapshot());
    this.state = previous;
  }

  public redo() {
    if (this.historyFuture.length === 0) return;
    const next = this.historyFuture.shift()!;
    this.historyPast.push(this.captureSnapshot());
    this.state = next;
  }
}

describe('History Manager: Single Commit Per Gesture', () => {
  it('groups continuous drag gestures into a single logical history commit', () => {
    const manager = new HistoryManager();

    expect(manager.state.adjustments.exposure).toBe(0);
    expect(manager.historyPast.length).toBe(0);

    // User presses pointer down to drag exposure slider
    manager.onInteractionStart();

    // 50 continuous slider movements during drag
    for (let i = 1; i <= 50; i++) {
      manager.setAdjustment('exposure', i * 0.02);
    }
    expect(manager.state.adjustments.exposure).toBeCloseTo(1.0);

    // During drag, no history snapshots are committed yet
    expect(manager.historyPast.length).toBe(0);

    // User releases pointer
    manager.onInteractionEnd();

    // Exactly ONE snapshot is committed to history past
    expect(manager.historyPast.length).toBe(1);
    expect(manager.historyPast[0].adjustments.exposure).toBe(0);

    // A single undo returns directly to 0.0 EV (pre-drag value)
    manager.undo();
    expect(manager.state.adjustments.exposure).toBe(0);
    expect(manager.historyFuture.length).toBe(1);

    // Redo restores 1.0 EV
    manager.redo();
    expect(manager.state.adjustments.exposure).toBeCloseTo(1.0);
  });

  it('does not commit a history snapshot if slider ended with no net change', () => {
    const manager = new HistoryManager();

    manager.onInteractionStart();
    manager.setAdjustment('contrast', 15);
    manager.setAdjustment('contrast', 0); // dragged back to origin
    manager.onInteractionEnd();

    expect(manager.historyPast.length).toBe(0);
  });

  it('commits discrete actions immediately', () => {
    const manager = new HistoryManager();

    // Immediate commit for reset
    manager.commitImmediate();
    manager.setAdjustment('exposure', 0);

    expect(manager.historyPast.length).toBe(1);
  });
});
