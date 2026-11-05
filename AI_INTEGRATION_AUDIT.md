# Chroma Studio — AI Integration Audit & Architecture Blueprint

**Date:** November 1, 2026  
**Project:** Chroma Studio (React 19, TypeScript, Vite, Tailwind CSS v4, Capacitor 7, Supabase)  
**Author:** Chroma Studio Engineering & AI Architecture Group  
**Status:** P0 AI Photo Assistant Implemented & Deployed  

---

## 1. Executive Summary & Inventory

An exhaustive codebase inspection was conducted across all image editing modules, rendering pipelines, state models, database schemas, and external API configurations. 

Chroma Studio possesses an advanced on-device Canvas rendering engine and offline-first persistence pipeline. With this milestone, Chroma Studio establishes an enterprise-grade AI architecture, trusted server-side execution boundary via Supabase Edge Functions, typed schema validation, non-destructive canvas preview, and an interactive natural-language photo editing assistant.

---

## 2. Codebase Feature Matrix & Current Status

| Feature / Subsystem | Current Status | Architecture / Implementation Notes |
| :--- | :--- | :--- |
| **Adjustment Parameter Pipeline** | **IMPLEMENTED** | High-performance Canvas 2D engine in `src/engine/pipeline.ts` with 19 bounded parameters (Tone, Color, Detail, Effects). Non-destructive, parametric execution. |
| **Color Lab (HSL & 3-Way Wheels)** | **IMPLEMENTED** | 8-Channel HSL selective color grading and Shadows/Midtones/Highlights 3-way color grading with split-toning. |
| **Tone Curves (RGB + Splines)** | **IMPLEMENTED** | Monotonic cubic Catmull-Rom spline curve LUT evaluation for RGB Master, Red, Green, and Blue channels. |
| **Preset System (Looks Studio)** | **IMPLEMENTED** | 30 curated cinematic and photographic presets with parametric blending and intensity scrubbers (`src/data/presets.ts`). |
| **Scientific Auto-Tone** | **IMPLEMENTED** | Deterministic histogram calculation (BT.709 cumulative percentiles, dynamic contrast stretching, grey-world color balance). Rule-based, non-LLM. |
| **Subject Isolation / Cutout** | **IMPLEMENTED** | On-device perimeter profiling and Hermite edge-feathered matting ($0 cost, 100% private, on-device). |
| **Natural Language Editing Assistant** | **IMPLEMENTED** | Production-ready `AiAssistantPanel.tsx` supporting conversational editing requests with live canvas preview, parameter diffs, manual fine-tuning, and undo/redo integration. |
| **AI Server-Side Boundary** | **IMPLEMENTED & DEPLOYED** | Supabase Edge Function `ai-assistant` (active version deployed in project `fbtiigdfglailzjzfryp`). Holds zero keys in frontend; interfaces with Gemini/OpenAI server secrets. |
| **On-Device Semantic Fallback** | **IMPLEMENTED** | High-fidelity offline rule-based intent parser (`LocalSemanticAiProvider`) providing $0 cost, zero network latency, and full flight-mode capability. |
| **AI Schema Validation & Guardrails** | **IMPLEMENTED** | Strict runtime schema validation (`validateAndSanitizeAiPlan`) that validates bounds, rejects malicious payloads, records explicit corrections, and prevents silent clamping. |
| **Generative Inpainting / Expansion** | **OUT OF SCOPE (P1/P2)** | Not supported by current rendering pipeline. Explicitly intercepted by guardrails with actionable alternatives suggested. |

---

## 3. Secure AI Architecture & Provider Evaluation

### 3.1 Trust Boundary & Credential Isolation

```
+-----------------------------------------------------------------------------------+
| CLIENT LAYER (Browser & Android Capacitor App)                                    |
| - Strictly Zero AI Provider API Keys in bundle or environment                     |
| - Text Prompt + Current Adjustment Metadata ONLY (Zero photo uploads)              |
| - Strict Client-Side Schema Validation, Range Clamping & Corrections Record       |
| - Interactive Diff Preview & Hold-to-Compare Toggle                               |
+-----------------------------------------------------------------------------------+
                               |
               HTTPS (Supabase JWT / Anon Token)
                               v
+-----------------------------------------------------------------------------------+
| TRUSTED SERVER BOUNDARY (Supabase Edge Function: `ai-assistant`)                  |
| - Hosted on Deno Edge Runtime (Deployed & Active in project `fbtiigdfglailzjzfryp`)|
| - Accesses `GEMINI_API_KEY` / `OPENAI_API_KEY` via encrypted Supabase Secrets      |
| - System Prompt Enforcement & Structured JSON Output Guardrails                   |
| - Rate Limiting & Request Timeout (15s limit with AbortSignal cancellation)       |
+-----------------------------------------------------------------------------------+
                               |
                        HTTPS (Private API)
                               v
+-----------------------------------------------------------------------------------+
| AI MODEL PROVIDER (Google Gemini 1.5/2.5 Flash / OpenAI GPT-4o-mini)              |
| - Sub-second latency, structured JSON response mode                               |
| - Cost-effective ($0.075 / 1M input tokens; practically free for metadata)       |
+-----------------------------------------------------------------------------------+
```

### 3.2 Provider Comparison Matrix

| Provider / Model | Latency | Structured JSON Reliability | Privacy / Zero Retention | Cost per 1K Edit Prompts | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Gemini 1.5 / 2.5 Flash** | ~350–700ms | **Native JSON Schema** (`responseSchema`) | Enterprise zero data training via API | < $0.0002 | **PRIMARY CLOUD PROVIDER** |
| **OpenAI GPT-4o-mini** | ~500–900ms | **Native Structured Outputs** (`strict: true`) | Zero data retention supported | < $0.0003 | **SUPPORTED CLOUD PROVIDER** |
| **Local Deterministic Semantic Engine** | **< 5ms** | **Deterministic Type Safety** | 100% on-device, zero network | **$0.00** | **MANDATORY OFFLINE ADAPTER** |

### 3.3 The Adapter / Provider Pattern

To avoid vendor lock-in and enable offline resilience on mobile devices:
1. `AiProvider` interface: Contract for `generateEditPlan(request: AiEditRequest, signal?: AbortSignal): Promise<AiEditPlan>`.
2. `SupabaseEdgeAiProvider`: Calls `supabase.functions.invoke('ai-assistant')` with automatic failover to local engine.
3. `LocalSemanticAiProvider`: High-efficiency on-device natural language rule engine that maps photography vocabulary (e.g., "warmer", "cinematic", "lift shadows", "vintage", "punchy contrast", "preserve skin tones") to exact parameter diffs.
4. `AiService`: Facade managing provider selection, network fallback, 400ms cooldown rate limiting, and validation.

---

## 4. Security, Privacy, Performance & Cost Safeguards

### 4.1 Zero Image Upload (Metadata-Only Architecture)
- Natural language color and tone grading does **not** require uploading multi-megabyte user photos to an external LLM.
- Only the user's textual prompt and the current numerical adjustment values (e.g., `{ exposure: 0, temperature: 10 }`) are transmitted.
- **Privacy Impact:** Zero user photos leave the device. Complete user privacy is guaranteed.
- **Performance Impact:** Zero bandwidth consumption for image uploading. Latency drops from seconds to hundreds of milliseconds.
- **Cost Impact:** Token count per request is miniscule (~150 tokens input, ~80 tokens output), costing less than $0.0001 per operation.

### 4.2 Non-Silent Clamping & Validation Guardrails
- LLM outputs are treated as untrusted input.
- Validated against a strict TypeScript schema. Any unrecognized keys, NaN, Infinity, executable strings, HTML tags, or markdown formatting are rejected or sanitized.
- Every numeric parameter is clamped to its mathematical boundary in `src/constants/defaults.ts` (e.g. `exposure` $\in [-2.0, +2.0]$, `clarity` $\in [-100, +100]$).
- **Non-Silent Clamping:** Whenever a parameter is clamped or an invalid key rejected, a detailed record is appended to `plan.corrections` (with parameter name, original value, clamped value, and rationale) and surfaced in the UI.

### 4.3 Mobile Bandwidth, Memory & Battery Safeguards
- 15-second request timeout with `AbortController` cancellation support.
- If the device is offline or the request times out, the local semantic fallback handles the prompt immediately without user disruption.
- Duplicate submission button disabled while a request is actively processing.
- No heavy WASM or large neural network binaries are downloaded to the client.

---

## 5. Verification & Test Suite Summary

- **Vitest Suite:** 14 test files, 159 tests passing (100%).
- **AI-Specific Suite:** 23 dedicated tests covering:
  - Valid parameter parsing
  - Unknown adjustment key rejections
  - Out-of-bounds parameter clamping and `corrections` logging
  - Natural language prompt parsing across all target examples:
    - *“Make this photo warmer and slightly brighter”*
    - *“Give it a cinematic look with muted highlights”*
    - *“Increase contrast but preserve skin tones as much as possible”*
    - *“Lift the shadows and reduce saturation slightly”*
    - *“Dramatic black and white”*
    - *“Moody vintage film with subtle grain”*
  - Guardrail interception of unsupported generative requests
  - Undo/redo stack preservation
  - Non-destructive image verification (pristine image byte buffers remain untouched)
  - Project persistence and serialization
  - Zero frontend secret keys verification
- **Production Build:** `npm run build` succeeds in < 600ms with zero errors.
- **Mobile Sync:** `npx cap sync` succeeds in < 300ms.
