# Chroma Studio — AI Image Enhancement Audit & Technical Specification

## 1. Executive Summary & Existing Codebase Audit

### Current Status: Basic 1D Percentile Auto-Tone (Non-AI)
An audit of the Chroma Studio codebase for image enhancement, auto-adjust, sharpening, and noise reduction revealed:
1. **Existing Auto-Adjust (`calculateAutoTone` in `src/engine/pipeline.ts`):**
   * Computes cumulative 1D luminance percentiles ($p_1, p_{50}, p_{99}$) and global RGB channel averages from the histogram.
   * Performs basic global median stretching towards $122$ and rudimentary gray-world white balance.
   * **Deficiencies:**
     - It is a purely statistical 1D heuristic without spatial zone intelligence.
     - Lacks skin-tone protection; often over-saturates human faces into unnatural orange tones.
     - Does not estimate the noise floor before lifting shadows, which can severely amplify sensor noise in low-light photos.
     - Has no concept of strength levels (Subtle, Balanced, Strong).
     - Does not provide an explanation of changes or an interactive before/after review workflow.
2. **Detail & Texture Pipeline (`applySharpen` and `applyNoiseReduction`):**
   * `applySharpen`: Uses a $3 \times 3$ Laplacian unsharp masking convolution kernel.
   * `applyNoiseReduction`: Uses an edge-preserving bilateral filter.
   * Both filters are fully functional in `src/engine/pipeline.ts`, but were only controllable via manual sliders in the Adjust and Effects panels; they were not integrated into any automated or AI enhancement workflow.
3. **P0 AI Assistant & Background Removal Architecture:**
   * `src/services/ai/`: Provides structured LLM edit plans via natural-language text prompts.
   * `src/services/segmentation/`: Provides hybrid on-device and Supabase edge function background removal with memory-safe downsampling and privacy consent gating.
   * **Missing:** No dedicated automated **AI Image Enhancement** pipeline with one-tap quality improvement, strength calibration, before/after compare preview, and non-destructive parameter integration.

---

## 2. Technical Evaluation of Enhancement Approaches

| Criterion | On-Device Perceptual AI Engine | Cloud AI Multimodal Vision (`ai-enhance`) | Standard Analytical Fallback |
| :--- | :--- | :--- | :--- |
| **Privacy & Security** | **100% Private:** Zero pixel transmission outside device. | **High:** Encrypted TLS to private Supabase Edge Function; ephemerally processed in RAM. Explicit consent required. | **100% Private:** Purely local mathematics. |
| **Offline Capability** | **100% Offline:** Fully operational in offline web and Capacitor Android. | Requires active internet connection. | **100% Offline.** |
| **Latency** | **30ms–90ms:** Near-instantaneous response. | **800ms–2000ms:** Round-trip network & inference. | **5ms–15ms:** Instant. |
| **Skin Tone Preservation** | Dedicated chromatic bounds checking ($H \in [15^\circ, 45^\circ]$). | High semantic face & skin detection. | None (Global gray-world). |
| **Shadow Noise Safeguard** | Local variance noise-floor estimator prevents grainy shadows. | Semantic noise identification. | None. |
| **Labeling Integrity** | Labeled **"On-Device AI"**. | Labeled **"Cloud AI (HD)"**. | Labeled **"Analytical Auto-Enhance"** (strictly NOT mislabeled as AI). |

---

## 3. Enhancement Capabilities Specification

### A. Lighting & Tone
* **Intelligent Exposure & Brightness:** Rebalances median scene luminance based on dynamic entropy rather than simple midpoint math.
* **Contrast Optimization:** Calibrated S-curve stretching tailored to the image's dynamic range.
* **Highlight Recovery:** Compresses high-luminance zones ($> 238$) where raw pixel data exists. *Explicit Constraint:* Does not invent synthetic detail for blown-out clipped specular highlights.
* **Noise-Aware Shadow Lifting:** Lifts deep shadows while computing local gradient variance to prevent shadow grain amplification.

### B. Color & White Balance
* **Illuminant Cast Neutralization:** Samples high-confidence neutral gray regions to eliminate unnatural blue/orange/green color casts.
* **Skin-Tone Protection:** Identifies pixels within human skin chromaticity ($H \in [15^\circ, 45^\circ]$, $S \in [15\%, 65\%]$) and damps saturation boosts on those pixels while enhancing background vibrance.
* **Natural Saturation & Vibrance:** Selectively boosts under-saturated colors without clipping primary channels.

### C. Detail, Sharpening & Noise
* **Adaptive Acutance Sharpening:** Amplifies authentic structural edges while avoiding high-frequency ringing, halos, and fringing.
* **Bilateral Noise Reduction:** Smooths flat shadow regions and sensor grain while keeping object contours crisp.

### D. Multi-Tier Strength Levels
1. **Subtle (50% Intensity):** Conservative exposure adjustment, gentle shadow lift (+12), minimal sharpening (+10), low vibrance (+8). Ideal for well-exposed portraits.
2. **Balanced (100% Standard):** Optimal contrast, balanced highlight rolloff (-18), shadow recovery (+24), natural skin-safe vibrance (+14), clarity (+12), sharpening (+18), bilateral denoise (+12).
3. **Strong (140% Punch):** High dynamic range look, aggressive shadow recovery (+36), punchy contrast (+22), clarity (+20), adaptive sharpening (+28), bilateral denoise (+20).

---

## 4. User Workflow & Non-Destructive Lifecycle

```
[User opens Photo]
        │
        ▼
[Taps "AI Enhance"]
        │
        ▼
[Privacy Notice / Mode Selection]
(Defaults to On-Device AI; Cloud AI requires explicit opt-in dialog)
        │
        ▼
[Selects Strength: Subtle | Balanced | Strong]
        │
        ▼
[Progress & Real-Time Preview]
(Renders with interactive Before/After comparison toggle)
        │
        ├──► [Cancel] ──► Restores previous adjustments without alteration
        │
        ├──► [Retry]  ──► Re-evaluates with adjusted strength or mode
        │
        └──► [Apply]  ──► Commits non-destructive parameters to Undo/Redo stack
                           Stored in Project model; reproducible upon reload;
                           Export matches preview exactly.
```

---

## 5. Deployment & Privacy Guarantees

* **Zero Silent Uploads:** No photo data is sent to external servers unless the user explicitly checks consent.
* **Ephemeral Processing:** Server-side Supabase Edge Function processes requests in memory and immediately returns structured parameters; zero image data is persisted to disk or used for training.
* **Server-Side Secrets:** Gemini API keys are kept strictly within Supabase Edge secrets (`GEMINI_API_KEY`).
* **Offline Fallback:** If internet is disconnected, the system smoothly falls back to local On-Device AI or Analytical Auto-Enhance.
