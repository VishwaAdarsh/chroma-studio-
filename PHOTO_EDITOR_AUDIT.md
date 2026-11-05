# Chroma Studio — Comprehensive Photo Editor Audit

**Audit Date:** November 2026  
**Auditor:** Senior Product Engineer & Image-Processing Specialist  
**Target Application:** Chroma Studio (React 19, TypeScript, HTML5 Canvas, Tailwind CSS v4, Capacitor 7)

---

## Executive Summary

Chroma Studio contains an established, non-destructive HTML5 Canvas rendering engine with 32-bit pixel pipeline processing, ITU-R BT.709 luminance calculations, 3-way split-toning color wheels, 4-channel spline tone curves, and multi-threaded WebGL/Canvas export.

However, an in-depth audit against industry-standard photo editors (Adobe Lightroom Mobile, Darkroom, Snapseed, VSCO) reveals several **critical defects (P0)**, **high-value functional gaps (P1)**, and **advanced roadmap items (P2)**. 

This document provides a feature-by-feature matrix and action plan.

---

## 1. Feature Audit Matrix

| Feature | Status | Relevant File(s) | Current Behavior | Defect or Limitation | Recommended Fix | Priority |
|---|---|---|---|---|---|---|
| **Exposure / Brightness / Contrast** | `IMPLEMENTED` | `src/engine/pipeline.ts`<br>`src/components/panels/AdjustPanel.tsx` | Non-destructive pixel pipeline using exponential EV factor and standard contrast formula. | Works well; contrast factor scales smoothly [-100, 100]. | Retain and optimize for SIMD/typed arrays. | P2 |
| **Highlights / Shadows** | `IMPLEMENTED` | `src/engine/pipeline.ts` | Linear luminance bell curve weights around 128 midtone threshold. | Extreme adjustments can produce subtle posterization on noisy gradients. | Add smooth cubic hermite interpolation for tonal transitions. | P1 |
| **Whites / Blacks** | `IMPLEMENTED` | `src/engine/pipeline.ts` | Modulates upper (>180) and lower (<80) luminance zones. | Functional and non-destructive. | Retain. | P2 |
| **Temperature / Tint** | `IMPLEMENTED` | `src/engine/pipeline.ts` | Adjusts Kelvin warm/cool (R/B balance) and green/magenta tint. | Functional. | Retain. | P2 |
| **Saturation / Vibrance** | `IMPLEMENTED` | `src/engine/pipeline.ts` | Saturation applies global multiplier; Vibrance scales selectively based on inverse saturation. | Highly accurate vibrance behavior. | Retain. | P2 |
| **Auto-Enhance / Magic Auto Tone** | `BROKEN` | `src/App.tsx`<br>`src/components/CanvasView.tsx` | Magic Wand button calls `handleMagicAutoTone()`. | **Hardcoded static values:** Always sets exposure +0.35, contrast +18, highlights -15 regardless of the photo's actual histogram or lighting! | Compute dynamic range, median luminance, and clipping percentiles (1% black point, 99% white point) from the real histogram data. | **P0** |
| **Reset Individual & Reset All** | `PARTIAL` | `src/components/panels/AdjustPanel.tsx`<br>`src/App.tsx` | Double-clicking slider resets individual parameter; group reset exists in props but is unused. | **No "Reset All" button in Photo Editor UI.** Users must manually reset 11 sliders one by one or undo step-by-step. | Add an explicit "Reset All" action and category reset button with confirmation. | **P0** |
| **8-Channel HSL Color Mixer** | `MISSING` | `src/engine/pipeline.ts`<br>`src/types/editor.ts` | Only global hue, saturation, and vibrance exist. No channel-specific color isolation. | Cannot adjust specific colors (e.g. darken blue sky, desaturate yellow foliage, or pop red lips) like Lightroom or Darkroom. | Implement 8-channel HSL mixer (Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta) with Hue (-100..+100), Saturation (-100..+100), and Luminance (-100..+100). | **P1** |
| **Tone Curves (RGB + R/G/B)** | `IMPLEMENTED` | `src/components/ToneCurvesEditor.tsx`<br>`src/engine/pipeline.ts` | 4-channel spline curves with 256-entry lookup tables (LUTs), SVG interactive nodes. | Very responsive and robust. Intermediate points properly ordered. | Retain and add curve presets (Linear, S-Curve, High Contrast). | P1 |
| **3-Way Color Wheels** | `IMPLEMENTED` | `src/components/ColorWheelsEditor.tsx`<br>`src/engine/pipeline.ts` | Shadows, Midtones, Highlights split-toning with polar coordinate hue/sat and luminance slider. | High precision colorist tool. | Retain. | P2 |
| **Crop & Aspect Ratios** | `IMPLEMENTED` | `src/components/CanvasView.tsx`<br>`src/components/panels/CropPanel.tsx` | Freeform, 1:1, 4:5, 16:9, 9:16, 3:2, 4:3 with 9 draggable handles and rule-of-thirds grid. | Works smoothly on desktop and touch. | Retain. | P2 |
| **Rotate & Flip** | `IMPLEMENTED` | `src/components/panels/CropPanel.tsx`<br>`src/engine/pipeline.ts` | 90° clockwise rotation, horizontal flip, vertical flip. | Seamless non-destructive transform matrix. | Retain. | P2 |
| **Straighten & Auto-Crop** | `PARTIAL` | `src/components/panels/CropPanel.tsx`<br>`src/engine/pipeline.ts` | Straighten slider [-45°, +45°] with mathematical auto-crop scaling to prevent blank corners. | Reset button on slider is tiny and difficult to tap on 360px–393px mobile viewports. | Increase touch target size to $\ge 44\text{px}$ and add a 0° snap detent. | **P0** |
| **Perspective Correction** | `MISSING` | `src/engine/pipeline.ts` | No keystone horizontal/vertical perspective correction. | Architecture uses standard 2D canvas transforms without homography 3D matrix. | Plan for future WebGL shader pipeline. | P2 |
| **Preset Preview & Application** | `IMPLEMENTED` | `src/components/panels/LooksPanel.tsx`<br>`src/data/presets.ts` | 40+ curated presets with real-time intensity slider (0..100%). | Blending with custom curves and wheels works reliably. | Retain. | P2 |
| **Custom Preset Management** | `PARTIAL` | `src/components/panels/LooksPanel.tsx`<br>`src/services/storage.ts` | Saving and deleting custom recipes is implemented. | **Cannot rename or duplicate custom presets.** No export/import of preset files. | Add inline rename, duplicate preset, and JSON preset export/import. | **P1** |
| **Copy / Paste Adjustments** | `MISSING` | `src/App.tsx`<br>`src/components/Header.tsx` | No clipboard or adjustment transfer between photos. | User cannot apply an edit recipe from photo A to photo B without saving as a global preset. | Add "Copy Edits" and "Paste Edits" actions in Header and context menus. | **P1** |
| **Batch Photo Processing** | `MISSING` | `src/components/projects/MyProjectsView.tsx` | Only single-photo editing workspace exists. | Cannot select 10 photos and paste adjustments across all. | High value for pro users, deferred to future multi-select workflow. | P2 |
| **Undo / Redo & History** | `IMPLEMENTED` | `src/App.tsx`<br>`src/components/Header.tsx` | Discrete history snapshots (24 levels) with continuous slider gesture debouncing. | Works reliably without memory leaks. | Retain. | P2 |
| **Before / After Comparison** | `IMPLEMENTED` | `src/components/Header.tsx`<br>`src/components/CanvasView.tsx` | Hold-to-compare button and spacebar shortcut swaps rendered canvas with original photo. | Clean instant comparison. | Retain. | P2 |
| **Clarity** | `IMPLEMENTED` | `src/engine/pipeline.ts` | Fast separable 1D box blur with sinusoidal midtone bell curve boost. | Non-destructive, high visual quality. | Retain. | P2 |
| **Sharpening** | `IMPLEMENTED` | `src/engine/pipeline.ts` | Discrete 3x3 Laplacian edge acutance kernel. | Good edge crispness. | Retain. | P2 |
| **Noise Reduction (Denoise)** | `MISSING` | `src/engine/pipeline.ts`<br>`src/components/panels/EffectsPanel.tsx` | Grain and sharpen exist, but luminance/color noise reduction is absent. | High-ISO photos and noisy mobile shots cannot be cleaned up. | Implement edge-preserving bilateral filter or median box luminance filter for noise reduction. | **P1** |
| **Vignette & Film Grain** | `IMPLEMENTED` | `src/engine/pipeline.ts`<br>`src/components/panels/EffectsPanel.tsx` | Radial gradient darkening and Gaussian noise grain simulation. | Matte Black Fade also supported. | Retain. | P2 |
| **Selective Brush Masks** | `MISSING` | `src/components/CanvasView.tsx` | No brush or local mask canvas overlay. | Edits are global only. | High complexity; requires layered canvas mask engine. | P2 |
| **Linear / Radial Gradients** | `MISSING` | `src/engine/pipeline.ts` | No graduated exposure / tint filters. | Cannot simulate graduated neutral density (GND) filters on skies. | High pro value; plan for selective editing module. | P2 |
| **Blemish Healing / Removal** | `MISSING` | `src/components/CanvasView.tsx` | No patch or clone stamp tool. | Basic retouching requires external tools. | Plan patch clone stamp for future phase. | P2 |
| **Import Formats & Safety** | `IMPLEMENTED` | `src/App.tsx`<br>`src/engine/pipeline.ts` | JPG, PNG, WebP, DNG, RAW, HEIC with 100MB limit and 48MP/8192px auto-downscaling. | Prevents browser OOM crashes on massive camera files. | Retain. | P2 |
| **Export Fidelity & Metadata** | `PARTIAL` | `src/components/ExportModal.tsx`<br>`src/App.tsx` | JPEG, PNG, WebP export with quality and dimension scaling up to 4K. | "Strip EXIF" toggle exists in modal, but does not sanitize canvas blob metadata or report stripped state explicitly. | Ensure canvas blob generation cleanly outputs sanitized stripped JPEG/PNG. | **P0** |
| **Mobile Touch Targets & Scrubber Usability** | `PARTIAL` | `src/components/Scrubber.tsx`<br>`src/components/Header.tsx` | Touch scrubbers and header buttons exist with basic touch targets. | Small screen widths (360px) suffer from crowded top header buttons; single active parameter pill bar requires excessive scrolling. | Add quick category switcher tab, larger touch targets ($\ge 48\text{dp}$), and haptic feedback. | **P1** |

---

## 2. Priority Ranking & Remediation Plan

### Phase 2: Fix P0 Critical Defects
1. **Histogram-Driven Intelligent Auto-Tone:** Replace hardcoded static constants in `handleMagicAutoTone` with algorithmic histogram dynamic-range calculation (dynamic exposure balancing, highlight recovery, shadow lift, contrast expansion, and auto white balance).
2. **Master "Reset All Adjustments" & Group Reset:** Add a clear reset mechanism in the photo editor header and panels with confirmation, restoring the image to neutral without destroying crop/geometry.
3. **Straighten Slider Touch & Snap:** Improve `CropPanel` straighten slider with snap-to-zero detent and accessible touch targets.
4. **Export Sanitization & Metadata Handling:** Verify lossless canvas export without metadata leakage when "Strip Metadata" is checked.

### Phase 3: Implement Verified High-Value Gaps (P1)
1. **8-Channel HSL Color Mixer (Color Lab Tab):**
   - Add Red, Orange, Yellow, Green, Aqua, Blue, Purple, Magenta channels to `AdjustmentParameters` and state model.
   - Implement pixel-level HSL range qualification and delta shifts in `src/engine/pipeline.ts`.
   - Build a responsive HSL channel selector and Hue / Saturation / Luminance scrubbers in `ColorLab` panel.
2. **Detail Noise Reduction (Denoise):**
   - Add `noiseReduction` (0..100) to `AdjustmentParameters`.
   - Implement an edge-preserving bilateral smoothing filter in `src/engine/pipeline.ts`.
   - Expose in `EffectsPanel`.
3. **Copy & Paste Adjustment Recipes:**
   - Add "Copy Edits" and "Paste Edits" in `Header.tsx` and project actions.
   - Allows creators to copy all tone, color, HSL, curves, and effects parameters to clipboard and apply them to any photo instantly.
4. **Preset Renaming & Duplication:**
   - Add inline rename and duplicate actions to custom presets in `LooksPanel.tsx`.

### Phase 4: UI/UX Quality & Mobile Ergonomics
- Ensure all sliders, pills, and buttons meet $\ge 48\text{dp}$ mobile touch guidelines.
- Responsive layout adjustments for viewports from 360px to 4K.
- Zero visual regression in Templates, Collage, Carousel, and My Projects libraries.

---

## 3. Verification & Compliance Criteria
- 100% of existing tests must continue to pass.
- New unit and integration tests must cover:
  - Histogram auto-enhancement calculations.
  - 8-Channel HSL color channel shifts.
  - Detail noise reduction filtering.
  - Copy/paste adjustments clipboard serialization.
  - Reset all functionality.
- Production build (`tsc -b && vite build`) and Capacitor sync must succeed cleanly with zero errors.
