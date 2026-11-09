import { CloudProjectService, StorageQuotaInfo, formatStorageSize, FREE_PLAN_LIMITS, PRO_PLAN_LIMITS } from './cloudProjectService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface StorageMonitorState {
  quota: StorageQuotaInfo | null;
  loading: boolean;
  error: string | null;
  formattedUsed: string;
  formattedTotal: string;
  percentage: number;
  isExceeded: boolean;
  isPro: boolean;
}

export type StorageMonitorListener = (state: StorageMonitorState) => void;

/**
 * Live, reactive cloud storage monitor singleton.
 * Synchronizes storage metrics across NavigationDrawer sidebar, ProfileModal,
 * UpgradeProCard, and MyProjectsView without redundant API polling.
 */
export class StorageMonitorService {
  private static instance: StorageMonitorService | null = null;
  private currentUserId: string | null = null;
  private quota: StorageQuotaInfo | null = null;
  private loading = false;
  private error: string | null = null;
  private listeners = new Set<StorageMonitorListener>();
  private inFlightPromise: Promise<StorageQuotaInfo> | null = null;

  private constructor() {
    // Listen to network status changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.refresh(true));
    }

    // Auto-refresh whenever CloudProjectService operations invalidate quota
    CloudProjectService.setQuotaInvalidatedListener((userId) => {
      if (!this.currentUserId || !userId || this.currentUserId === userId) {
        this.refresh(false);
      }
    });
  }

  public static getInstance(): StorageMonitorService {
    if (!this.instance) {
      this.instance = new StorageMonitorService();
    }
    return this.instance;
  }

  public getState(): StorageMonitorState {
    const defaultTotal = this.quota?.isPro ? '10 GB' : '100 MB';
    const maxBytes = this.quota?.maxBytes || FREE_PLAN_LIMITS.maxBytes;
    const usedBytes = this.quota?.usedBytes || 0;
    const percentage = maxBytes > 0 ? Math.min(999, Math.round((usedBytes / maxBytes) * 100)) : 0;
    const isExceeded = this.quota ? this.quota.isExceeded : false;

    return {
      quota: this.quota,
      loading: this.loading,
      error: this.error,
      formattedUsed: this.quota?.formattedUsed || (usedBytes > 0 ? formatStorageSize(usedBytes) : '0 MB'),
      formattedTotal: this.quota?.formattedTotal || defaultTotal,
      percentage,
      isExceeded,
      isPro: this.quota?.isPro || false,
    };
  }

  public subscribe(listener: StorageMonitorListener): () => void {
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
        console.warn('[StorageMonitorService] Error in listener callback:', e);
      }
    });
  }

  /**
   * Updates authenticated user and refreshes storage state immediately
   */
  public async setUser(userId: string | null): Promise<void> {
    if (this.currentUserId === userId && this.quota) {
      return;
    }

    this.currentUserId = userId;
    this.quota = null;
    this.error = null;

    if (!userId) {
      this.loading = false;
      this.notify();
      return;
    }

    await this.refresh(true);
  }

  /**
   * Refreshes the storage monitor calculation
   */
  public async refresh(force = false): Promise<StorageQuotaInfo> {
    if (!this.currentUserId || !isSupabaseConfigured || !supabase) {
      this.loading = false;
      this.notify();
      return this.getDefaultQuota();
    }

    if (force) {
      CloudProjectService.invalidateQuotaCache(this.currentUserId);
    }

    if (this.inFlightPromise) {
      return this.inFlightPromise;
    }

    this.loading = true;
    this.error = null;
    this.notify();

    this.inFlightPromise = (async () => {
      try {
        const quota = await CloudProjectService.getCloudStorageQuota(this.currentUserId!);
        this.quota = quota;
        this.error = null;
        return quota;
      } catch (err: any) {
        console.warn('[StorageMonitorService] Refresh error:', err);
        this.error = err?.message || 'Failed to calculate storage usage';
        return this.getDefaultQuota();
      } finally {
        this.loading = false;
        this.inFlightPromise = null;
        this.notify();
      }
    })();

    return this.inFlightPromise;
  }

  /**
   * Event-driven trigger: call after successful upload, delete, or subscription upgrade
   */
  public async notifyChange(): Promise<void> {
    if (this.currentUserId) {
      CloudProjectService.invalidateQuotaCache(this.currentUserId);
      await this.refresh(true);
    }
  }

  private getDefaultQuota(): StorageQuotaInfo {
    return {
      usedBytes: 0,
      usedMB: 0,
      projectCount: 0,
      maxBytes: FREE_PLAN_LIMITS.maxBytes,
      maxMB: FREE_PLAN_LIMITS.maxMB,
      maxProjects: FREE_PLAN_LIMITS.maxProjects,
      isPro: false,
      percentage: 0,
      isExceeded: false,
      formattedUsed: '0 MB',
      formattedTotal: '100 MB',
    };
  }
}

export const storageMonitorService = StorageMonitorService.getInstance();
