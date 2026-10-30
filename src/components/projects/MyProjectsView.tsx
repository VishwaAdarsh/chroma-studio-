import React, { useState } from 'react';
import { StorageService } from '../../services/storage';

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'photo' | 'template' | 'collage' | 'carousel'>('all');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const filteredProjects = projects.filter((p) => {
    const pType = p.type || 'photo';
    if (activeFilter === 'all') return true;
    return pType === activeFilter;
  });

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
    const updated = { ...project, name: editingName.trim(), updatedAt: Date.now() };
    await StorageService.saveProject(updated);
    setEditingProjectId(null);
    onRefresh();
  };

  const getTypeBadge = (type?: string) => {
    switch (type) {
      case 'template':
        return { label: 'Template', bg: 'bg-primary text-white' };
      case 'collage':
        return { label: 'Collage', bg: 'bg-secondary text-white' };
      case 'carousel':
        return { label: 'Carousel', bg: 'bg-tertiary text-white' };
      case 'photo':
      default:
        return { label: 'Photo RAW', bg: 'bg-surface-container-high text-primary' };
    }
  };

  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between selection:bg-primary-container selection:text-white">
      {/* Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-outline-variant shadow-xs">
        <div className="h-14 px-4 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-surface-container-low hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors border border-outline-variant cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">folder_special</span>
              <h1 className="text-[16px] font-extrabold tracking-tight text-on-surface">
                MY PROJECTS
              </h1>
              <span className="text-[10px] font-mono text-outline">
                {projects.length} Saved
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-5 flex flex-col gap-5">
        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'All Projects' },
            { id: 'photo', label: 'Photo Edits' },
            { id: 'template', label: 'Templates' },
            { id: 'collage', label: 'Collages' },
            { id: 'carousel', label: 'Carousels' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-primary-container text-white shadow-xs'
                  : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high border border-outline-variant'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-outline gap-2 bg-surface-container-lowest rounded-2xl border border-outline-variant">
            <span className="material-symbols-outlined text-[40px] text-primary">folder_open</span>
            <h3 className="text-[15px] font-bold text-on-surface">No projects found</h3>
            <p className="text-[12px]">Projects you create and save across any studio will be stored here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filteredProjects.map((proj) => {
              const badge = getTypeBadge(proj.type);
              const isRenaming = editingProjectId === proj.id;

              return (
                <div
                  key={proj.id}
                  onClick={() => onOpenProject(proj)}
                  className="rounded-2xl bg-surface-container-lowest border border-outline-variant overflow-hidden flex flex-col p-3 gap-2.5 cursor-pointer hover:border-primary transition-all shadow-xs group"
                >
                  {/* Thumbnail */}
                  <div className="w-full aspect-[4/3] rounded-xl bg-surface-container-low overflow-hidden relative border border-outline-variant flex items-center justify-center">
                    {proj.imageSrc ? (
                      <img src={proj.imageSrc} alt={proj.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-outline gap-1">
                        <span className="material-symbols-outlined text-[28px] text-primary">
                          {proj.type === 'template' ? 'dashboard_customize' : proj.type === 'collage' ? 'grid_view' : proj.type === 'carousel' ? 'view_carousel' : 'photo'}
                        </span>
                        <span className="text-[10px] font-mono">{badge.label}</span>
                      </div>
                    )}

                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md font-mono text-[9px] font-bold shadow-xs ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Title & Actions */}
                  <div className="flex flex-col gap-1">
                    {isRenaming ? (
                      <form onSubmit={(e) => handleSaveRename(proj, e)} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="w-full text-[12px] p-1 bg-surface-container-high border border-primary rounded text-on-surface focus:outline-none"
                          autoFocus
                        />
                        <button type="submit" className="text-primary hover:brightness-110">
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between">
                        <h4 className="text-[13px] font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                          {proj.name}
                        </h4>
                        <button
                          onClick={(e) => handleStartRename(proj, e)}
                          className="text-outline hover:text-on-surface p-0.5"
                          title="Rename"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-outline-variant text-[10px] font-mono text-outline">
                      <span>{new Date(proj.updatedAt || proj.createdAt).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDuplicate(proj.id, e)}
                          className="text-outline hover:text-primary flex items-center gap-0.5"
                          title="Duplicate"
                        >
                          <span className="material-symbols-outlined text-[13px]">content_copy</span>
                        </button>
                        <button
                          onClick={(e) => handleDelete(proj.id, e)}
                          className="text-outline hover:text-error flex items-center gap-0.5"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
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
    </div>
  );
};
