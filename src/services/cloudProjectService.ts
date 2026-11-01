import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { CloudProjectRecord, SyncConflict } from '../types/sync';
import type { Project } from '../types/editor';
import type { DesignProject, CollageProject, CarouselProject, StudioProject } from '../types/design';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Standard UUID v4 generator with cross-environment fallbacks
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Guarantees a string ID is a valid Postgres UUID format.
 * If already a UUID, returns as-is; otherwise creates a clean UUID.
 */
export function ensureUUID(id: string): string {
  if (id && UUID_REGEX.test(id)) {
    return id;
  }
  return generateUUID();
}

/**
 * Cache for signed URLs to minimize roundtrips and avoid rate limits
 */
interface SignedUrlCacheEntry {
  url: string;
  expiresAt: number;
}
const signedUrlCache = new Map<string, SignedUrlCacheEntry>();

export class CloudProjectService {
  /**
   * Generates a signed download URL for private project assets or thumbnails.
   * Caches URLs for 50 minutes (signed for 60 minutes) to avoid repeated queries.
   */
  public static async getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
    if (!path || !supabase || !isSupabaseConfigured) return null;

    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    try {
      const { data, error } = await supabase.storage
        .from('projects')
        .createSignedUrl(path, expiresIn);

      if (error || !data?.signedUrl) {
        console.warn('[CloudProjectService] Failed to create signed URL for:', path, error);
        return null;
      }

      // Cache for 50 minutes (10 minutes safety buffer)
      signedUrlCache.set(path, {
        url: data.signedUrl,
        expiresAt: Date.now() + (expiresIn - 600) * 1000,
      });

      return data.signedUrl;
    } catch (err) {
      console.warn('[CloudProjectService] Exception getting signed URL:', err);
      return null;
    }
  }

  /**
   * Uploads an optimized thumbnail image to private user storage:
   * Pattern: {userId}/{projectId}/thumbnail.webp
   */
  public static async uploadThumbnail(
    userId: string,
    projectId: string,
    thumbnailBlob: Blob
  ): Promise<string | null> {
    if (!supabase || !isSupabaseConfigured) return null;

    const validId = ensureUUID(projectId);
    const storagePath = `${userId}/${validId}/thumbnail.webp`;

    try {
      const { error } = await supabase.storage.from('projects').upload(storagePath, thumbnailBlob, {
        contentType: thumbnailBlob.type || 'image/webp',
        upsert: true,
      });

      if (error) {
        console.error('[CloudProjectService] Failed uploading thumbnail:', error);
        return null;
      }

      return storagePath;
    } catch (err) {
      console.error('[CloudProjectService] Exception uploading thumbnail:', err);
      return null;
    }
  }

  /**
   * Uploads a binary asset (photo RAW source image, user background, or sticker):
   * Pattern: {userId}/{projectId}/assets/{assetId}
   */
  public static async uploadAsset(
    userId: string,
    projectId: string,
    assetId: string,
    assetBlob: Blob,
    mimeType = 'image/jpeg'
  ): Promise<string | null> {
    if (!supabase || !isSupabaseConfigured) return null;

    const validId = ensureUUID(projectId);
    const storagePath = `${userId}/${validId}/assets/${assetId}`;

    try {
      const { error } = await supabase.storage.from('projects').upload(storagePath, assetBlob, {
        contentType: mimeType,
        upsert: true,
      });

      if (error) {
        console.error('[CloudProjectService] Failed uploading asset:', error);
        return null;
      }

      return storagePath;
    } catch (err) {
      console.error('[CloudProjectService] Exception uploading asset:', err);
      return null;
    }
  }

  /**
   * Downloads a private binary asset from Supabase Storage as Blob
   */
  public static async downloadAssetBlob(storagePath: string): Promise<Blob | null> {
    if (!storagePath || !supabase || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase.storage.from('projects').download(storagePath);
      if (error || !data) {
        console.warn('[CloudProjectService] Failed downloading asset blob:', error);
        return null;
      }
      return data;
    } catch (err) {
      console.error('[CloudProjectService] Exception downloading asset blob:', err);
      return null;
    }
  }

  /**
   * Removes all remote storage assets and thumbnails associated with a project
   */
  public static async deleteProjectStorage(userId: string, projectId: string): Promise<void> {
    if (!supabase || !isSupabaseConfigured) return;

    const validId = ensureUUID(projectId);
    const prefix = `${userId}/${validId}`;

    try {
      // List items in the project directory
      const { data: rootFiles } = await supabase.storage.from('projects').list(prefix);
      const filesToDelete: string[] = [];

      if (rootFiles) {
        rootFiles.forEach((file) => {
          filesToDelete.push(`${prefix}/${file.name}`);
        });
      }

      const { data: assetFiles } = await supabase.storage.from('projects').list(`${prefix}/assets`);
      if (assetFiles) {
        assetFiles.forEach((file) => {
          filesToDelete.push(`${prefix}/assets/${file.name}`);
        });
      }

      if (filesToDelete.length > 0) {
        await supabase.storage.from('projects').remove(filesToDelete);
      }
    } catch (err) {
      console.warn('[CloudProjectService] Error cleaning up storage files:', err);
    }
  }

  /**
   * Serializes a local project (photo RAW, template, collage, or carousel) into
   * a CloudProjectRecord payload ready for Supabase Postgres.
   * Strips out large base64 strings from document JSON to maintain optimal DB performance.
   */
  public static serializeProject(
    project: any,
    userId: string,
    assetStoragePath?: string | null,
    thumbnailStoragePath?: string | null
  ): Omit<CloudProjectRecord, 'created_at' | 'updated_at'> {
    const validId = ensureUUID(project.id);
    const projectType = (project.type || 'photo') as 'photo' | 'template' | 'collage' | 'carousel';

    let documentPayload: Record<string, any> = {};

    switch (projectType) {
      case 'template': {
        const p = project as DesignProject;
        documentPayload = {
          templateId: p.templateId,
          width: p.width,
          height: p.height,
          background: p.background,
          elements: p.elements,
        };
        break;
      }
      case 'collage': {
        const p = project as CollageProject;
        documentPayload = {
          width: p.width,
          height: p.height,
          aspectRatio: p.aspectRatio,
          layoutId: p.layoutId,
          slots: p.slots,
          spacing: p.spacing,
          padding: p.padding,
          cornerRadius: p.cornerRadius,
          borderWidth: p.borderWidth,
          borderColor: p.borderColor,
          background: p.background,
          isFreeform: p.isFreeform,
          freeformElements: p.freeformElements,
        };
        break;
      }
      case 'carousel': {
        const p = project as CarouselProject;
        documentPayload = {
          format: p.format,
          width: p.width,
          height: p.height,
          slides: p.slides,
          activeSlideIndex: p.activeSlideIndex,
          theme: p.theme,
          isPanoramic: p.isPanoramic,
          panoramicSrc: p.panoramicSrc,
        };
        break;
      }
      case 'photo':
      default: {
        const p = project as Project;
        documentPayload = {
          originalName: p.originalName || p.name,
          width: p.width || 1920,
          height: p.height || 1080,
          fileSize: p.fileSize || 0,
          adjustments: p.adjustments,
          activePresetId: p.activePresetId,
          presetIntensity: p.presetIntensity,
          geometry: p.geometry,
          curves: p.curves,
          wheels: p.wheels,
          assetPath: assetStoragePath || null,
        };
        break;
      }
    }

    return {
      id: validId,
      user_id: userId,
      name: project.name || 'Untitled Project',
      project_type: projectType,
      document: documentPayload,
      thumbnail_path: thumbnailStoragePath || project.thumbnailPath || null,
      version: project.cloudVersion || 1,
      deleted_at: null,
    };
  }

  /**
   * Deserializes a CloudProjectRecord into a local Project or StudioProject
   */
  public static deserializeProject(
    record: CloudProjectRecord,
    cachedRuntimeImageSrc = ''
  ): Project | StudioProject {
    const doc = record.document || {};
    const updatedAt = new Date(record.updated_at).getTime();
    const createdAt = new Date(record.created_at).getTime();

    const commonSync = {
      syncStatus: 'synced' as const,
      cloudVersion: record.version,
      cloudUpdatedAt: updatedAt,
      lastSyncedAt: Date.now(),
      userId: record.user_id,
      thumbnailPath: record.thumbnail_path || undefined,
    };

    switch (record.project_type) {
      case 'template': {
        const proj: DesignProject = {
          id: record.id,
          name: record.name,
          type: 'template',
          templateId: doc.templateId,
          width: doc.width || 1080,
          height: doc.height || 1080,
          background: doc.background || { type: 'color', value: '#111827' },
          elements: doc.elements || [],
          createdAt,
          updatedAt,
          ...commonSync,
        };
        return proj;
      }
      case 'collage': {
        const proj: CollageProject = {
          id: record.id,
          name: record.name,
          type: 'collage',
          width: doc.width || 1080,
          height: doc.height || 1080,
          aspectRatio: doc.aspectRatio || '1:1',
          layoutId: doc.layoutId || 'grid-4-classic',
          slots: doc.slots || [],
          spacing: doc.spacing ?? 12,
          padding: doc.padding ?? 16,
          cornerRadius: doc.cornerRadius ?? 8,
          borderWidth: doc.borderWidth ?? 0,
          borderColor: doc.borderColor || '#FFFFFF',
          background: doc.background || { type: 'color', value: '#0D1424' },
          isFreeform: Boolean(doc.isFreeform),
          freeformElements: doc.freeformElements,
          createdAt,
          updatedAt,
          ...commonSync,
        };
        return proj;
      }
      case 'carousel': {
        const proj: CarouselProject = {
          id: record.id,
          name: record.name,
          type: 'carousel',
          format: doc.format || '4:5',
          width: doc.width || 1080,
          height: doc.height || 1350,
          slides: doc.slides || [],
          activeSlideIndex: doc.activeSlideIndex || 0,
          theme: doc.theme || {
            fontFamily: 'Inter',
            primaryColor: '#F8FAFC',
            accentColor: '#8B5CF6',
            bgColor: '#070B14',
          },
          isPanoramic: doc.isPanoramic,
          panoramicSrc: doc.panoramicSrc,
          createdAt,
          updatedAt,
          ...commonSync,
        };
        return proj;
      }
      case 'photo':
      default: {
        const proj: Project = {
          id: record.id,
          name: record.name,
          type: 'photo',
          imageSrc: cachedRuntimeImageSrc,
          originalName: doc.originalName || record.name,
          width: doc.width || 1920,
          height: doc.height || 1080,
          fileSize: doc.fileSize || 0,
          createdAt,
          updatedAt,
          adjustments: doc.adjustments,
          activePresetId: doc.activePresetId,
          presetIntensity: doc.presetIntensity ?? 100,
          geometry: doc.geometry,
          curves: doc.curves,
          wheels: doc.wheels,
          ...commonSync,
        };
        return proj;
      }
    }
  }

  /**
   * Fetches all active (non-soft-deleted) projects for the authenticated user
   */
  public static async fetchProjects(userId: string): Promise<CloudProjectRecord[]> {
    if (!supabase || !isSupabaseConfigured) return [];

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[CloudProjectService] Error fetching cloud projects:', error);
        return [];
      }

      return (data || []) as CloudProjectRecord[];
    } catch (err) {
      console.error('[CloudProjectService] Exception fetching cloud projects:', err);
      return [];
    }
  }

  /**
   * Fetches a single project by ID for the user
   */
  public static async fetchProject(projectId: string, userId: string): Promise<CloudProjectRecord | null> {
    if (!supabase || !isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', ensureUUID(projectId))
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return data as CloudProjectRecord;
    } catch (err) {
      console.error('[CloudProjectService] Exception fetching project:', err);
      return null;
    }
  }

  /**
   * Upserts a project record to Supabase Postgres.
   * Enforces optimistic locking / conflict detection via version matching.
   */
  public static async upsertProject(
    record: Omit<CloudProjectRecord, 'created_at' | 'updated_at'>,
    options: { force?: boolean } = {}
  ): Promise<{ data: CloudProjectRecord | null; error: Error | null; conflict?: boolean; remoteRecord?: CloudProjectRecord }> {
    if (!supabase || !isSupabaseConfigured) {
      return { data: null, error: new Error('Supabase client is not configured') };
    }

    try {
      // Conflict check: if not forcing overwrite, check existing remote record
      if (!options.force) {
        const existing = await this.fetchProject(record.id, record.user_id);
        if (existing) {
          // If remote version is greater than local version, conflict!
          if (existing.version > record.version) {
            return {
              data: null,
              error: new Error(`Conflict: remote version (${existing.version}) is newer than local (${record.version})`),
              conflict: true,
              remoteRecord: existing,
            };
          }
        }
      }

      const { data, error } = await supabase
        .from('projects')
        .upsert(
          {
            id: record.id,
            user_id: record.user_id,
            name: record.name,
            project_type: record.project_type,
            document: record.document,
            thumbnail_path: record.thumbnail_path,
            version: record.version,
            deleted_at: record.deleted_at,
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) {
        return { data: null, error: new Error(error.message) };
      }

      return { data: data as CloudProjectRecord, error: null };
    } catch (err: any) {
      return { data: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  /**
   * Soft deletes a cloud project (sets deleted_at)
   */
  public static async softDeleteProject(projectId: string, userId: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', ensureUUID(projectId))
        .eq('user_id', userId);

      return !error;
    } catch (err) {
      console.error('[CloudProjectService] Exception soft-deleting project:', err);
      return false;
    }
  }

  /**
   * Hard deletes a cloud project and its storage assets
   */
  public static async hardDeleteProject(projectId: string, userId: string): Promise<boolean> {
    if (!supabase || !isSupabaseConfigured) return false;

    try {
      const validId = ensureUUID(projectId);
      await this.deleteProjectStorage(userId, validId);

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', validId)
        .eq('user_id', userId);

      return !error;
    } catch (err) {
      console.error('[CloudProjectService] Exception hard-deleting project:', err);
      return false;
    }
  }
}
