import React, { useEffect, useState } from 'react';
import { StorageService } from '../../services/storage';
import { syncEngine } from '../../services/syncEngine';
import { CloudProjectService } from '../../services/cloudProjectService';
import { useAuth } from '../../contexts/AuthContext';
import type { SyncProgressState, SyncConflict, ConflictResolution } from '../../types/sync';

interface MyProjectsViewProps {
  projects: any[];
  onOpenProject: (project: any) => void;
  onRefresh: () => void;
  onBack: () => void;
}

export const MyProjectsView: React.FC<MyProjectsViewProps> = ({
  projects,
  onOpenProject,
  onRefresh,
  onBack,
}) => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'synced' | 'local_only' | 'pending' | 'photo' | 'template' | 'collage' | 'carousel'
  >('all');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [syncState, setSyncState] = useState<SyncProgressState>(syncEngine.getState());
  const [unmigratedCount, setUnmigratedCount] = useState<number>(0);
  const [showMigrationBanner, setShowMigrationBanner] = useState<boolean>(true);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [activeConflictModal, setActiveConflictModal] = useState<SyncConflict | null>(null);

  // Subscribe to real-time sync state
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((state) => {
      setSyncState(state);
    });
    return unsubscribe;
  }, []);

  // Check for unmigrated local projects when authenticated user opens screen
  useEffect(() => {
    if (user) {
      syncEngine.getUnmigratedProjects().then((unmigrated) => {
        setUnmigratedCount(unmigrated.length);
      });
    } else {
      setUnmigratedCount(0);
    }
  }, [user, projects]);

  const handleManualSync = async () => {
    if (!user || syncState.isSyncing) return;
    await syncEngine.syncAll(true);
    onRefresh();
  };

  const handleMigrateLocalProjects = async () => {
    setIsMigrating(true);
    try {
      const res = await syncEngine.migrateLocalProjects();
      if (res.migratedCount > 0) {
        setShowMigrationBanner(false);
        setUnmigratedCount(0);
        onRefresh();
      }
    } finally {
      setIsMigrating(false);
    }
  };

  const handleResolveConflict = async (resolution: ConflictResolution) => {
    if (!activeConflictModal) return;
    const projectId = activeConflictModal.projectId;
    await syncEngine.resolveConflict(projectId, resolution);
    setActiveConflictModal(null);
    onRefresh();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      await StorageService.deleteProject(id);
      onRefresh();
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await StorageService.duplicateProject(id);
    onRefresh();
  };

  const handleStartRename = (project: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(project.id);
    setEditingName(project.name);
  };

  const handleSaveRename = async (project: any, e: React.FormEvent) => {
    e.preventDefault();
    if (!editingName.trim()) return;
    const updated = {
      ...project,
      name: editingName.trim(),
      updatedAt: Date.now(),
      syncStatus: project.syncStatus === 'synced' ? 'pending_upload' : project.syncStatus,
    };
    await StorageService.saveProject(updated);
    setEditingProjectId(null);
    onRefresh();
  };

  // Filter project cards
  const filteredProjects = projects.filter((p) => {
    const pType = p.type || 'photo';
    if (activeFilter === 'all') return true;
    if (activeFilter === 'synced') return p.syncStatus === 'synced';
    if (activeFilter === 'local_only') return !p.syncStatus || p.syncStatus === 'local_only';
    if (activeFilter === 'pending')
      return p.syncStatus === 'pending_upload' || p.syncStatus === 'syncing' || p.syncStatus === 'failed';
    return pType === activeFilter;
  });

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'template':
        return { label: 'Template', bg: 'bg-[#8B5CF6] text-white' };
      case 'collage':
        return { label: 'Collage', bg: 'bg-[#EC4899] text-white' };
      case 'carousel':
        return { label: 'Carousel', bg: 'bg-[#06B6D4] text-white' };
      case 'photo':
      default:
        return { label: 'Photo RAW', bg: 'bg-white/10 text-[#CBD5E1]' };
    }
  };

  const getSyncBadge = (project: any) => {
    const status = project.syncStatus || 'local_only';
    switch (status) {
      case 'synced':
        return (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium"
            title="Synced to cloud"
          >
            <span className="material-symbols-outlined text-[13px]">cloud_done</span>
            <span>Synced</span>
          </span>
        );
      case 'syncing':
        return (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-medium animate-pulse"
            title="Uploading to cloud..."
          >
            <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
            <span>Syncing</span>
          </span>
        );
      case 'pending_upload':
        return (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-medium"
            title="Modifications pending upload"
          >
            <span className="material-symbols-outlined text-[13px]">cloud_upload</span>
            <span>Pending</span>
          </span>
        );
      case 'conflict':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const conflict = syncState.activeConflicts.find((c) => c.projectId === project.id);
              if (conflict) {
                setActiveConflictModal(conflict);
              } else {
                setActiveConflictModal({
                  projectId: project.id,
                  projectName: project.name,
                  localProject: project,
                  remoteProject: {} as any,
                  localUpdatedAt: project.updatedAt || Date.now(),
                  remoteUpdatedAt: Date.now(),
                  localVersion: project.cloudVersion || 1,
                  remoteVersion: (project.cloudVersion || 1) + 1,
                });
              }
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold hover:brightness-110 cursor-pointer transition-all"
            title="Version conflict detected. Click to resolve"
          >
            <span className="material-symbols-outlined text-[13px]">warning</span>
            <span>Conflict • Resolve</span>
          </button>
        );
      case 'failed':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              syncEngine.enqueue(project.id, 0);
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-medium hover:bg-rose-500/20 cursor-pointer"
            title={project.syncError || 'Sync failed. Click to retry'}
          >
            <span className="material-symbols-outlined text-[13px]">refresh</span>
            <span>Failed • Retry</span>
          </button>
        );
      case 'local_only':
      default:
        return (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-[10px] font-medium"
            title="Stored locally on this device only"
          >
            <span className="material-symbols-outlined text-[13px]">devices</span>
            <span>Local</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070B14] text-[#F8FAFC] flex flex-col justify-between selection:bg-[#8B5CF6]/40 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 w-full z-40 bg-[#070B14]/90 backdrop-blur-xl border-b border-white/10 shadow-lg">
        <div className="h-16 px-4 sm:px-6 flex items-center justify-between max-w-7xl mx-auto gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors border border-white/10 cursor-pointer"
              title="Back"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#8B5CF6] text-[22px]">folder_special</span>
              <div>
                <h1 className="text-[15px] sm:text-[17px] font-extrabold tracking-tight text-white leading-tight">
                  MY PROJECTS
                </h1>
                <p className="text-[10px] sm:text-[11px] font-mono text-[#94A3B8]">
                  {projects.length} Saved • {projects.filter((p) => p.syncStatus === 'synced').length} Synced
                </p>
              </div>
            </div>
          </div>

          {/* Sync Header Controls */}
          <div className="flex items-center gap-2">
            {/* Online / Offline Status Dot */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                syncState.isOnline
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-white/50'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${syncState.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-white/40'}`}
              />
              <span className="hidden sm:inline">{syncState.isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Sync Now Action Button */}
            {user && (
              <button
                onClick={handleManualSync}
                disabled={syncState.isSyncing || !syncState.isOnline}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  syncState.isSyncing
                    ? 'bg-white/10 text-white/60 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white shadow-md shadow-purple-950/40 hover:brightness-110 active:scale-95'
                }`}
                title="Sync projects with Chroma Cloud"
              >
                <span className={`material-symbols-outlined text-[16px] ${syncState.isSyncing ? 'animate-spin' : ''}`}>
                  sync
                </span>
                <span className="hidden sm:inline">
                  {syncState.isSyncing ? 'Syncing...' : 'Sync Now'}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Migration Opt-In Banner (Visible when unmigrated local projects exist) */}
        {user && showMigrationBanner && unmigratedCount > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#8B5CF6]/15 via-[#EC4899]/10 to-transparent border border-[#8B5CF6]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[#EC4899] text-[22px]">cloud_upload</span>
              </div>
              <div>
                <h4 className="text-[13px] font-bold text-white">
                  Sync Local Projects to Your Account?
                </h4>
                <p className="text-[11px] text-[#CBD5E1]">
                  Found {unmigratedCount} local project{unmigratedCount > 1 ? 's' : ''} on this device. Sync them now to access on web and Android.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={() => setShowMigrationBanner(false)}
                className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-[#94A3B8] hover:text-white hover:bg-white/5 cursor-pointer"
              >
                Keep Local
              </button>
              <button
                onClick={handleMigrateLocalProjects}
                disabled={isMigrating}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white text-[11px] font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isMigrating && <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>}
                <span>{isMigrating ? 'Syncing...' : 'Sync to Cloud'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter Navigation Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: `All (${projects.length})` },
            { id: 'synced', label: 'Cloud Synced' },
            { id: 'local_only', label: 'Local Only' },
            { id: 'pending', label: 'Pending Sync' },
            { id: 'photo', label: 'Photo RAW' },
            { id: 'template', label: 'Templates' },
            { id: 'collage', label: 'Collages' },
            { id: 'carousel', label: 'Carousels' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-4 py-1.5 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white shadow-md shadow-purple-950/40'
                  : 'bg-[#0D1424] text-[#94A3B8] hover:text-white hover:bg-white/5 border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-14 text-center text-[#94A3B8] gap-3 bg-[#0D1424] rounded-3xl border border-white/10 min-h-[300px]">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
              <span className="material-symbols-outlined text-[32px] text-[#8B5CF6]">folder_open</span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-white">No projects found</h3>
              <p className="text-[12px] text-[#94A3B8] max-w-sm mt-1">
                {activeFilter === 'synced'
                  ? 'No cloud-synced projects yet. Saved designs sync automatically when you are signed in.'
                  : activeFilter === 'pending'
                  ? 'All changes are fully up to date!'
                  : 'Projects created and saved in any creative studio will appear here.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProjects.map((proj) => {
              const badge = getTypeBadge(proj.type);
              const isRenaming = editingProjectId === proj.id;

              return (
                <div
                  key={proj.id}
                  onClick={() => onOpenProject(proj)}
                  className="rounded-2xl bg-[#0D1424] border border-white/10 hover:border-[#8B5CF6]/50 overflow-hidden flex flex-col p-3.5 gap-3 cursor-pointer transition-all shadow-md hover:shadow-xl group"
                >
                  {/* Thumbnail Viewport */}
                  <div className="w-full aspect-[4/3] rounded-xl bg-[#070B14] overflow-hidden relative border border-white/10 flex items-center justify-center">
                    {proj.imageSrc ? (
                      <img
                        src={proj.imageSrc}
                        alt={proj.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-[#94A3B8] gap-1.5 p-4 text-center">
                        <span className="material-symbols-outlined text-[32px] text-[#8B5CF6]">
                          {proj.type === 'template'
                            ? 'dashboard_customize'
                            : proj.type === 'collage'
                            ? 'grid_view'
                            : proj.type === 'carousel'
                            ? 'view_carousel'
                            : 'photo'}
                        </span>
                        <span className="text-[11px] font-mono font-semibold text-white/70">
                          {badge.label}
                        </span>
                      </div>
                    )}

                    {/* Studio Type Tag (Top-Left) */}
                    <span
                      className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md font-mono text-[9px] font-bold shadow-md ${badge.bg}`}
                    >
                      {badge.label}
                    </span>

                    {/* Sync Status Badge (Top-Right) */}
                    <div className="absolute top-2.5 right-2.5 shadow-md">
                      {getSyncBadge(proj)}
                    </div>
                  </div>

                  {/* Project Metadata & Actions */}
                  <div className="flex flex-col gap-1.5">
                    {isRenaming ? (
                      <form
                        onSubmit={(e) => handleSaveRename(proj, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5"
                      >
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full text-[12px] px-2 py-1 bg-white/5 border border-[#8B5CF6] rounded-lg text-white focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 bg-[#8B5CF6] text-white rounded-lg hover:brightness-110 cursor-pointer"
                          title="Save"
                        >
                          <span className="material-symbols-outlined text-[15px]">check</span>
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[13px] font-bold text-white truncate group-hover:text-[#8B5CF6] transition-colors">
                          {proj.name}
                        </h4>
                        <button
                          onClick={(e) => handleStartRename(proj, e)}
                          className="text-[#94A3B8] hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                          title="Rename Project"
                        >
                          <span className="material-symbols-outlined text-[15px]">edit</span>
                        </button>
                      </div>
                    )}

                    {/* Bottom Metadata & Tools */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] font-mono text-[#94A3B8]">
                      <span>{new Date(proj.updatedAt || proj.createdAt).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDuplicate(proj.id, e)}
                          className="p-1 rounded hover:bg-white/5 text-[#94A3B8] hover:text-[#8B5CF6] transition-colors cursor-pointer"
                          title="Duplicate Project"
                        >
                          <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        </button>
                        <button
                          onClick={(e) => handleDelete(proj.id, e)}
                          className="p-1 rounded hover:bg-rose-500/10 text-[#94A3B8] hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Project"
                        >
                          <span className="material-symbols-outlined text-[15px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Conflict Resolution Modal */}
      {activeConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-[#0D1424] border border-white/20 p-6 flex flex-col gap-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <span className="material-symbols-outlined text-[20px]">warning</span>
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-white">Version Conflict Detected</h3>
                  <p className="text-[11px] text-[#94A3B8]">{activeConflictModal.projectName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveConflictModal(null)}
                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-[#94A3B8] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[12px] text-[#CBD5E1] leading-relaxed">
              This project was modified in the cloud on another device while you had unsynced changes locally. Choose how you would like to resolve this conflict:
            </p>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 text-[11px]">
              <div>
                <span className="text-[#94A3B8] block text-[10px] uppercase font-mono">This Device (Local)</span>
                <span className="font-bold text-white block mt-0.5">
                  v{activeConflictModal.localVersion}
                </span>
                <span className="text-[#94A3B8] text-[10px]">
                  {new Date(activeConflictModal.localUpdatedAt).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-[#94A3B8] block text-[10px] uppercase font-mono">Chroma Cloud</span>
                <span className="font-bold text-white block mt-0.5">
                  v{activeConflictModal.remoteVersion}
                </span>
                <span className="text-[#94A3B8] text-[10px]">
                  {new Date(activeConflictModal.remoteUpdatedAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleResolveConflict('duplicate_both')}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white text-[12px] font-bold shadow-md hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Keep Both (Save Local as Copy & Download Cloud)</span>
              </button>
              <button
                onClick={() => handleResolveConflict('keep_local')}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white text-[12px] font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">upload</span>
                <span>Keep Local Version (Overwrite Cloud)</span>
              </button>
              <button
                onClick={() => handleResolveConflict('keep_remote')}
                className="w-full py-2 px-4 rounded-xl text-[#94A3B8] hover:text-white text-[12px] font-medium transition-colors cursor-pointer"
              >
                Keep Cloud Version (Discard Local Edits)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
