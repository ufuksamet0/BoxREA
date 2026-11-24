/**
 * BoxREA Core Types
 * Shared type definitions for the entire application
 */

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderId = 'ghidra' | 'ida' | 'kuna' | 'rea-js' | 'auto';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  enabled: boolean;
  priority: number; // Lower = higher priority
  config?: Record<string, unknown>;
  capabilities: ProviderCapability[];
}

export type ProviderCapability = 
  | 'native-decompile'
  | 'native-callgraph'
  | 'native-strings'
  | 'native-imports'
  | 'native-sections'
  | 'js-decompile'
  | 'js-callgraph'
  | 'android-decompile'
  | 'android-manifest'
  | 'firmware-extract'
  | 'dotnet-decompile'
  | 'wasm-decompile'
  | 'browser-capture'
  | 'network-capture';

export interface ProviderStatus {
  providerId: ProviderId;
  status: 'available' | 'busy' | 'error' | 'unavailable';
  lastCheck: number;
  error?: string;
  version?: string;
}

// ============================================================================
// Target Types
// ============================================================================

export type TargetType = 
  | 'elf' 
  | 'pe' 
  | 'macho' 
  | 'asar' 
  | 'apk' 
  | 'aab' 
  | 'dex' 
  | 'firmware' 
  | 'dotnet' 
  | 'wasm' 
  | 'browser' 
  | 'network-capture'
  | 'unknown';

export interface TargetInfo {
  id: string;
  path: string;
  name: string;
  type: TargetType;
  size: number;
  sha256: string;
  magic?: string;
  architecture?: string;
  bits?: 32 | 64;
  endianness?: 'little' | 'big';
  os?: string;
  compiler?: string;
  metadata?: Record<string, unknown>;
  detectedAt: number;
}

export interface TargetDetectionResult {
  target: TargetInfo;
  confidence: number; // 0-1
  alternativeTypes?: { type: TargetType; confidence: number }[];
}

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  targetId: string;
  providerId: ProviderId;
  status: 'initializing' | 'ready' | 'analyzing' | 'completed' | 'error' | 'closed';
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface SessionOptions {
  targetPath: string;
  providerId?: ProviderId;
  providerOptions?: Record<string, unknown>;
  autoAnalyze?: boolean;
  analysisProfile?: 'quick' | 'standard' | 'deep';
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface TriageResult {
  targetId: string;
  sessionId: string;
  summary: {
    strings: number;
    imports: number;
    exports: number;
    sections: number;
    functions: number;
    entropy: number;
    architecture: string;
    entryPoint?: string;
  };
  strings: StringResult[];
  imports: ImportResult[];
  exports: ExportResult[];
  sections: SectionResult[];
  functions: FunctionSummary[];
  completedAt: number;
  durationMs: number;
}

export interface StringResult {
  address: string;
  value: string;
  length: number;
  type: 'ascii' | 'unicode' | 'utf8' | 'wide';
  section?: string;
  references?: string[]; // Addresses that reference this string
}

export interface ImportResult {
  name: string;
  library: string;
  address?: string;
  ordinal?: number;
  type: 'function' | 'data';
}

export interface ExportResult {
  name: string;
  address: string;
  ordinal?: number;
  type: 'function' | 'data';
}

export interface SectionResult {
  name: string;
  address: string;
  size: number;
  offset: number;
  permissions: 'r' | 'w' | 'x' | 'rw' | 'rx' | 'rwx';
  type: 'code' | 'data' | 'bss' | 'rdata' | 'text' | 'unknown';
  entropy?: number;
}

export interface FunctionSummary {
  address: string;
  name: string;
  size: number;
  complexity?: number;
  callCount?: number;
  isEntry?: boolean;
  isThunk?: boolean;
  isImport?: boolean;
}

export interface DecompilationResult {
  functionAddress: string;
  functionName: string;
  pseudocode: string;
  assembly: AssemblyInstruction[];
  signature: FunctionSignature;
  variables: VariableInfo[];
  calls: CallSite[];
  xrefs: XRef[];
  metadata: {
    provider: ProviderId;
    decompiledAt: number;
    durationMs: number;
    confidence: number;
  };
}

export interface AssemblyInstruction {
  address: string;
  bytes: string;
  mnemonic: string;
  operands: string;
  comment?: string;
}

export interface FunctionSignature {
  returnType: string;
  name: string;
  callingConvention: string;
  parameters: ParameterInfo[];
  isVariadic: boolean;
}

export interface ParameterInfo {
  name: string;
  type: string;
  offset: number;
  size: number;
  register?: string;
}

export interface VariableInfo {
  name: string;
  type: string;
  address: string;
  size: number;
  scope: 'global' | 'local' | 'parameter' | 'return';
  register?: string;
}

export interface CallSite {
  address: string;
  targetAddress: string;
  targetName?: string;
  type: 'direct' | 'indirect' | 'tail';
}

export interface XRef {
  from: string;
  to: string;
  type: 'call' | 'data' | 'jump' | 'reference';
  isRead: boolean;
  isWrite: boolean;
}

export interface CallGraphResult {
  entryPoints: string[];
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
  metadata: {
    provider: ProviderId;
    generatedAt: number;
    depth: number;
    nodeCount: number;
    edgeCount: number;
  };
}

export interface CallGraphNode {
  id: string;
  address: string;
  name: string;
  type: 'function' | 'import' | 'thunk' | 'entry';
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface CallGraphEdge {
  source: string;
  target: string;
  type: 'call' | 'jump' | 'fallthrough';
  count?: number;
}

export interface DiffResult {
  baseTargetId: string;
  compareTargetId: string;
  addedFunctions: FunctionSummary[];
  removedFunctions: FunctionSummary[];
  modifiedFunctions: ModifiedFunction[];
  similarityScore: number;
  metadata: {
    comparedAt: number;
    baseSessionId: string;
    compareSessionId: string;
  };
}

export interface ModifiedFunction {
  base: FunctionSummary;
  compare: FunctionSummary;
  changes: {
    sizeDiff: number;
    instructionChanges: number;
    structuralSimilarity: number;
  };
}

// ============================================================================
// Evidence Types
// ============================================================================

export interface EvidenceBundle {
  id: string;
  version: string;
  createdAt: number;
  target: TargetInfo;
  sessions: Session[];
  analyses: {
    triage?: TriageResult;
    decompilations?: DecompilationResult[];
    callGraphs?: CallGraphResult[];
    diffs?: DiffResult[];
  };
  notes: Note[];
  bookmarks: Bookmark[];
  tags: string[];
}

export interface Note {
  id: string;
  sessionId: string;
  address?: string;
  functionAddress?: string;
  content: string;
  author?: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface Bookmark {
  id: string;
  sessionId: string;
  address: string;
  label: string;
  description?: string;
  color?: string;
  createdAt: number;
}

// ============================================================================
// Workspace Types
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  createdAt: number;
  updatedAt: number;
  targets: string[]; // Target IDs
  settings: ProjectSettings;
}

export interface ProjectSettings {
  defaultProvider: ProviderId;
  autoAnalyze: boolean;
  analysisProfile: 'quick' | 'standard' | 'deep';
  evidenceRetentionDays: number;
  maxConcurrentSessions: number;
}

// ============================================================================
// Event Types (for progress streaming)
// ============================================================================

export type AnalysisEventType = 
  | 'session:created'
  | 'session:ready'
  | 'session:error'
  | 'session:closed'
  | 'triage:started'
  | 'triage:progress'
  | 'triage:completed'
  | 'decompile:started'
  | 'decompile:completed'
  | 'decompile:error'
  | 'callgraph:started'
  | 'callgraph:completed'
  | 'callgraph:error'
  | 'evidence:saved'
  | 'evidence:loaded'
  | 'target:detected';

export interface AnalysisEvent {
  type: AnalysisEventType;
  sessionId?: string;
  targetId?: string;
  providerId?: ProviderId;
  payload: unknown;
  timestamp: number;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface CoreConfig {
  providers: ProviderConfig[];
  workspace: {
    defaultPath: string;
    recentProjects: string[];
    maxRecentProjects: number;
  };
  analysis: {
    defaultProfile: 'quick' | 'standard' | 'deep';
    timeoutMs: number;
    maxConcurrentFunctions: number;
  };
  evidence: {
    storagePath: string;
    autoSave: boolean;
    compression: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    showAddresses: boolean;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class BoxREAError extends Error {
  constructor(
    message: string,
    public code: string,
    public providerId?: ProviderId,
    public targetId?: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'BoxREAError';
  }
}

export class ProviderError extends BoxREAError {
  constructor(message: string, providerId: ProviderId, recoverable: boolean = true) {
    super(message, 'PROVIDER_ERROR', providerId, undefined, recoverable);
    this.name = 'ProviderError';
  }
}

export class TargetError extends BoxREAError {
  constructor(message: string, targetId: string, recoverable: boolean = false) {
    super(message, 'TARGET_ERROR', undefined, targetId, recoverable);
    this.name = 'TargetError';
  }
}

export class SessionError extends BoxREAError {
  constructor(message: string, sessionId: string, providerId: ProviderId, recoverable: boolean = true) {
    super(message, 'SESSION_ERROR', providerId, sessionId, recoverable);
    this.name = 'SessionError';
  }
}

export class AnalysisError extends BoxREAError {
  constructor(message: string, sessionId: string, providerId: ProviderId, recoverable: boolean = true) {
    super(message, 'ANALYSIS_ERROR', providerId, sessionId, recoverable);
    this.name = 'AnalysisError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type AsyncGenerator<T> = AsyncIterableIterator<T>;

// Re-export provider constants for convenience
export { DEFAULT_PROVIDERS, getAvailableProviders, getProviderByCapability } from './providers/rea-mcp.js';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface FilterOptions {
  query?: string;
  tags?: string[];
  dateRange?: { start: number; end: number };
  providerId?: ProviderId;
  targetType?: TargetType;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}