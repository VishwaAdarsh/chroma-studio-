import React from 'react';
import type { Project } from '../../types/editor';

interface RecentProjectsSectionProps {
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onViewAllProjects: () => void;
  onStartNew: () => void;
}

export const RecentProjectsSection: React.FC<RecentProjectsSectionProps> = ({
  projects,
  onOpenProject,
  onViewAllProjects,
  onStartNew,
}) => {
  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Recent Projects</span>
          <span className="text-[12px] font-mono font-medium text-[#94A3B8] px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
            {projects.length}
          </span>
        </h2>
        {projects.length > 0 && (
          <button
            onClick={onViewAllProjects}
            className="text-[13px] font-semibold text-[#8B5CF6] hover:text-[#A855F7] flex items-center gap-1 transition-colors cursor-pointer group"
          >
            <span>View All</span>
            <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform">
              arrow_forward
            </span>
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        /* Empty State */
        <div className="w-full p-6 sm:p-8 rounded-2xl bg-[#111827]/70 border border-white/10 flex flex-col items-center justify-center text-center gap-3 backdrop-blur-xl">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#94A3B8]">
            <span className="material-symbols-outlined text-[28px]">folder_open</span>
          </div>
          <div>
            <h3 className="font-bold text-[15px] text-white">No projects yet</h3>
            <p className="text-[12px] text-[#94A3B8] max-w-sm mt-0.5">
              Edit a photo, customize a template, or build a collage to start your creative collection.
            </p>
          </div>
          <button
            onClick={onStartNew}
            className="mt-1 px-4 py-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white text-[12px] font-bold shadow-lg shadow-purple-950/30 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
          >
            Create New Project
          </button>
        </div>
      ) : (
        /* Horizontal Projects Row */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {projects.slice(0, 4).map((project) => (
            <button
              key={project.id}
              onClick={() => onOpenProject(project)}
              className="group flex flex-col rounded-2xl overflow-hidden bg-[#111827]/80 hover:bg-[#172033] border border-white/10 hover:border-[#8B5CF6]/40 shadow-md shadow-black/25 transition-all duration-200 active:scale-[0.98] text-left cursor-pointer"
            >
              {/* Project Thumbnail */}
              <div className="w-full aspect-video bg-[#070B14] relative overflow-hidden flex items-center justify-center">
                {project.thumbnail ? (
                  <img
                    src={project.thumbnail}
                    alt={project.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#1E1B4B] to-[#070B14] flex items-center justify-center text-[#8B5CF6]">
                    <span className="material-symbols-outlined text-[32px]">image</span>
                  </div>
                )}
                {/* Type Badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-[#CBD5E1] border border-white/10 uppercase">
                  {(project as any).type || 'Photo'}
                </div>
              </div>

              {/* Project Info */}
              <div className="p-3 flex flex-col gap-0.5">
                <h4 className="font-bold text-[13px] text-white truncate group-hover:text-[#8B5CF6] transition-colors">
                  {project.name}
                </h4>
                <span className="text-[11px] text-[#94A3B8]">
                  Edited {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
