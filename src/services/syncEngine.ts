import type { User } from '@supabase/supabase-js';
import { StorageService } from './storage';
import { CloudProjectService, ensureUUID } from './cloudProjectService';
import type {
  SyncStatus,
  SyncProgressState,
  SyncConflict,
  ConflictResolution,
  CloudProjectRecord,
} from '../types/sync';
import type { Project } from '../types/editor';

type SyncListener = (state: SyncProgressState) => void;

interface QueuedSyncItem {
  projectId: string;
  retryCount: number;
  timer?: any;
}

export class SyncEngine {
  private static instance: SyncEngine | null = null;

  private currentUser: User | null = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing = false;
  private queue = new Map<string, QueuedSyncItem>();
  private activeConflicts = new Map<string, SyncConflict>();
  private listeners = new Set<SyncListener>();
  private lastSyncedAt: number | null = null;
  private lastError: string | null = null;
  private inFlightProjectId: string | null = null;
  private isProcessing = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
  }

  public static getInstance(): SyncEngine {
    if (!this.instance) {
      this.instance = new SyncEngine();
    }
    return this.instance;
  }

  /**
   * Subscribe to real-time sync state updates
   */
  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try {
        fn(state);
      } catch (e) {
        console.warn('[SyncEngine] Error in listener callback:', e);
      }
    });
  }

  public getState(): SyncProgressState {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount: this.queue.size,
      syncedCount: 0,
      conflictCount: this.activeConflicts.size,
      lastSyncedAt: this.lastSyncedAt,
      lastError: this.lastError,
      activeConflicts: Array.from(this.activeConflicts.values()),
    };
  }

  /**
   * Updates current authenticated user.
   * Cancels queues on sign out, or triggers sync on sign in.
   */
  public setUser(user: User | null): void {
    const previousUser = this.currentUser;
    this.currentUser = user;

    if (!user) {
      // User signed out: clear queue and conflicts, stop active processing
      this.queue.forEach((item) => {
        if (item.timer) clearTimeout(item.timer);
      });
      this.queue.clear();
      this.activeConflicts.clear();
      this.isSyncing = false;
      this.lastError = null;
      this.notify();
      return;
    }

    if (!previousUser || previousUser.id !== user.id) {
      // New user signed in: trigger initial sync pull
      this.activeConflicts.clear();
      this.syncAll(true);
    }
  }

  private handleNetworkChange(online: boolean): void {
    this.isOnline = online;
    if (online) {
      this.lastError = null;
      // Resume processing queue when connectivity returns
      this.processQueue();
    }
    this.notify();
  }

  /**
   * Enqueues a project for debounced background sync
   */
  public enqueue(projectId: string, debounceMs = 1200): void {
    if (!this.currentUser) return;

    const existing = this.queue.get(projectId);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const timer = setTimeout(() => {
      const item = this.queue.get(projectId);
      if (item) {
        item.timer = undefined;
        this.processQueue();
      }
    }, debounceMs);

    this.queue.set(projectId, {
      projectId,
      retryCount: existing ? existing.retryCount : 0,
      timer,
    });

    this.notify();
  }

  /**
   * Processes queued sync items sequentially with single-flight locking
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline || !this.currentUser || this.queue.size === 0) {
      return;
    }

    this.isProcessing = true;
    this.isSyncing = true;
    this.notify();

    try {
      const entries = Array.from(this.queue.entries());
      for (const [projectId, item] of entries) {
        if (!this.currentUser || !this.isOnline) break;

        // Skip items currently waiting for debounced timer
        if (item.timer) continue;

        this.inFlightProjectId = projectId;
        const success = await this.syncSingleProject(projectId);

        if (success) {
          this.queue.delete(projectId);
          this.lastSyncedAt = Date.now();
          this.lastError = null;
        } else {
          // Increment retry count with exponential backoff
          item.retryCount += 1;
          if (item.retryCount >= 3) {
            // Mark failed after 3 attempts
            this.queue.delete(projectId);
            await this.updateProjectLocalStatus(projectId, 'failed', 'Max retries exceeded');
          } else {
            // Schedule backoff retry: 2s, 4s
            const delay = Math.pow(2, item.retryCount) * 1000;
            item.timer = setTimeout(() => {
              item.timer = undefined;
              this.processQueue();
            }, delay);
          }
        }
        this.notify();
      }
    } finally {
      this.inFlightProjectId = null;
      this.isProcessing = false;
      this.isSyncing = this.queue.size > 0;
      this.notify();
    }
  }

  /**
   * Synchronizes an individual project to Supabase
   */
  private async syncSingleProject(projectId: string): Promise<boolean> {
    if (!this.currentUser) return false;
    const userId = this.currentUser.id;

    try {
      await this.updateProjectLocalStatus(projectId, 'syncing');

      const allProjects = await StorageService.getProjects();
      const localProject = allProjects.find((p) => p.id === projectId);
      if (!localProject) {
        return true; // Project no longer exists locally
      }

      // Check if project has an image blob to upload (Photo RAW)
      let assetPath: string | null = null;
      const imageBlob = await StorageService.getImageBlob(projectId);
      if (imageBlob && (!localProject.thumbnailPath || !localProject.lastSyncedAt)) {
        assetPath = await CloudProjectService.uploadAsset(
          userId,
          projectId,
          'source_image.jpg',
          imageBlob,
          imageBlob.type || 'image/jpeg'
        );
      }

      // Upload thumbnail if available
      let thumbnailPath: string | null = localProject.thumbnailPath || null;
      if (localProject.thumbnail && localProject.thumbnail.startsWith('data:image')) {
        try {
          const thumbBlob = await (await fetch(localProject.thumbnail)).blob();
          thumbnailPath = await CloudProjectService.uploadThumbnail(userId, projectId, thumbBlob);
        } catch {}
      }

      // Serialize project
      const serialized = CloudProjectService.serializeProject(
        localProject,
        userId,
        assetPath,
        thumbnailPath
      );

      // Perform upsert with conflict detection
      const result = await CloudProjectService.upsertProject(serialized);

      if (result.conflict && result.remoteRecord) {
        // Record conflict
        const conflict: SyncConflict = {
          projectId,
          projectName: localProject.name,
          localProject,
          remoteProject: result.remoteRecord,
          localUpdatedAt: localProject.updatedAt || Date.now(),
          remoteUpdatedAt: new Date(result.remoteRecord.updated_at).getTime(),
          localVersion: localProject.cloudVersion || 1,
          remoteVersion: result.remoteRecord.version,
        };

        this.activeConflicts.set(projectId, conflict);
        await this.updateProjectLocalStatus(
          projectId,
          'conflict',
          `Remote version (${result.remoteRecord.version}) is newer`
        );
        return true;
      }

      if (result.error || !result.data) {
        this.lastError = result.error?.message || 'Sync failed';
        await this.updateProjectLocalStatus(projectId, 'failed', this.lastError);
        return false;
      }

      // Sync successful: update local project with cloud version
      const cloudRecord = result.data;
      const updatedLocal: Project = {
        ...localProject,
        syncStatus: 'synced',
        cloudVersion: cloudRecord.version,
        cloudUpdatedAt: new Date(cloudRecord.updated_at).getTime(),
        lastSyncedAt: Date.now(),
        userId,
        thumbnailPath: cloudRecord.thumbnail_path || undefined,
        syncError: undefined,
      };

      await StorageService.saveProject(updatedLocal, imageBlob || undefined);
      this.activeConflicts.delete(projectId);
      return true;
    } catch (err: any) {
      this.lastError = err?.message || String(err);
      await this.updateProjectLocalStatus(projectId, 'failed', this.lastError);
      return false;
    }
  }

  /**
   * Helper to update local project sync status in IndexedDB
   */
  private async updateProjectLocalStatus(
    projectId: string,
    status: SyncStatus,
    error?: string | null
  ): Promise<void> {
    try {
      const projects = await StorageService.getProjects();
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        project.syncStatus = status;
        if (error !== undefined) project.syncError = error || undefined;
        const blob = await StorageService.getImageBlob(projectId);
        await StorageService.saveProject(project, blob || undefined);
      }
    } catch {}
  }

  /**
   * Pulls all cloud projects from Supabase and reconciles with local store
   */
  public async syncAll(pullRemote = true): Promise<void> {
    if (!this.currentUser || !this.isOnline || this.isSyncing) return;

    this.isSyncing = true;
    this.notify();

    try {
      const userId = this.currentUser.id;

      if (pullRemote) {
        const remoteProjects = await CloudProjectService.fetchProjects(userId);
        const localProjects = await StorageService.getProjects();
        const localMap = new Map(localProjects.map((p) => [p.id, p]));

        for (const remote of remoteProjects) {
          const local = localMap.get(remote.id);
          const remoteUpdated = new Date(remote.updated_at).getTime();

          if (!local) {
            // New remote project: download and save locally
            let localImageSrc = '';
            // If it's a photo with an asset, generate signed URL or download blob
            const docAssetPath = remote.document?.assetPath;
            if (docAssetPath) {
              const signedUrl = await CloudProjectService.getSignedUrl(docAssetPath);
              if (signedUrl) localImageSrc = signedUrl;
            }

            const deserialized = CloudProjectService.deserializeProject(remote, localImageSrc);
            await StorageService.saveProject(deserialized as any);
          } else {
            // Both exist: check if remote has higher version
            if (remote.version > (local.cloudVersion || 0)) {
              if ((local.updatedAt || 0) > remoteUpdated && local.syncStatus === 'pending_upload') {
                // Conflict: local modified after remote
                this.activeConflicts.set(remote.id, {
                  projectId: remote.id,
                  projectName: local.name,
                  localProject: local,
                  remoteProject: remote,
                  localUpdatedAt: local.updatedAt,
                  remoteUpdatedAt: remoteUpdated,
                  localVersion: local.cloudVersion || 1,
                  remoteVersion: remote.version,
                });
                await this.updateProjectLocalStatus(remote.id, 'conflict');
              } else {
                // Clean remote update: adopt remote document
                let localImageSrc = local.imageSrc || '';
                if (!localImageSrc && remote.document?.assetPath) {
                  const signedUrl = await CloudProjectService.getSignedUrl(remote.document.assetPath);
                  if (signedUrl) localImageSrc = signedUrl;
                }
                const updated = CloudProjectService.deserializeProject(remote, localImageSrc);
                await StorageService.saveProject(updated as any);
              }
            }
          }
        }
      }

      // Enqueue all local projects that need uploading
      const freshLocal = await StorageService.getProjects();
      freshLocal.forEach((proj) => {
        if (
          proj.syncStatus === 'pending_upload' ||
          (proj.userId === userId && !proj.lastSyncedAt && proj.syncStatus !== 'local_only')
        ) {
          this.enqueue(proj.id, 0);
        }
      });

      this.lastSyncedAt = Date.now();
      this.lastError = null;
    } catch (err: any) {
      this.lastError = err?.message || 'Sync failed';
    } finally {
      this.isSyncing = this.queue.size > 0;
      this.notify();
    }
  }

  /**
   * Resolves a project conflict based on user selection
   */
  public async resolveConflict(
    projectId: string,
    resolution: ConflictResolution
  ): Promise<boolean> {
    const conflict = this.activeConflicts.get(projectId);
    if (!conflict || !this.currentUser) return false;

    const userId = this.currentUser.id;

    try {
      if (resolution === 'keep_local') {
        // Force push local version with incremented version number
        const local = conflict.localProject as Project;
        const serialized = CloudProjectService.serializeProject(local, userId);
        serialized.version = conflict.remoteVersion + 1;

        const result = await CloudProjectService.upsertProject(serialized, { force: true });
        if (result.data) {
          local.syncStatus = 'synced';
          local.cloudVersion = result.data.version;
          local.cloudUpdatedAt = new Date(result.data.updated_at).getTime();
          local.lastSyncedAt = Date.now();
          local.syncError = undefined;

          const blob = await StorageService.getImageBlob(projectId);
          await StorageService.saveProject(local, blob || undefined);
          this.activeConflicts.delete(projectId);
          this.notify();
          return true;
        }
      } else if (resolution === 'keep_remote') {
        // Adopt remote version completely
        const remoteDoc = CloudProjectService.deserializeProject(conflict.remoteProject);
        await StorageService.saveProject(remoteDoc as any);
        this.activeConflicts.delete(projectId);
        this.notify();
        return true;
      } else if (resolution === 'duplicate_both') {
        // Keep remote as canonical project, and clone local into fresh duplicate project
        const remoteDoc = CloudProjectService.deserializeProject(conflict.remoteProject);
        await StorageService.saveProject(remoteDoc as any);

        const localCopy: Project = {
          ...(conflict.localProject as Project),
          id: ensureUUID(''),
          name: `${conflict.projectName} (Local Copy)`,
          syncStatus: 'pending_upload',
          cloudVersion: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const blob = await StorageService.getImageBlob(projectId);
        await StorageService.saveProject(localCopy, blob || undefined);

        this.activeConflicts.delete(projectId);
        this.enqueue(localCopy.id, 0);
        this.notify();
        return true;
      }

      return false;
    } catch (err: any) {
      this.lastError = err?.message || 'Failed resolving conflict';
      this.notify();
      return false;
    }
  }

  /**
   * Detects local projects that have not yet been migrated to the user's cloud account
   */
  public async getUnmigratedProjects(): Promise<Project[]> {
    if (!this.currentUser) return [];
    const userId = this.currentUser.id;

    try {
      const projects = await StorageService.getProjects();
      return projects.filter(
        (p) => !p.userId || p.userId !== userId || p.syncStatus === 'local_only'
      );
    } catch {
      return [];
    }
  }

  /**
   * Migrates unmigrated local projects to the active user's cloud account
   */
  public async migrateLocalProjects(): Promise<{ migratedCount: number; errors: any[] }> {
    if (!this.currentUser) return { migratedCount: 0, errors: ['User not logged in'] };

    const unmigrated = await this.getUnmigratedProjects();
    if (unmigrated.length === 0) return { migratedCount: 0, errors: [] };

    let migratedCount = 0;
    const errors: any[] = [];

    for (const project of unmigrated) {
      try {
        project.userId = this.currentUser.id;
        project.syncStatus = 'pending_upload';
        const blob = await StorageService.getImageBlob(project.id);
        await StorageService.saveProject(project, blob || undefined);
        this.enqueue(project.id, 0);
        migratedCount++;
      } catch (err) {
        errors.push(err);
      }
    }

    this.notify();
    return { migratedCount, errors };
  }
}

export const syncEngine = SyncEngine.getInstance();
