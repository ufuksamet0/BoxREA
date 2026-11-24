import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  showAddresses: boolean;
  sidebarWidth: number;
  panelSizes: Record<string, number>;
  recentFiles: string[];
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setFontSize: (size: number) => void;
  setShowAddresses: (show: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setPanelSize: (panel: string, size: number) => void;
  addRecentFile: (file: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      fontSize: 13,
      showAddresses: true,
      sidebarWidth: 288,
      panelSizes: {},
      recentFiles: [],
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setShowAddresses: (showAddresses) => set({ showAddresses }),
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setPanelSize: (panel, size) => set((state) => ({
        panelSizes: { ...state.panelSizes, [panel]: size }
      })),
      addRecentFile: (file) => set((state) => ({
        recentFiles: [file, ...state.recentFiles.filter(f => f !== file)].slice(0, 20)
      })),
    }),
    {
      name: 'boxrea-ui',
      version: 1,
    }
  )
);

interface AnalysisState {
  currentSession: string | null;
  currentTarget: string | null;
  triageData: any | null;
  decompilations: Map<string, any>;
  callGraph: any | null;
  hexView: { address: number; data: Uint8Array } | null;
  setCurrentSession: (sessionId: string | null) => void;
  setCurrentTarget: (targetId: string | null) => void;
  setTriageData: (data: any) => void;
  addDecompilation: (address: string, data: any) => void;
  removeDecompilation: (address: string) => void;
  setCallGraph: (data: any) => void;
  setHexView: (address: number, data: Uint8Array) => void;
  clearAnalysis: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  currentSession: null,
  currentTarget: null,
  triageData: null,
  decompilations: new Map(),
  callGraph: null,
  hexView: null,
  setCurrentSession: (currentSession) => set({ currentSession }),
  setCurrentTarget: (currentTarget) => set({ currentTarget }),
  setTriageData: (triageData) => set({ triageData }),
  addDecompilation: (address, data) => set((state) => {
    const newMap = new Map(state.decompilations);
    newMap.set(address, data);
    return { decompilations: newMap };
  }),
  removeDecompilation: (address) => set((state) => {
    const newMap = new Map(state.decompilations);
    newMap.delete(address);
    return { decompilations: newMap };
  }),
  setCallGraph: (callGraph) => set({ callGraph }),
  setHexView: (address, data) => set({ hexView: { address, data } }),
  clearAnalysis: () => set({
    currentSession: null,
    currentTarget: null,
    triageData: null,
    decompilations: new Map(),
    callGraph: null,
    hexView: null,
  }),
}));

interface ProjectState {
  projects: any[];
  currentProject: any | null;
  setProjects: (projects: any[]) => void;
  setCurrentProject: (project: any | null) => void;
  addProject: (project: any) => void;
  removeProject: (projectId: string) => void;
  updateProject: (projectId: string, updates: any) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  currentProject: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (currentProject) => set({ currentProject }),
  addProject: (project) => set((state) => ({
    projects: [project, ...state.projects]
  })),
  removeProject: (projectId) => set((state) => ({
    projects: state.projects.filter(p => p.id !== projectId),
    currentProject: state.currentProject?.id === projectId ? null : state.currentProject
  })),
  updateProject: (projectId, updates) => set((state) => ({
    projects: state.projects.map(p => p.id === projectId ? { ...p, ...updates } : p),
    currentProject: state.currentProject?.id === projectId ? { ...state.currentProject, ...updates } : state.currentProject
  })),
}));

// Combined store for convenience
export const useStore = () => ({
  ui: useUIStore(),
  analysis: useAnalysisStore(),
  project: useProjectStore(),
});