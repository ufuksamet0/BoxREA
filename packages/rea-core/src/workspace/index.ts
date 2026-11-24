/**
 * Workspace Module
 * Project and workspace management
 */

import { EvidenceStore, createEvidenceStore } from '../evidence/index.js';
import { AnalysisOrchestrator, createAnalysisOrchestrator } from '../analysis/index.js';
import { REAMCPClient, createREAClient } from '../providers/rea-mcp.js';
import { Project, ProjectSettings, TargetInfo, Session, EvidenceBundle, Note, Bookmark, ProviderId } from '../types.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface WorkspaceOptions {
  workspacePath: string;
  reaClient?: REAMCPClient;
  preferredProvider?: ProviderId;
}

export class WorkspaceManager {
  private workspacePath: string;
  private projectsPath: string;
  private evidencePath: string;
  private reaClient: REAMCPClient;
  private preferredProvider: ProviderId;
  private evidenceStore: EvidenceStore;
  private analysisOrchestrator: AnalysisOrchestrator;
  private currentProject: Project | null = null;
  private projectCache: Map<string, Project> = new Map();

  constructor(options: WorkspaceOptions) {
    this.workspacePath = options.workspacePath;
    this.projectsPath = path.join(this.workspacePath, 'projects');
    this.evidencePath = path.join(this.workspacePath, 'evidence');
    this.reaClient = options.reaClient || createREAClient();
    this.preferredProvider = options.preferredProvider || 'auto';

    this.evidenceStore = createEvidenceStore({
      reaClient: this.reaClient,
      storagePath: this.evidencePath,
    });

    this.analysisOrchestrator = createAnalysisOrchestrator({
      reaClient: this.reaClient,
      preferredProvider: this.preferredProvider,
    });

    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.projectsPath, { recursive: true });
    await fs.mkdir(this.evidencePath, { recursive: true });
  }

  // ============================================================================
  // Project Management
  // ============================================================================

  async createProject(name: string, description?: string, settings?: Partial<ProjectSettings>): Promise<Project> {
    const project: Project = {
      id: uuidv4(),
      name,
      description,
      path: path.join(this.projectsPath, name.toLowerCase().replace(/\s+/g, '-')),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      targets: [],
      settings: {
        defaultProvider: this.preferredProvider,
        autoAnalyze: true,
        analysisProfile: 'standard',
        evidenceRetentionDays: 30,
        maxConcurrentSessions: 4,
        ...settings,
      },
    };

    await fs.mkdir(project.path, { recursive: true });
    await this.saveProject(project);
    this.projectCache.set(project.id, project);
    this.currentProject = project;

    return project;
  }

  async loadProject(projectId: string): Promise<Project | null> {
    if (this.projectCache.has(projectId)) {
      this.currentProject = this.projectCache.get(projectId)!;
      return this.currentProject;
    }

    const projectPath = path.join(this.projectsPath, projectId, 'project.json');
    try {
      const data = await fs.readFile(projectPath, 'utf-8');
      const project = JSON.parse(data) as Project;
      this.projectCache.set(project.id, project);
      this.currentProject = project;
      return project;
    } catch {
      return null;
    }
  }

  async loadProjectByName(name: string): Promise<Project | null> {
    const projects = await this.listProjects();
    const project = projects.find(p => p.name === name);
    if (project) {
      return this.loadProject(project.id);
    }
    return null;
  }

  async saveProject(project: Project): Promise<void> {
    project.updatedAt = Date.now();
    const projectPath = path.join(project.path, 'project.json');
    await fs.writeFile(projectPath, JSON.stringify(project, null, 2));
    this.projectCache.set(project.id, project);
  }

  async deleteProject(projectId: string): Promise<boolean> {
    const project = await this.loadProject(projectId);
    if (!project) return false;

    await fs.rm(project.path, { recursive: true, force: true });
    this.projectCache.delete(projectId);
    
    if (this.currentProject?.id === projectId) {
      this.currentProject = null;
    }

    return true;
  }

  async listProjects(): Promise<Project[]> {
    const entries = await fs.readdir(this.projectsPath, { withFileTypes: true });
    const projects: Project[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(this.projectsPath, entry.name, 'project.json');
        try {
          const data = await fs.readFile(projectPath, 'utf-8');
          projects.push(JSON.parse(data));
        } catch {
          // Skip invalid projects
        }
      }
    }

    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getCurrentProject(): Project | null {
    return this.currentProject;
  }

  setCurrentProject(project: Project | null): void {
    this.currentProject = project;
  }

  // ============================================================================
  // Target Management within Project
  // ============================================================================

  async addTargetToProject(projectId: string, target: TargetInfo): Promise<void> {
    const project = await this.loadProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    if (!project.targets.includes(target.id)) {
      project.targets.push(target.id);
      await this.saveProject(project);
    }
  }

  async removeTargetFromProject(projectId: string, targetId: string): Promise<void> {
    const project = await this.loadProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    project.targets = project.targets.filter(id => id !== targetId);
    await this.saveProject(project);
  }

  // ============================================================================
  // Analysis Integration
  // ============================================================================

  async analyzeTarget(projectId: string, targetPath: string, options?: {
    analysisProfile?: 'quick' | 'standard' | 'deep';
    provider?: ProviderId;
  }): Promise<{ target: TargetInfo; evidence: EvidenceBundle }> {
    const project = await this.loadProject(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    // Run analysis
    const result = await this.analysisOrchestrator.analyze(targetPath, {
      analysisProfile: options?.analysisProfile || project.settings.analysisProfile,
      provider: options?.provider || project.settings.defaultProvider,
    });

    // Create evidence bundle
    const evidence = this.evidenceStore.createBundle(result.detection.target, [result.triage?.sessionId].filter(Boolean) as unknown as Session[]);
    
    // Add analyses to evidence
    evidence.analyses = {
      triage: result.triage,
      decompilations: result.decompilations,
      callGraphs: result.callGraph ? [result.callGraph] : undefined,
    };

    // Save evidence
    await this.evidenceStore.save(evidence);

    // Add target to project
    await this.addTargetToProject(projectId, result.detection.target);

    return { target: result.detection.target, evidence };
  }

  // ============================================================================
  // Notes & Bookmarks (Project-scoped)
  // ============================================================================

  async addNote(projectId: string, evidenceId: string, note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const evidence = await this.evidenceStore.load(evidenceId);
    const newNote = this.evidenceStore.addNote(evidence, note);
    await this.evidenceStore.save(evidence);
    return newNote;
  }

  async addBookmark(projectId: string, evidenceId: string, bookmark: Omit<Bookmark, 'id' | 'createdAt'>): Promise<Bookmark> {
    const evidence = await this.evidenceStore.load(evidenceId);
    const newBookmark = this.evidenceStore.addBookmark(evidence, bookmark);
    await this.evidenceStore.save(evidence);
    return newBookmark;
  }

  // ============================================================================
  // Workspace Export/Import
  // ============================================================================

  async exportWorkspace(outputPath: string): Promise<void> {
    const projects = await this.listProjects();
    const workspaceData = {
      version: '1.0',
      exportedAt: Date.now(),
      projects,
    };
    await fs.writeFile(outputPath, JSON.stringify(workspaceData, null, 2));
  }

  async importWorkspace(inputPath: string): Promise<number> {
    const data = await fs.readFile(inputPath, 'utf-8');
    const workspaceData = JSON.parse(data);
    
    let imported = 0;
    for (const project of workspaceData.projects) {
      try {
        // Create new project with imported data
        const newProject = await this.createProject(
          `${project.name} (imported)`,
          project.description,
          project.settings
        );
        
        // Copy targets
        newProject.targets = project.targets;
        await this.saveProject(newProject);
        imported++;
      } catch (error) {
        console.error(`Failed to import project ${project.name}:`, error);
      }
    }

    return imported;
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  getEvidenceStore(): EvidenceStore {
    return this.evidenceStore;
  }

  getAnalysisOrchestrator(): AnalysisOrchestrator {
    return this.analysisOrchestrator;
  }

  getClient(): REAMCPClient {
    return this.reaClient;
  }

  getWorkspacePath(): string {
    return this.workspacePath;
  }
}

export function createWorkspaceManager(options: WorkspaceOptions): WorkspaceManager {
  return new WorkspaceManager(options);
}

// ============================================================================
// Workspace Configuration
// ============================================================================

export interface WorkspaceConfig {
  version: string;
  workspacePath: string;
  recentProjects: string[];
  maxRecentProjects: number;
  defaultProvider: ProviderId;
  ui: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    showAddresses: boolean;
  };
  analysis: {
    defaultProfile: 'quick' | 'standard' | 'deep';
    timeoutMs: number;
    maxConcurrentFunctions: number;
  };
  evidence: {
    autoSave: boolean;
    compression: boolean;
    retentionDays: number;
  };
}

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  version: '1.0',
  workspacePath: '',
  recentProjects: [],
  maxRecentProjects: 10,
  defaultProvider: 'auto',
  ui: {
    theme: 'system',
    fontSize: 13,
    showAddresses: true,
  },
  analysis: {
    defaultProfile: 'standard',
    timeoutMs: 300000,
    maxConcurrentFunctions: 10,
  },
  evidence: {
    autoSave: true,
    compression: true,
    retentionDays: 30,
  },
};

export class WorkspaceConfigManager {
  private configPath: string;
  private config: WorkspaceConfig;

  constructor(workspacePath: string) {
    this.configPath = path.join(workspacePath, 'workspace.json');
    this.config = { ...DEFAULT_WORKSPACE_CONFIG, workspacePath };
  }

  async load(): Promise<WorkspaceConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...JSON.parse(data), workspacePath: this.config.workspacePath };
    } catch {
      // Use defaults
    }
    return this.config;
  }

  async save(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  getConfig(): WorkspaceConfig {
    return this.config;
  }

  updateConfig(updates: Partial<WorkspaceConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  addRecentProject(projectId: string): void {
    this.config.recentProjects = [
      projectId,
      ...this.config.recentProjects.filter(id => id !== projectId),
    ].slice(0, this.config.maxRecentProjects);
  }

  getRecentProjects(): string[] {
    return this.config.recentProjects;
  }
}

export function createWorkspaceConfigManager(workspacePath: string): WorkspaceConfigManager {
  return new WorkspaceConfigManager(workspacePath);
}