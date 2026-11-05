# Chroma Studio — AI Background Replacement Audit & Technical Specification

**Date:** November 1, 2026  
**Status:** In Progress — Implementation Phase  
**Scope:** AI-powered background replacement, subject segmentation reuse, multi-mode backdrop compositing (Solid Color, Uploaded Image, AI-Generated Scene), non-destructive project state, and touch-optimized UI.

---

## 1. Executive Summary & Audit of Existing Systems

Before implementing background replacement, an exhaustive audit of the Chroma Studio codebase was conducted:

| System / Subsystem | Current State | Compatibility & Integration Path |
| :--- | :--- | :--- |
| **Foreground Subject Segmentation** | Fully implemented in `src/services/segmentation/` (`OnDeviceSegmenter` & `SupabaseSegmenter`). | **100% Reusable.** When a photo has already been segmented (`cutout.enabled = true` and `cutout.maskAlpha` is present), background replacement immediately reuses the high-resolution alpha mask without re-computing. If not yet segmented, the system invokes segmentation automatically. |
| **Canvas Compositing & Alpha** | `src/engine/pipeline.ts` (`processImage` & `applyCutout`). | `applyCutout` sets background alpha to 0. We enhance the compositing pipeline to support multi-layer rendering: rendering the chosen backdrop (color, image, or AI scene with fit/scale/offset/blur) and compositing the scaled/positioned foreground subject with edge anti-aliasing. |
| **AI Backend & Secrets Architecture** | Supabase Edge Functions (`ai-assistant`, `ai-segmentation`, `ai-enhance`, `ai-inpaint`) on project `fbtiigdfglailzjzfryp`. | Add and deploy `ai-background-gen` to handle prompt-driven scene generation on the server side with zero client-side credential exposure and strict user consent gating. |
| **Editor Document Model & State** | `Project` interface in `src/types/editor.ts`. | Add `BackgroundReplacementState` to `Project` and `App.tsx`. Stores replacement mode, colors, background asset data URLs, AI prompt, foreground/background transforms, and edge blending parameters. |
| **Undo / Redo Fidelity** | History stacks in `src/App.tsx` (`historyPast`, `historyFuture`). | Snapshot capture records complete `backgroundReplacement` state alongside `cutout`, `adjustments`, and `geometry`, ensuring atomic undo/redo steps. |
| **Export Pipeline** | `src/App.tsx` export canvas handler. | PNG exports support full composite or isolated transparent subject; JPEG exports render the composite cleanly without white/black fringe artifacts. |

---

## 2. Background Replacement Modes

Chroma Studio supports three distinct, mutually compatible backdrop modes:

### A. Solid Color Studio Backdrop
- **Presets:** Studio White (`#FFFFFF`), Dark Luxury (`#070B14`), Slate Gray (`#64748B`), Warm Sand (`#F5EBE0`), Neon Violet (`#8B5CF6`), Sunset Coral (`#F43F5E`), Emerald (`#10B981`), Ocean Blue (`#0EA5E9`).
- **Custom Color:** Interactive HTML color picker supporting any 24-bit hex value.
- **Latency:** Instant 60fps canvas re-render.

### B. Uploaded Custom Image
- **Import:** Local file input accepting PNG, JPEG, and WebP images.
- **Fit Modes:**
  - `cover`: Fills viewport, maintaining aspect ratio (default).
  - `contain`: Fits within canvas without cropping.
  - `fill`: Stretches to fill dimensions.
- **Transformations:**
  - Background Zoom/Scale (0.5x to 2.5x).
  - Background Pan X/Y (-50% to +50%).
  - Depth-of-Field Blur (0 to 20px) to simulate wide-aperture portrait optics ($f/1.4$ bokeh).

### C. AI-Generated Scene Backdrop
- **Natural Language Prompting:** Users input scene descriptions (e.g., *"Sunset beach with golden hour lighting and gentle tide"*).
- **Curated Prompt Quick-Chips:** Single-tap prompt starters for common commercial/creative portraits (Studio Minimalist, Cyberpunk Night, Mountain Sunrise, Coffee Shop Bokeh, Tropical Palms).
- **Privacy Consent Gate:** External network transmission is strictly blocked until the user provides explicit consent via a confirmation dialog.
- **Engine:** Supabase Edge Function `ai-background-gen` with offline neural style synthesis fallback.

---

## 3. Foreground Subject & Compositing Pipeline

### Non-Destructive Layer Separation
The original user photo `imageSrc` is **never destructively altered or flattened**. The compositing pipeline evaluates:
$$\text{Output}(x, y) = \text{Subject}(x', y') \cdot \alpha(x', y') + \text{Backdrop}(x'', y'') \cdot (1 - \alpha(x', y'))$$
where $(x', y')$ accounts for foreground transforms ($\text{scale}_{\text{fg}}, \Delta x_{\text{fg}}, \Delta y_{\text{fg}}$) and $(x'', y'')$ accounts for background transforms ($\text{scale}_{\text{bg}}, \Delta x_{\text{bg}}, \Delta y_{\text{bg}}$).

### Edge Refinement & Halo Elimination
1. **Defringe / Feather:** A localized edge radius (0–10px) attenuates color contamination from the original background onto the foreground perimeter.
2. **Poisson Alpha Blending:** High-frequency hair strands and transparent glasses preserve continuous 8-bit alpha transitions ($0 \le \alpha \le 255$).

---

## 4. Mobile Responsiveness & Touch Architecture

- **Touch Targets:** All buttons, chips, and scrubber handles meet or exceed Apple/Google accessibility guidelines ($\ge 44\text{px}$).
- **Panel Layout:** Scrollable panel with sticky action bars, preventing viewport clipping on screens as narrow as $320\text{px}$.
- **Performance:** Preview canvases are constrained to device pixel limits (max 1280px preview dimension) to avoid mobile GPU memory overflows.

---

## 5. Persistence & Serialization

```typescript
export interface BackgroundTransform {
  scale: number;        // 0.5 to 2.5
  offsetX: number;      // -50% to +50%
  offsetY: number;      // -50% to +50%
  fit: 'cover' | 'contain' | 'fill';
  blur: number;         // 0 to 20px simulated bokeh
}

export interface ForegroundTransform {
  scale: number;        // 0.5 to 1.5
  offsetX: number;      // -50% to +50%
  offsetY: number;      // -50% to +50%
}

export interface BackgroundReplacementState {
  enabled: boolean;
  mode: 'color' | 'image' | 'ai';
  color: string;
  imageSrc?: string;
  imageName?: string;
  aiPrompt?: string;
  aiGeneratedSrc?: string;
  aiProvider?: 'cloud' | 'local-synth';
  hasUserConsent?: boolean;
  bgTransform: BackgroundTransform;
  fgTransform: ForegroundTransform;
  feather: number;
  updatedAt?: number;
}
```

The state is stored directly within `Project.backgroundReplacement`, ensuring seamless IndexedDB storage and Supabase cloud sync.
