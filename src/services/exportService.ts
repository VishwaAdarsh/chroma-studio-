/**
 * Chroma Studio - Universal Native & Web Export Service
 * Provides reliable photo and project file exports on Android (Capacitor) and desktop browsers.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface ExportResult {
  success: boolean;
  filePath?: string;
  method: 'native_filesystem' | 'native_share' | 'browser_download';
  error?: string;
}

export interface ExportOptions {
  dialogTitle?: string;
  shareText?: string;
  skipSharePrompt?: boolean;
}

/**
 * Converts a standard Blob into a base64 encoded string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Strip off the "data:*/*;base64," header to get pure base64
        const base64 = dataUrl.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read blob as base64'));
      reader.readAsDataURL(blob);
    });
  }

  // Fallback for Node.js / non-browser test environments
  const arrayBuf = await blob.arrayBuffer();
  const globalBuf = (globalThis as any).Buffer;
  if (globalBuf) {
    return globalBuf.from(arrayBuf).toString('base64');
  }
  const bytes = new Uint8Array(arrayBuf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class ExportService {
  /**
   * Checks if current environment is running natively on Android or iOS
   */
  public static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Saves an exported photo or media file to the user's device.
   * On Android (Capacitor):
   * 1. Writes binary file to device storage (Documents or Cache) via Filesystem
   * 2. Prompts native Share Sheet so user can Save to Device / Photos / Google Drive
   * On Web / Browser:
   * 1. Triggers standard browser download anchor
   */
  public static async saveExportedFile(
    blob: Blob,
    fileName: string,
    mimeType = 'image/jpeg',
    options?: ExportOptions
  ): Promise<ExportResult> {
    if (!blob || blob.size === 0) {
      return {
        success: false,
        method: 'browser_download',
        error: 'Export failed: generated image is empty or invalid.',
      };
    }

    // Clean up filename to prevent illegal path characters
    const safeFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');

    // 1. Android / Native Capacitor flow
    if (this.isNative()) {
      try {
        const base64Data = await blobToBase64(blob);

        // First write to Documents directory
        let writeResult;
        let targetDirectory = Directory.Documents;

        try {
          writeResult = await Filesystem.writeFile({
            path: safeFileName,
            data: base64Data,
            directory: targetDirectory,
            recursive: true,
          });
        } catch (docErr) {
          console.warn('[ExportService] Failed writing to Documents, falling back to Cache:', docErr);
          targetDirectory = Directory.Cache;
          writeResult = await Filesystem.writeFile({
            path: safeFileName,
            data: base64Data,
            directory: targetDirectory,
            recursive: true,
          });
        }

        const fileUri = writeResult.uri;

        // If skipSharePrompt is requested or Share is unavailable, return filesystem result
        if (options?.skipSharePrompt) {
          return {
            success: true,
            filePath: fileUri,
            method: 'native_filesystem',
          };
        }

        // Trigger native Android share sheet with file URI
        try {
          const canShare = await Share.canShare();
          if (canShare.value) {
            await Share.share({
              title: safeFileName,
              text: options?.shareText || 'Exported from Chroma Studio',
              url: fileUri,
              dialogTitle: options?.dialogTitle || 'Save or Share Photo',
            });

            return {
              success: true,
              filePath: fileUri,
              method: 'native_share',
            };
          }
        } catch (shareErr) {
          // If user cancels the share dialog, the file was already safely saved to filesystem
          console.info('[ExportService] Native share dismissed or completed:', shareErr);
        }

        return {
          success: true,
          filePath: fileUri,
          method: 'native_filesystem',
        };
      } catch (err: any) {
        console.error('[ExportService] Android native export error:', err);
        // Fallback to browser download if filesystem threw an unexpected error
        try {
          this.triggerBrowserDownload(blob, safeFileName);
          return {
            success: true,
            method: 'browser_download',
          };
        } catch (fallbackErr) {
          return {
            success: false,
            method: 'native_filesystem',
            error: err?.message || 'Could not write export file to Android storage.',
          };
        }
      }
    }

    // 2. Desktop Web / Browser flow
    try {
      this.triggerBrowserDownload(blob, safeFileName);
      return {
        success: true,
        method: 'browser_download',
      };
    } catch (err: any) {
      console.error('[ExportService] Browser download error:', err);
      return {
        success: false,
        method: 'browser_download',
        error: err?.message || 'Failed to download file in browser.',
      };
    }
  }

  /**
   * Programmatically triggers a standard browser download using an ephemeral Object URL
   */
  private static triggerBrowserDownload(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = objectUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {}
    }, 60000);
  }

  /**
   * Exports project metadata and state as editable JSON
   */
  public static async exportProjectAsJson(
    project: any,
    fileName?: string
  ): Promise<ExportResult> {
    try {
      const baseName = (project.name || 'project').replace(/\s+/g, '_');
      const sanitizedName = (fileName || `${baseName}_backup.json`).replace(
        /[<>:"/\\|?*]/g,
        '_'
      );
      const jsonString = JSON.stringify(project, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      return await this.saveExportedFile(blob, sanitizedName, 'application/json', {
        dialogTitle: 'Save Project Backup',
        shareText: `Chroma Studio Project Backup: ${project.name}`,
      });
    } catch (err: any) {
      return {
        success: false,
        method: 'browser_download',
        error: err?.message || 'Failed to export project JSON',
      };
    }
  }
}
