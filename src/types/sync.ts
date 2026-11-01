import type { Project } from './editor';
import type { StudioProject } from './design';

export type SyncStatus =
  | 'local_only'
  | 'pending_upload'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'failed';

export type ConflictResolution = 'keep_local' | 'keep_remote' | 'duplicate_both';

export interface CloudProjectRecord {
  id: string; // UUID
  user_id: string; // UUID
  name: string;
  project_type: 'photo' | 'template' | 'collage' | 'carousel';
  document: Record<string, any>; // JSONB serialized project state
  thumbnail_path: string | null;
  version: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  deleted_at: string | null;
}

export interface SyncConflict {
  projectId: string;
  projectName: string;
  localProject: Project | StudioProject;
  remoteProject: CloudProjectRecord;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  localVersion: number;
  remoteVersion: number;
}

export interface SyncProgressState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  syncedCount: number;
  conflictCount: number;
  lastSyncedAt: number | null;
  lastError: string | null;
  activeConflicts: SyncConflict[];
}
