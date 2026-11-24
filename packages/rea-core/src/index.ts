/**
 * BoxREA Core Library
 * Main entry point - exports all public APIs
 */

// Types
export * from './types.js';

// Providers
export { 
  REAMCPClient, 
  createREAClient, 
  DEFAULT_PROVIDERS, 
  getAvailableProviders, 
  getProviderByCapability 
} from './providers/rea-mcp.js';

// Targets
export * from './targets/index.js';
export {
  NativeTargetHandler,
  createNativeHandler,
  quickAnalyzeNative,
} from './targets/native.js';
export {
  JavaScriptTargetHandler,
  createJSHandler,
} from './targets/javascript.js';
export {
  AndroidTargetHandler,
  createAndroidHandler,
} from './targets/android.js';
export {
  FirmwareTargetHandler,
  createFirmwareHandler,
} from './targets/firmware.js';
export {
  DotNetTargetHandler,
  createDotNetHandler,
} from './targets/dotnet.js';
export {
  WasmTargetHandler,
  createWasmHandler,
} from './targets/wasm.js';
export {
  BrowserTargetHandler,
  createBrowserHandler,
} from './targets/browser.js';
export {
  NetworkTargetHandler,
  createNetworkHandler,
} from './targets/network.js';
export {
  TargetHandlerFactory,
  createTargetFactory,
  UniversalAnalyzer,
  createUniversalAnalyzer,
} from './targets/index.js';
export type { UniversalAnalysisOptions, UniversalAnalysisResult } from './targets/index.js';

// Analysis
export * from './analysis/index.js';
export type { AnalysisPipeline } from './analysis/index.js';
export {
  AnalysisOrchestrator,
  createAnalysisOrchestrator,
  ANALYSIS_PROFILES,
  createAnalysisPipeline,
  builtinSteps,
} from './analysis/index.js';

// Evidence
export * from './evidence/index.js';
export type { EvidenceStore } from './evidence/index.js';
export {
  createEvidenceStore,
  compareBundles,
  exportEvidence,
} from './evidence/index.js';

// Workspace
export * from './workspace/index.js';
export type { WorkspaceManager, WorkspaceConfigManager } from './workspace/index.js';
export {
  createWorkspaceManager,
  createWorkspaceConfigManager,
  DEFAULT_WORKSPACE_CONFIG,
} from './workspace/index.js';

// Config
export * from './config/index.js';
export type { ConfigManager } from './config/index.js';
export {
  createConfigManager,
  PROVIDER_SETUP_INFO,
  getProviderSetupInfo,
  getAllProviderSetupInfo,
  validateEnvironment,
} from './config/index.js';

// ============================================================================
// High-Level API
// ============================================================================

import { REAMCPClient, createREAClient } from './providers/rea-mcp.js';
import { AnalysisOrchestrator, createAnalysisOrchestrator } from './analysis/index.js';
import { EvidenceStore, createEvidenceStore } from './evidence/index.js';
import { WorkspaceManager, createWorkspaceManager } from './workspace/index.js';
import { ConfigManager, createConfigManager } from './config/index.js';
import { UniversalAnalyzer, createUniversalAnalyzer, UniversalAnalysisOptions, UniversalAnalysisResult } from './targets/index.js';
import { validateEnvironment } from './config';
import { ProviderId, TargetInfo, EvidenceBundle, TargetDetectionResult } from './types.js';

export interface BoxREAOptions {
  workspacePath?: string;
  configPath?: string;
  preferredProvider?: ProviderId;
  autoLoadConfig?: boolean;
}

export interface BoxREAInstance {
  config: ConfigManager;
  workspace: WorkspaceManager;
  analysis: AnalysisOrchestrator;
  evidence: EvidenceStore;
  analyzer: UniversalAnalyzer;
  client: REAMCPClient;
  
  // High-level methods
  analyze: (filePath: string, options?: UniversalAnalysisOptions) => Promise<UniversalAnalysisResult>;
  quickTriage: (filePath: string) => Promise<{ detection: TargetDetectionResult; triage: import('./types.js').TriageResult }>;
  deepAnalysis: (filePath: string, maxFunctions?: number) => Promise<UniversalAnalysisResult>;
  createProject: (name: string, description?: string) => Promise<import('./types.js').Project>;
  loadProject: (projectId: string) => Promise<import('./types.js').Project | null>;
  listProjects: () => Promise<import('./types.js').Project[]>;
  getCurrentProject: () => import('./types.js').Project | null;
  saveConfig: () => Promise<void>;
  validateEnvironment: () => Promise<import('./config').ValidationResult>;
}

/**
 * Create a BoxREA instance with all subsystems initialized
 */
export async function createBoxREA(options: BoxREAOptions = {}): Promise<BoxREAInstance> {
  const workspacePath = options.workspacePath || path.join(process.cwd(), 'workspace');
  const configPath = options.configPath || path.join(workspacePath, 'config', 'config.yaml');
  
  // Initialize config
  const config = createConfigManager({ configPath, autoSave: true });
  await config.load();
  
  // Initialize client
  const client = createREAClient();
  
  // Initialize workspace
  const workspace = createWorkspaceManager({
    workspacePath,
    reaClient: client,
    preferredProvider: options.preferredProvider,
  });
  
  // Initialize analysis
  const analysis = createAnalysisOrchestrator({
    reaClient: client,
    preferredProvider: options.preferredProvider,
  });
  
  // Initialize evidence store
  const evidence = createEvidenceStore({
    reaClient: client,
    storagePath: config.getEvidenceConfig().storagePath,
    autoSave: config.getEvidenceConfig().autoSave,
    compression: config.getEvidenceConfig().compression,
  });
  
  // Initialize universal analyzer
  const analyzer = createUniversalAnalyzer({
    reaClient: client,
    preferredProvider: options.preferredProvider,
  });

  // Create high-level API
  const instance: BoxREAInstance = {
    config,
    workspace,
    analysis,
    evidence,
    analyzer,
    client,
    
    // High-level methods
    analyze: (filePath: string, opts?: UniversalAnalysisOptions) => 
      analysis.analyze(filePath, opts),
    
    quickTriage: (filePath: string) => 
      analysis.quickTriage(filePath),
    
    deepAnalysis: (filePath: string, maxFunctions?: number) => 
      analysis.deepAnalysis(filePath, maxFunctions),
    
    createProject: (name: string, description?: string) => 
      workspace.createProject(name, description),
    
    loadProject: (projectId: string) => 
      workspace.loadProject(projectId),
    
    listProjects: () => 
      workspace.listProjects(),
    
    getCurrentProject: () => 
      workspace.getCurrentProject(),
    
    saveConfig: () => 
      config.save(),
    
    validateEnvironment: () => 
      validateEnvironment(config.getConfig()),
  };

  return instance;
}

/**
 * Quick analysis function for simple use cases
 */
export async function quickAnalyze(
  filePath: string, 
  options: { provider?: ProviderId; profile?: 'quick' | 'standard' | 'deep' } = {}
): Promise<UniversalAnalysisResult> {
  const instance = await createBoxREA({ preferredProvider: options.provider });
  return instance.analyze(filePath, { analysisProfile: options.profile || 'standard' });
}

/**
 * Quick triage function
 */
export async function quickTriage(
  filePath: string,
  options: { provider?: ProviderId } = {}
): Promise<{ detection: TargetDetectionResult; triage: import('./types.js').TriageResult }> {
  const instance = await createBoxREA({ preferredProvider: options.provider });
  return instance.quickTriage(filePath);
}

// Import path for the default export
import * as path from 'node:path';

// Default export
export default {
  createBoxREA,
  quickAnalyze,
  quickTriage,
  // Re-export all modules
  ...(await import('./types.js')),
  ...(await import('./providers/index.js')),
  ...(await import('./targets/index.js')),
  ...(await import('./analysis/index.js')),
  ...(await import('./evidence/index.js')),
  ...(await import('./workspace/index.js')),
  ...(await import('./config/index.js')),
};