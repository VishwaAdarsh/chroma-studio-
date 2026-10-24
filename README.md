# Chroma Studio — Professional Mobile Photo Editor

> **Architecture:** React + TypeScript + Vite + Tailwind CSS + Capacitor  
> **Design Theme:** *Obsidian Chroma* (Dark Precision Glassmorphism)  
> **Connectivity:** 100% Offline-First Core Editing  
> **Platform:** Android Installable Native App & Web PWA  

---

## 🌟 Overview

**Chroma Studio** is an all-in-one mobile photo editing application combining the accessibility of mobile filter apps with the precision of professional photography software and the flexibility of a darkroom studio.

Built strictly according to the **Product Requirements Document (PRD)** and Stitch UI design specs (`Obsidian Chroma` design language).

---

## 🎯 Features

### 1. Curated Photographic Looks (32 Presets)
- **Monochrome:** Classic B&W, Noir Silver 400, Tri-X High Contrast, Soft Mono, Silver Gelatin
- **Vintage & Film:** Sepia Nostalgia, Kodachrome 64, Ektar 100, Portra 400, Retro 90s Disposable, Warm Film 35mm, Faded Memories
- **Cinematic:** Teal & Orange Blockbuster, Cine Gold 500T, Moody Nordic, Blue Hour Twilight, Golden Hour Sun, Bleach Bypass, Tokyo Neon Dusk
- **Aesthetic:** Pastel Dream, Lavender Haze, Peach Glow, Soft Halation, Minimalist Clean
- **Portrait & Natural:** Natural Skin Glow, Clean Editorial, Bright Studio, Editorial Matte
- **Landscape & Creative:** Vivid Alpine, Deep Forest Greens, Sunset Fire, Cyberpunk Duotone, Cool Glacier
- **Continuous Preset Intensity Slider (0% - 100%)**

### 2. Studio Tone & Color Adjustments
- **Tone:** Exposure (-2.00 to +2.00 EV), Brightness, Contrast, Highlights, Shadows, Whites, Blacks
- **Color:** Temperature (Kelvin), Tint (Green/Magenta), Saturation, Vibrance
- **Tactile Scrubber:** Center-zero detent notch, dynamic bi-directional gradient track, double-tap to reset

### 3. Pro Color Lab & Curves
- **3-Way Color Wheels:** Split-toning for Shadows, Midtones, and Highlights with interactive polar hue dial & saturation
- **Tone Curves:** RGB, Red, Green, and Blue tone curves with draggable anchor points and quick presets (High Contrast, Matte Lift, Linear)
- **Real-Time Histogram:** High-density live SVG graph with R, G, B channels and luminance curve + EV readout
- **Color Palette Assistant:** Extracts dominant tones with HEX/RGB, percentage coverage, warm/cool balance, copy to clipboard, and automated preset recommendations

### 4. Crop, Rotation & Geometry
- **Aspect Ratio Presets:** Free, 1:1 (Square), 4:5 (Portrait), 16:9 (Landscape), 9:16 (Story), 3:2 (35mm), 4:3 (Classic)
- **Transformations:** 90° Clockwise rotation, Horizontal Flip, Vertical Flip, Free Angle Straightening (-45° to +45°)
- **Rule of Thirds Grid:** Floating toggle guide

### 5. Detail & Atmospheric Effects
- Midtone Clarity, Edge Sharpening, Gaussian Blur, Radial Vignette Darkening, 35mm Film Grain, Matte Black Fade

### 6. Non-Destructive Workflow & History
- Multi-step Undo & Redo stack
- Hold-to-Compare button (view original flat unprocessed RAW)
- Zoom & Pan toggle (100% / 160%)
- Magic Auto-Tone (one-tap dynamic range optimization)

### 7. High-Fidelity Master Export
- Format selection: **JPEG**, **PNG**, **WebP**
- Quality control slider (10% to 100%)
- Target Scale: Original (1×), 2K (1.5×), 75%, 50%
- Privacy: Automatic EXIF & GPS metadata stripping toggle
- Direct offline device download / save

### 8. Project Persistence & Offline Storage
- Local project drafts saved via browser IndexedDB / LocalStorage
- "Start Session" Hero screen with sample RAW photos (Alpine Dusk, Kyoto Rain Dusk, Nordic Brutalism, Namib Dunes, Studio Melanin) or user camera/file import
- Cache manager and storage cleanup in Settings

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested on v22)
- NPM

### Run Local Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Build for Production
```bash
npm run build
```

---

## 📱 Android Native Build (Capacitor)

The project includes pre-configured Capacitor native Android support (`@capacitor/android`):

### 1. Sync Web Assets to Android
```bash
npm run cap:sync
```

### 2. Open in Android Studio
```bash
npm run cap:android
```
Inside Android Studio, connect an Android device or emulator, and click **Run** or generate an installable APK via **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

---

## 🎨 Design System Tokens (Obsidian Chroma)

| Token | Hex | Role |
|---|---|---|
| Canvas Background | `#111319` | Neutral matte darkroom base |
| Surface Low | `#191b22` | Card & toolbar foundations |
| Surface High | `#282a30` | Interactive controls & chips |
| Surface Highest | `#33343b` | Floating popovers & sliders |
| Primary Accent | `#cebdff` / `#a78bfa` | Spectral violet key indicators & CTA |
| Secondary Accent | `#bac3ff` | Periwinkle secondary markers |
| Text High-Contrast | `#e2e2ea` | Display titles & readings |
| Text Muted | `#948e9d` | Telemetry & secondary labels |
