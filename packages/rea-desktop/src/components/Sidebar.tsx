import React from 'react';
import { LayoutDashboard, FileCode, GitBranch, Database, Layers, Settings, ChevronRight, ChevronDown, Plus, Filter, Search } from 'lucide-react';
import { ProviderInfo, Project } from '../App';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  projects: Project[];
  currentProject: Project | null;
  onProjectSelect: (projectId: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (projectId: string) => void;
  activePanel: string;
  onPanelChange: (panel: string) => void;
  providers: ProviderInfo[];
  onProvidersClick: () => void;
}

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analyze', label: 'Analyze', icon: FileCode },
  { id: 'projects', label: 'Projects', icon: GitBranch },
  { id: 'evidence', label: 'Evidence', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

export function Sidebar({
  open,
  onToggle,
  projects,
  currentProject,
  onProjectSelect,
  onCreateProject,
  onDeleteProject,
  activePanel,
  onPanelChange,
  providers,
  onProvidersClick,
}: SidebarProps) {
  const [projectExpanded, setProjectExpanded] = React.useState(true);

  return (
    <aside className={`sidebar transition-all duration-200 ${open ? 'w-72' : 'w-16'}`}>
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-border">
        {open && (
          <span className="font-bold text-lg text-primary">BoxREA</span>
        )}
        <button
          onClick={onToggle}
          className="btn-ghost p-1.5 rounded"
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {open ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onPanelChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activePanel === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-text-muted hover:bg-surface-hover hover:text-text'
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {open && <span>{item.label}</span>}
          </button>
        ))}

        {/* Project Section */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between px-3 py-1">
            {open && (
              <>
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Projects</span>
                <button onClick={onCreateProject} className="btn-ghost p-1 rounded" aria-label="New project">
                  <Plus className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {projectExpanded && open && (
            <div className="max-h-64 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="px-3 py-4 text-center text-text-muted text-sm">
                  No projects yet. Click + to create one.
                </div>
              ) : (
                <ul className="space-y-1">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <button
                        onClick={() => onProjectSelect(project.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (window.confirm(`Delete project "${project.name}"?`)) {
                            onDeleteProject(project.id);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                          currentProject?.id === project.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-text-muted hover:bg-surface-hover hover:text-text'
                        }`}
                      >
                        <GitBranch className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate flex-1">{project.name}</span>
                        {currentProject?.id === project.id && (
                          <span className="badge-primary text-xs">Active</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={() => setProjectExpanded(!projectExpanded)}
            className="w-full px-3 py-1.5 flex items-center justify-center gap-2 text-sm text-text-muted hover:text-text hover:bg-surface-hover rounded-lg transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${projectExpanded ? 'rotate-180' : ''}`} />
            {open && <span>{projectExpanded ? 'Collapse' : 'Expand'} Projects</span>}
          </button>
        </div>

        {/* Providers Section */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between px-3 py-1">
            {open && (
              <>
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Providers</span>
                <button onClick={onProvidersClick} className="btn-ghost p-1 rounded" aria-label="Manage providers">
                  <Settings className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          <div className="px-2 space-y-1 max-h-48 overflow-y-auto">
            {providers.map((provider) => (
              <div key={provider.id} className="px-2 py-1.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${provider.enabled ? 'bg-success' : 'bg-text-muted'}`} />
                  {open && (
                    <span className={`text-sm font-medium ${provider.enabled ? 'text-text' : 'text-text-muted'}`}>
                      {provider.name}
                    </span>
                  )}
                </div>
                {open && (
                  <div className="mt-1 ml-6 flex flex-wrap gap-1">
                    {provider.capabilities.slice(0, 3).map((cap) => (
                      <span key={cap} className="badge-primary text-xs">
                        {cap}
                      </span>
                    ))}
                    {provider.capabilities.length > 3 && (
                      <span className="badge text-xs">+{provider.capabilities.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-2">
        {open && (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>v0.1.0</span>
            <span className="flex-1" />
            <span>REA MCP</span>
          </div>
        )}
      </div>
    </aside>
  );
}