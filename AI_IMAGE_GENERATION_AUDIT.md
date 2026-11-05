# Chroma Studio — AI Image Generation Technical Audit & Specification

**Date:** November 1, 2026  
**Status:** In Progress — Implementation Phase  
**Scope:** AI-powered text-to-image generation, style presets, aspect-ratio dimensional mapping, prompt safety validation, Supabase Edge Function orchestration, client privacy consent gating, and seamless editor project creation.

---

## 1. Executive Summary & Existing System Audit

Before implementing AI image generation, an audit of the Chroma Studio codebase was conducted:

| Subsystem | Existing State | Integration Path for Image Generation |
| :--- | :--- | :--- |
| **AI Provider / Backend Architecture** | Supabase Edge Functions on project `fbtiigdfglailzjzfryp` (`ai-assistant`, `ai-segmentation`, `ai-enhance`, `ai-inpaint`, `ai-background-gen`). | **Reused directly.** Deploy a new edge function `ai-image-gen` that authenticates requests via Supabase JWT, validates prompts, calls external diffusion providers (OpenAI DALL-E 3, Replicate FLUX/SDXL, or Google Imagen 3) via server-side secrets, and provides high-fidelity fallback synthesis. |
| **Editor Import Pipeline** | `loadImage(src: string, title?: string)` in `src/App.tsx`. Accepts Data URLs, Object URLs, and remote URLs. | When generation completes, the user can click **"Edit in Chroma Studio"** or **"Open as Project"**, which invokes `loadImage(imageUrl, projectName)` and resets editing parameters to pristine defaults, seamlessly opening the Photo Editor. |
| **Project Persistence & Cloud Sync** | IndexedDB storage (`StorageService.saveProject`) and Supabase Storage bucket `projects`. | Generated images are saved into the standard `Project` schema (`id`, `name`, `imageSrc`, `width`, `height`, `adjustments`, `createdAt`, `updatedAt`) and synced to cloud/IndexedDB without breaking changes. |
| **Canvas & Export Dimensions** | `pipeline.ts` supports arbitrary dimensions with GPU memory clamping (`constrainDimensions`) to avoid mobile OOM. | Generated images adhere to standard aspect ratios: 1:1 (1024x1024), 4:5 (896x1120), 16:9 (1280x720), and 9:16 (720x1280). Clamping safeguards ensure safety on mobile devices. |
| **Client Bundle Security** | Zero API keys or tokens are bundled into Vite/Capacitor assets. | All third-party provider keys (`OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, etc.) remain in Supabase Edge Secrets. No client-side secret exposure. |

---

## 2. Text-to-Image Generation Capabilities

### A. Aspect Ratio & Dimension Matrix
| Aspect Ratio | Label | Default Pixel Dimensions | Primary Use Case |
| :--- | :--- | :--- | :--- |
| **1:1** | Square | $1024 \times 1024$ | Instagram Posts, Avatars, Icons |
| **4:5** | Portrait | $896 \times 1120$ | Editorial Photography, Fashion, Posters |
| **16:9** | Landscape | $1280 \times 720$ | Cinematic Stills, Desktop Wallpapers, Hero Banners |
| **9:16** | Story / Reel | $720 \times 1280$ | Mobile Wallpapers, TikTok / Instagram Stories |

### B. Curated Style Presets
1. **Photorealistic:** Sharp focus, natural ambient lighting, 35mm lens, 8k resolution, authentic textures.
2. **Cinematic Film:** Anamorphic lenses, dramatic directional lighting, cinematic color grading, subtle film grain.
3. **Digital Illustration:** Expressive brushwork, rich vector highlights, vibrant color harmony, concept art aesthetic.
4. **3D Render:** Octane / stylized 3D, ray-traced reflections, smooth subsurface scattering, soft lighting.
5. **Vintage Film:** Retro 35mm Kodachrome look, nostalgic film grain, warm analog color cast, subtle halation.
6. **Cyberpunk:** Neon magenta and cyan highlights, rainy reflective surfaces, atmospheric volumetric glow.

### C. Prompt Validation & Safety Filters
- **Minimum Prompt Length:** 3 characters (non-whitespace).
- **Maximum Prompt Length:** 1,000 characters.
- **Safety / Policy Filter:** Automated validation against malicious injections or disallowed categories.
- **Optional Negative Prompting:** Allows excluding unwanted elements (e.g., "blurry, low quality, extra limbs, watermark").

---

## 3. Privacy, Consent & Cost Governance

1. **Explicit User Consent Gate:** Prior to transmitting generation prompts to external cloud networks, an in-app privacy consent modal explains external model processing and data privacy commitments.
2. **Rate Limiting & Quotas:** Generation requests are throttled per user session (max 5 concurrent requests, 30s timeout per invocation).
3. **No Unintentional Paid Surprises:** Supabase Edge Function inspects available secrets and falls back to server-side neural synthesis if third-party quotas are unconfigured.

---

## 4. UI/UX Workflow

1. **Entrypoints:**
   - **Home Dashboard:** Hero Banner action "✨ Generate with AI" & Workspace Card "AI Image Generator".
   - **Photo Editor:** `AI Magic` tab sub-mode switcher: `[AI Enhance | Assistant | Generate]`.
   - **Header:** "Generate" action in the creation drawer.
2. **Interactive Modal & Panel:**
   - Prompt input with quick example chips (Portrait, Landscape, Sci-Fi, Product, Architecture).
   - Visual aspect-ratio selector with active indicator.
   - Style chips with preview gradients and icons.
   - Progress bar with real-time status reporting.
   - Generated result preview with zoom, "Open in Editor", "Download", and "Regenerate" options.
