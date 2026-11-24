import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { FolderOpen, Play, Bug, Settings, ChevronRight, ChevronDown, X, Plus, Search, Filter, LayoutDashboard, FileCode, GitBranch, Database, Layers, Terminal, HelpCircle } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { StatusBar } from './components/StatusBar';
import { ProjectModal } from './components/ProjectModal';
import { ProviderModal } from './components/ProviderModal';
import { AnalyzeModal } from './components/AnalyzeModal';
import { SettingsModal } from './components/SettingsModal';
import { useStore } from './store';

interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  created_at: number;
  updated_at: number;
  targets: string[];
  settings: any;
}

interface ProviderInfo {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  capabilities: string[];
  status: string;
}

interface AppConfig {
  workspace_path: string;
  preferred_provider: string;
  ui_theme: string;
  ui_font_size: number;
  show_addresses: boolean;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePanel, setActivePanel] = useState<'dashboard' | 'analyze' | 'projects' | 'evidence' | 'settings'>('dashboard');
  const [modals, setModals] = useState({
    project: false,
    provider: false,
    analyze: false,
    settings: false,
  });
  const [loading, setLoading] = useState(true);

  // Initialize store
  const store = useStore();

  // Load initial data
  useEffect(() => {
    loadInitialData();
    setupEventListeners();
  }, []);

  const loadInitialData = async () => {
    try {
      const [configData, projectsData, providersData] = await Promise.all([
        invoke<AppConfig>('get_config'),
        invoke<Project[]>('list_projects'),
        invoke<ProviderInfo[]>('get_providers'),
      ]);
      
      setConfig(configData);
      setProjects(projectsData);
      setProviders(providersData);
      
      if (projectsData.length > 0) {
        setCurrentProject(projectsData[0]);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = async () => {
    // Listen for project changes
    await listen('project-changed', (event) => {
      loadInitialData();
    });
  };

  const handleCreateProject = async (name: string, description?: string) => {
    try {
      const project = await invoke<Project>('create_project', { name, description });
      setProjects(prev => [project, ...prev]);
      setCurrentProject(project);
      setModals(prev => ({ ...prev, project: false }));
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const handleLoadProject = async (projectId: string) => {
    try {
      const project = await invoke<Project>('load_project', { projectId });
      setCurrentProject(project);
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await invoke('delete_project', { projectId });
      setProjects(prev => prev.filter(p => p.id !== projectId));
      if (currentProject?.id === projectId) {
        setCurrentProject(projects.find(p => p.id !== projectId) || null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleAnalyze = async (targetPath: string, options: any) => {
    try {
      setModals(prev => ({ ...prev, analyze: false }));
      // This would trigger analysis and navigate to results
      console.log('Analyze:', targetPath, options);
    } catch (error) {
      console.error('Failed to analyze:', error);
    }
  };

  const handleConfigChange = async (newConfig: Partial<AppConfig>) => {
    try {
      const updated = { ...config!, ...newConfig };
      await invoke('update_config', { config: updated });
      setConfig(updated);
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-text-muted">Loading BoxREA...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        projects={projects}
        currentProject={currentProject}
        onProjectSelect={handleLoadProject}
        onCreateProject={() => setModals(prev => ({ ...prev, project: true }))}
        onDeleteProject={handleDeleteProject}
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        providers={providers}
        onProvidersClick={() => setModals(prev => ({ ...prev, provider: true }))}
      />

      {/* Main Content */}
      <main className="main-content">
        <MainContent
          activePanel={activePanel}
          currentProject={currentProject}
          config={config}
          providers={providers}
          onAnalyzeClick={() => setModals(prev => ({ ...prev, analyze: true }))}
        />

        <StatusBar
          currentProject={currentProject}
          config={config}
        />
      </main>

      {/* Modals */}
      {modals.project && (
        <ProjectModal
          onClose={() => setModals(prev => ({ ...prev, project: false }))}
          onCreate={handleCreateProject}
        />
      )}

      {modals.provider && (
        <ProviderModal
          providers={providers}
          onClose={() => setModals(prev => ({ ...prev, provider: false }))}
          onUpdate={async (id, updates) => {
            // Provider updates would go here
          }}
        />
      )}

      {modals.analyze && (
        <AnalyzeModal
          onClose={() => setModals(prev => ({ ...prev, analyze: false }))}
          onAnalyze={handleAnalyze}
          currentProject={currentProject}
          providers={providers}
          preferredProvider={config?.preferred_provider}
        />
      )}

      {modals.settings && (
        <SettingsModal
          config={config}
          onClose={() => setModals(prev => ({ ...prev, settings: false }))}
          onSave={handleConfigChange}
        />
      )}
    </div>
  );
}

export default App;