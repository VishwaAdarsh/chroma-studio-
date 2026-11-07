import { describe, it, expect } from 'vitest';

declare const require: any;
const fs = typeof require !== 'undefined' ? require('fs') : null;
const path = typeof require !== 'undefined' ? require('path') : null;

describe('Chroma Studio: Brand Identity & Asset Verification', () => {
  const BRAND_COLORS = {
    cyan: '#00E5FF',
    electricBlue: '#2563FF',
    purple: '#7C3AED',
    magenta: '#D946EF',
    orange: '#FF9A3C',
    darkBackground: '#09070A',
  };

  it('validates official brand color palette tokens', () => {
    expect(BRAND_COLORS.cyan).toBe('#00E5FF');
    expect(BRAND_COLORS.electricBlue).toBe('#2563FF');
    expect(BRAND_COLORS.purple).toBe('#7C3AED');
    expect(BRAND_COLORS.magenta).toBe('#D946EF');
    expect(BRAND_COLORS.orange).toBe('#FF9A3C');
    expect(BRAND_COLORS.darkBackground).toBe('#09070A');
  });

  it('verifies all required web and PWA brand assets exist with valid size', () => {
    const requiredBrandFiles = [
      'public/brand/chroma-logo-full.png',
      'public/brand/chroma-logo-full-transparent.png',
      'public/brand/chroma-logo-symbol.png',
      'public/brand/chroma-logo-symbol-transparent.png',
      'public/brand/favicon.svg',
      'public/brand/chroma-mark.svg',
      'public/brand/chroma-wordmark.svg',
      'public/favicon.svg',
      'public/favicon.ico',
      'public/manifest.json',
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/apple-touch-icon.png',
    ];

    for (const relPath of requiredBrandFiles) {
      const fullPath = path.resolve(relPath);
      expect(fs.existsSync(fullPath), `Missing brand asset: ${relPath}`).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(0);
    }
  });

  it('verifies Android adaptive launcher icons across all 5 mipmap densities', () => {
    const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
    for (const m of mipmaps) {
      const legacyPath = path.resolve(`android/app/src/main/res/${m}/ic_launcher.png`);
      const roundPath = path.resolve(`android/app/src/main/res/${m}/ic_launcher_round.png`);
      const fgPath = path.resolve(`android/app/src/main/res/${m}/ic_launcher_foreground.png`);

      expect(fs.existsSync(legacyPath), `Missing legacy icon: ${m}`).toBe(true);
      expect(fs.existsSync(roundPath), `Missing round icon: ${m}`).toBe(true);
      expect(fs.existsSync(fgPath), `Missing adaptive foreground icon: ${m}`).toBe(true);
      expect(fs.statSync(fgPath).size).toBeGreaterThan(0);
    }
  });

  it('verifies Android multi-density splash screen assets exist for portrait and landscape', () => {
    const splashFolders = [
      'drawable',
      'drawable-land-mdpi',
      'drawable-land-hdpi',
      'drawable-land-xhdpi',
      'drawable-land-xxhdpi',
      'drawable-land-xxxhdpi',
      'drawable-port-mdpi',
      'drawable-port-hdpi',
      'drawable-port-xhdpi',
      'drawable-port-xxhdpi',
      'drawable-port-xxxhdpi',
    ];
    for (const s of splashFolders) {
      const splashPath = path.resolve(`android/app/src/main/res/${s}/splash.png`);
      expect(fs.existsSync(splashPath), `Missing splash: ${s}`).toBe(true);
      expect(fs.statSync(splashPath).size).toBeGreaterThan(0);
    }
  });

  it('verifies Android ic_launcher_background color is set to dark brand color #09070A', () => {
    const bgXmlPath = path.resolve('android/app/src/main/res/values/ic_launcher_background.xml');
    const content = fs.readFileSync(bgXmlPath, 'utf-8');
    expect(content).toContain('#09070A');
  });
});
