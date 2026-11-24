/**
 * Configuration Module
 * Application configuration management
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { ProviderConfig, CoreConfig, ProviderId, ProviderCapability } from '../types.js';
import { DEFAULT_PROVIDERS, getAvailableProviders, getProviderByCapability } from '../providers/rea-mcp.js';

export interface ConfigManagerOptions {
  configPath?: string;
  autoSave?: boolean;
}

export class ConfigManager {
  private configPath: string;
  private config: CoreConfig;
  private autoSave: boolean;
  private watchers: Set<() => void> = new Set();

  constructor(options: ConfigManagerOptions = {}) {
    this.configPath = options.configPath || path.join(process.cwd(), 'config', 'config.yaml');
    this.autoSave = options.autoSave ?? true;
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): CoreConfig {
    return {
      providers: DEFAULT_PROVIDERS,
      workspace: {
        defaultPath: path.join(process.cwd(), 'workspace'),
        recentProjects: [],
        maxRecentProjects: 10,
      },
      analysis: {
        defaultProfile: 'standard',
        timeoutMs: 300000,
        maxConcurrentFunctions: 10,
      },
      evidence: {
        storagePath: path.join(process.cwd(), 'evidence'),
        autoSave: true,
        compression: true,
      },
      ui: {
        theme: 'system',
        fontSize: 13,
        showAddresses: true,
      },
    };
  }

  async load(): Promise<CoreConfig> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const loaded = yaml.parse(data) as Partial<CoreConfig>;
      this.config = this.mergeConfig(this.getDefaultConfig(), loaded);
    } catch {
      // Use defaults if file doesn't exist
    }
    return this.config;
  }

  async save(): Promise<void> {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    const data = yaml.stringify(this.config);
    await fs.writeFile(this.configPath, data);
    this.notifyWatchers();
  }

  private mergeConfig(defaults: CoreConfig, loaded: Partial<CoreConfig>): CoreConfig {
    return {
      providers: loaded.providers || defaults.providers,
      workspace: { ...defaults.workspace, ...loaded.workspace },
      analysis: { ...defaults.analysis, ...loaded.analysis },
      evidence: { ...defaults.evidence, ...loaded.evidence },
      ui: { ...defaults.ui, ...loaded.ui },
    };
  }

  private notifyWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher();
      } catch (error) {
        console.error('Config watcher error:', error);
      }
    }
  }

  // ============================================================================
  // Configuration Access
  // ============================================================================

  getConfig(): CoreConfig {
    return this.config;
  }

  getProviders(): ProviderConfig[] {
    return this.config.providers;
  }

  getEnabledProviders(): ProviderConfig[] {
    return this.config.providers.filter(p => p.enabled);
  }

  getProviderById(id: ProviderId): ProviderConfig | undefined {
    return this.config.providers.find(p => p.id === id);
  }

  getProvidersByCapability(capability: ProviderCapability): ProviderConfig[] {
    return this.config.providers
      .filter(p => p.enabled && p.capabilities.includes(capability))
      .sort((a, b) => a.priority - b.priority);
  }

  getWorkspaceConfig(): CoreConfig['workspace'] {
    return this.config.workspace;
  }

  getAnalysisConfig(): CoreConfig['analysis'] {
    return this.config.analysis;
  }

  getEvidenceConfig(): CoreConfig['evidence'] {
    return this.config.evidence;
  }

  getUIConfig(): CoreConfig['ui'] {
    return this.config.ui;
  }

  // ============================================================================
  // Configuration Updates
  // ============================================================================

  updateProvider(providerId: ProviderId, updates: Partial<ProviderConfig>): boolean {
    const index = this.config.providers.findIndex(p => p.id === providerId);
    if (index === -1) return false;

    this.config.providers[index] = { 
      ...this.config.providers[index], 
      ...updates,
      id: providerId, // Ensure id is preserved
    } as ProviderConfig;
    
    if (this.autoSave) {
      this.save();
    }
    
    return true;
  }

  enableProvider(providerId: ProviderId): boolean {
    return this.updateProvider(providerId, { enabled: true });
  }

  disableProvider(providerId: ProviderId): boolean {
    return this.updateProvider(providerId, { enabled: false });
  }

  setProviderPriority(providerId: ProviderId, priority: number): boolean {
    return this.updateProvider(providerId, { priority });
  }

  updateWorkspaceConfig(updates: Partial<CoreConfig['workspace']>): void {
    this.config.workspace = { ...this.config.workspace, ...updates };
    if (this.autoSave) this.save();
  }

  updateAnalysisConfig(updates: Partial<CoreConfig['analysis']>): void {
    this.config.analysis = { ...this.config.analysis, ...updates };
    if (this.autoSave) this.save();
  }

  updateEvidenceConfig(updates: Partial<CoreConfig['evidence']>): void {
    this.config.evidence = { ...this.config.evidence, ...updates };
    if (this.autoSave) this.save();
  }

  updateUIConfig(updates: Partial<CoreConfig['ui']>): void {
    this.config.ui = { ...this.config.ui, ...updates };
    if (this.autoSave) this.save();
  }

  // ============================================================================
  // Watchers
  // ============================================================================

  watch(callback: () => void): () => void {
    this.watchers.add(callback);
    return () => this.watchers.delete(callback);
  }

  // ============================================================================
  // Presets
  // ============================================================================

  applyPreset(preset: 'minimal' | 'full' | 'cloud' | 'offline'): void {
    switch (preset) {
      case 'minimal':
        this.config.providers = this.config.providers.map(p => ({
          ...p,
          enabled: p.id === 'ghidra' || p.id === 'rea-js',
        }));
        this.config.analysis.defaultProfile = 'quick';
        break;
      case 'full':
        this.config.providers = this.config.providers.map(p => ({ ...p, enabled: true }));
        this.config.analysis.defaultProfile = 'deep';
        break;
      case 'cloud':
        this.config.providers = this.config.providers.map(p => ({
          ...p,
          enabled: p.id === 'kuna' || p.id === 'ghidra' || p.id === 'rea-js',
        }));
        this.config.analysis.defaultProfile = 'standard';
        break;
      case 'offline':
        this.config.providers = this.config.providers.map(p => ({
          ...p,
          enabled: p.id === 'ghidra' || p.id === 'ida' || p.id === 'rea-js',
        }));
        this.config.analysis.defaultProfile = 'standard';
        break;
    }
    
    if (this.autoSave) {
      this.save();
    }
  }
}

export function createConfigManager(options?: ConfigManagerOptions): ConfigManager {
  return new ConfigManager(options);
}

// ============================================================================
// Provider Configuration Helpers
// ============================================================================

export interface ProviderSetupInfo {
  id: ProviderId;
  name: string;
  description: string;
  requiredTools: string[];
  dockerImage?: string;
  installInstructions: string;
  capabilities: ProviderCapability[];
}

export const PROVIDER_SETUP_INFO: Record<ProviderId, ProviderSetupInfo> = {
  ghidra: {
    id: 'ghidra',
    name: 'Ghidra Headless Analyzer',
    description: 'NSA\'s open-source reverse engineering framework',
    requiredTools: ['java-21+', 'ghidra-11.2+'],
    dockerImage: 'ghcr.io/morluto/ghidra-headless:11.2',
    installInstructions: `
# Install Ghidra
# Option 1: Docker (recommended)
docker pull ghcr.io/morluto/ghidra-headless:11.2

# Option 2: Manual
# 1. Download from https://ghidra-sre.org/
# 2. Extract to /opt/ghidra
# 3. Ensure Java 21+ is installed
# 4. Set GHIDRA_INSTALL_DIR=/opt/ghidra
`,
    capabilities: ['native-decompile', 'native-callgraph', 'native-strings', 'native-imports', 'native-sections', 'android-decompile', 'firmware-extract'],
  },
  ida: {
    id: 'ida',
    name: 'IDA Pro MCP',
    description: 'Hex-Rays IDA Pro with MCP server',
    requiredTools: ['ida-pro-9.0+', 'python3', 'mrexodia/ida-pro-mcp'],
    dockerImage: 'mrexodia/ida-pro-mcp:9.0',
    installInstructions: `
# Install IDA Pro MCP
# Requires IDA Pro license
# 1. Install IDA Pro 9.0+
# 2. Run MCP server: docker run mrexodia/ida-pro-mcp
# 3. Set IDA_PATH=/opt/ida/ida64
`,
    capabilities: ['native-decompile', 'native-callgraph', 'native-strings', 'native-imports', 'native-sections'],
  },
  kuna: {
    id: 'kuna',
    name: 'Kuna Whole-Program Analysis',
    description: 'Fast whole-program analysis with cached exports',
    requiredTools: ['kuna-cli', 'rust'],
    dockerImage: 'ghcr.io/morluto/kuna:latest',
    installInstructions: `
# Install Kuna
# Option 1: Docker (recommended)
docker pull ghcr.io/morluto/kuna:latest

# Option 2: Cargo
cargo install --git https://github.com/morluto/kuna kuna-cli

# Option 3: Binary release
# Download from https://github.com/morluto/kuna/releases
`,
    capabilities: ['native-decompile', 'native-callgraph', 'native-strings', 'native-imports', 'native-sections'],
  },
  'rea-js': {
    id: 'rea-js',
    name: 'REA JavaScript Analyzer',
    description: 'Built-in JavaScript/Electron/Node.js analyzer',
    requiredTools: ['node-20+'],
    installInstructions: `
# REA JavaScript Analyzer is built into REA MCP
# No additional installation required
# Requires Node.js 20+ for ASAR extraction
`,
    capabilities: ['js-decompile', 'js-callgraph'],
  },
  auto: {
    id: 'auto',
    name: 'Auto (Best Available)',
    description: 'Automatically select the best available provider',
    requiredTools: [],
    installInstructions: '',
    capabilities: [],
  },
};

export function getProviderSetupInfo(providerId: ProviderId): ProviderSetupInfo {
  return PROVIDER_SETUP_INFO[providerId];
}

export function getAllProviderSetupInfo(): ProviderSetupInfo[] {
  return Object.values(PROVIDER_SETUP_INFO);
}

// ============================================================================
// Environment Validation
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: string[];
}

export async function validateEnvironment(config: CoreConfig): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // Check enabled providers
  for (const provider of config.providers.filter(p => p.enabled)) {
    const setupInfo = PROVIDER_SETUP_INFO[provider.id];
    
    // Check Docker
    try {
      const { spawn } = await import('node:child_process');
      await new Promise<void>((resolve, reject) => {
        const child = spawn('docker', ['image', 'inspect', setupInfo.dockerImage || ''], { stdio: 'ignore' });
        child.on('close', code => code === 0 ? resolve() : reject());
        child.on('error', reject);
      });
      info.push(`✓ Docker image available: ${setupInfo.dockerImage}`);
    } catch {
      warnings.push(`⚠ Docker image not found: ${setupInfo.dockerImage} (run: docker pull ${setupInfo.dockerImage})`);
    }

    // Check local tools
    for (const tool of setupInfo.requiredTools) {
      if (tool.includes('+')) {
        // Version check would go here
        info.push(`  Requires: ${tool}`);
      }
    }
  }

  // Check workspace paths
  try {
    await fs.access(config.workspace.defaultPath);
    info.push(`✓ Workspace path exists: ${config.workspace.defaultPath}`);
  } catch {
    warnings.push(`⚠ Workspace path does not exist: ${config.workspace.defaultPath!} (will be created)`);
  }

  try {
    await fs.access(config.evidence.storagePath);
    info.push(`✓ Evidence path exists: ${config.evidence.storagePath}`);
  } catch {
    warnings.push(`⚠ Evidence path does not exist: ${config.evidence.storagePath!} (will be created)`);
  }

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0] ?? '0');
  if (majorVersion < 20) {
    errors.push(`✗ Node.js ${nodeVersion} is too old. Requires Node.js 20+`);
  } else {
    info.push(`✓ Node.js ${nodeVersion}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
  };
}