# Chroma Studio — AI Workflow Integration & QA Audit

**Date:** 2026-11-01  
**Project:** Chroma Studio  
**Target:** P3 AI Workflow Integration & QA  

---

## 1. System-Wide Implementation Audit

| Feature | Implementation Status | Provider / Engine | Non-Destructive | Undo/Redo | Edge Function | Status Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AI Editing Assistant** | **Implemented** | Gemini 1.5 Flash / Semantic fallback | Yes (parameter diffs) | Yes (`commitImmediateHistory`) | `ai-assistant` (Active v3) | Live preview, diff toggles, cancellation via `AbortSignal`, parameter limit clamping. |
| **AI Background Removal** | **Implemented** | MediaPipe Selfie Segmentation + Color-clustering fallback + Cloud AI | Yes (separate `CutoutState` & alpha mask) | Yes | `ai-segmentation` (Active v1) | Real transparency, feather, invert, matte color backing. |
| **AI Image Enhancement** | **Implemented** | Photometric ITU-R BT.601 + Statistical Tone Analyzer + Cloud AI | Yes (adjustment offsets + state) | Yes | `ai-enhance` (Active v1) | Auto tone, contrast optimization, highlight recovery, detail enhancement with subtle/balanced/strong presets. |
| **AI Object Removal** | **Implemented** | Canvas PatchMatch / Telea texture inpainting + Cloud AI Inpaint | Non-destructive preview; destructive apply on source buffer | Yes (stores pre-inpaint snapshot in `historyPast`) | `ai-inpaint` (Active v1) | Mask canvas overlay with brush/eraser, undo/redo stroke stack, live preview compare. |
| **AI Background Replacement** | **Implemented** | Cutout alpha compositing + Generative Backdrop + Solid colors | Yes (`BackgroundReplacementState` separate from subject) | Yes | `ai-background-gen` (Active v1) | Solid color matting, custom image upload, generative prompt backdrop synthesis, feather & lighting blend. |
| **AI Image Generation** | **Implemented** | Server-side diffusion model via Supabase Edge Function | New Project creation / Backdrop import | N/A (creates new root project) | `ai-image-gen` (Active v1) | 6 aesthetic styles, 4 aspect ratios, prompt length/safety filters, cancel & download. |
| **Smart Presets** | **Implemented** | On-device photometric vision (<10ms) + Cloud AI Aesthetic Match | Yes (interpolated via `blendPresetAdjustments`) | Yes | `ai-preset-rec` (Active v1) | Evaluates luminance, contrast, warmth, skin tones, greenery, sky. Curates top 4-6 presets with match scores and explanations. |
| **Project Persistence & Cloud Sync** | **Implemented** | IndexedDB / LocalStorage + Supabase PostgreSQL & Storage | Yes (complete project serialization) | Yes | `projects` table + RLS | Stores all adjustments, activePresetId, cutout, backgroundReplacement, enhancement, inpaint state. |

---

## 2. Identified Cross-Feature Issues & Gaps

### Issue A: Fragmented Entry Points Across Tool Dock
* **Observation**: AI tools were scattered across different bottom tabs (`cutout`, `backdrop`, `inpaint`, and `ai` which only hosted `enhance`, `assistant`, `generate`). Smart Presets lived inside `looks`.
* **Impact**: Users in the `ai` tab did not have immediate awareness or access to Background Removal, Background Replacement, or Object Erasure without leaving the AI workspace.
* **Resolution**: Unify the `ai` tab with a master AI Hub navigation bar that includes direct navigation to all 6 AI workflows (`Enhance`, `Assistant`, `Generate`, `Cutout`, `Backdrop`, `Erase`), keeping unified context while maintaining single-tab bottom navigation.

### Issue B: Dangling Ephemeral Previews on Tab Switch
* **Observation**: When previewing an AI Assistant plan or AI Enhancement (`aiPreviewState`), or an Object Removal mask preview (`inpaintPreviewUrl`), switching tabs (e.g. to `adjust` or `crop`) did not reset the ephemeral preview.
* **Impact**: Uncommitted AI adjustments or inpaint preview buffers remained visible on canvas while using other tools, creating confusing UI state.
* **Resolution**: Add an effect in `src/App.tsx` that resets `aiPreviewState` and `inpaintPreviewUrl` whenever `activeTab` changes, ensuring preview isolation.

### Issue C: Vulnerability to Duplicate Requests (Rapid Clicks / Spamming)
* **Observation**: Action handlers across `AiAssistantPanel`, `BackgroundReplacementPanel`, `CutoutPanel`, `InpaintPanel`, `AiEnhancePanel`, `AiImageGenPanel`, and `LooksPanel` lacked immediate guards (`if (isProcessing) return;`) before initiating async workflows.
* **Impact**: Double-tapping on mobile or rapid clicks could launch multiple concurrent async promises, leading to race conditions and wasted resources.
* **Resolution**: Add explicit defensive guards to all AI execution handlers and disable submit buttons during active network requests.

### Issue D: Distinction Between Image Edits vs Generated Image Imports
* **Observation**: In `handleOpenGeneratedInEditor`, opening a generated image immediately re-initialized the project without auto-saving the user's previously active image project. Additionally, there was no option to import a generated image directly as a background replacement layer.
* **Impact**: Unsaved work on an existing project could be lost if a user generated an image while editing.
* **Resolution**:
  1. Auto-save the active project via `saveCurrentProjectToStorage()` prior to opening a generated image as a new project.
  2. Add an "Insert as Backdrop Layer" action in `AiImageGenPanel` that assigns the generated image to `backgroundReplacement.imageSrc` and switches to `backdrop` tab.

### Issue E: Memory Hygiene & Abort Signal Cleanup
* **Observation**: In-flight AI requests that were aborted when unmounting or switching tools needed consistent signal propagation across all service adapters.
* **Impact**: Stale responses could potentially attempt to resolve against unmounted panel state.
* **Resolution**: Standardize `AbortController` cancellation across all 7 AI services and verify component unmount cleanup hooks.

---

## 3. Security, Privacy & Secret Exposure Verification

1. **Frontend Bundle Audit**:
   - Zero private API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`) are referenced in client code.
   - Client only uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
2. **Server-Side Key Storage**:
   - Keys reside exclusively in Supabase Edge Function environment secrets.
3. **Privacy Consent Gating**:
   - Every cloud-bound operation (`ai-assistant`, `ai-segmentation`, `ai-enhance`, `ai-inpaint`, `ai-background-gen`, `ai-image-gen`, `ai-preset-rec`) requires explicit user consent before transmitting any remote request.
   - On-device alternatives are clearly labeled with transparent badges (*"Analytical Smart Match (On-Device Vision Analysis)"*, *"On-Device AI"*, *"100% Private"*).
4. **Data Retention**:
   - Edge functions process image buffers ephemerally in-memory; no images are retained on disk or used for model training.

---

## 4. Mobile Responsiveness & Accessibility Check

* **Viewport Widths**:
  - `320px` (iPhone SE original / small Android): Touch targets $\ge 44\text{px}$, horizontal tab scroller with hidden scrollbar.
  - `360px` (Standard Android baseline): Dock fits compact buttons with clear iconography.
  - `375px`, `390px`, `430px` (Modern iOS & Android): Full safe-area inset padding at bottom (`env(safe-area-inset-bottom)`).
* **Keyboard Navigation & Accessibility**:
  - Focus outlines on actionable controls.
  - ARIA status and screen-reader accessible progress states (`aria-live="polite"`).
  - Clear error dialogs with dismiss actions.
