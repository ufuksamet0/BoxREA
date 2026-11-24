// @ts-nocheck
/**
 * REA MCP Client Wrapper
 * Communicates with the REA MCP server for binary analysis
 */

import {
  ProviderId,
  ProviderConfig,
  ProviderStatus,
  ProviderCapability,
  TargetInfo,
  TargetDetectionResult,
  Session,
  SessionOptions,
  TriageResult,
  DecompilationResult,
  CallGraphResult,
  DiffResult,
  EvidenceBundle,
  Note,
  Bookmark,
  AnalysisEvent,
  AnalysisEventType,
  BoxREAError,
  ProviderError,
  SessionError,
  AnalysisError,
  TargetError,
  FilterOptions,
  PaginatedResult,
  StringResult,
  ImportResult,
  ExportResult,
  SectionResult,
  FunctionSummary,
} from '../types.js';

export interface REAMCPClientOptions {
  endpoint?: string; // MCP server endpoint (stdio, http, websocket)
  transport?: 'stdio' | 'http' | 'websocket';
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    remediation?: { action: string };
  };
}

interface MCPSession {
  sessionId: string;
  provider: string;
  targetPath: string;
  status: string;
  createdAt: number;
}

/**
 * REA MCP Client - Main interface for communicating with REA MCP server
 */
export class REAMCPClient {
  private endpoint: string;
  private transport: 'stdio' | 'http' | 'websocket';
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private activeSessions: Map<string, MCPSession> = new Map();
  private eventListeners: Map<AnalysisEventType, Set<(event: AnalysisEvent) => void>> = new Map();

  constructor(options: REAMCPClientOptions = {}) {
    this.endpoint = options.endpoint || process.env.REA_MCP_ENDPOINT || 'stdio';
    this.transport = options.transport || 'stdio';
    this.timeout = options.timeout || 300000; // 5 minutes default
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  // ============================================================================
  // Connection & Health
  // ============================================================================

  async healthCheck(): Promise<{ healthy: boolean; version?: string; providers: ProviderStatus[] }> {
    try {
      const result = await this.callTool('rea_doctor', { format: 'json' });
      return {
        healthy: true,
        version: result.version,
        providers: result.providers || [],
      };
    } catch (error) {
      return {
        healthy: false,
        providers: [],
      };
    }
  }

  async getNavigationContext(): Promise<{ document: string; address: string; procedure: string | null }> {
    const result = await this.callTool('rea_get_navigation_context', {});
    return result;
  }

  // ============================================================================
  // Target Detection & Session Management
  // ============================================================================

  async detectTarget(filePath: string): Promise<TargetDetectionResult> {
    const result = await this.callTool('rea_inspect_artifact', {
      path: filePath,
      detail: 'summary',
    });

    return this.parseTargetDetection(filePath, result);
  }

  async openBinary(options: SessionOptions): Promise<Session> {
    const provider = options.providerId || 'auto';
    
    // Map our provider IDs to REA provider IDs
    const reaProvider = this.mapProviderId(provider);
    
    const result = await this.callTool('rea_open_binary', {
      path: options.targetPath,
      provider_id: reaProvider,
      provider_options: options.providerOptions,
    });

    const session: Session = {
      id: result.session_id,
      targetId: result.target_id,
      providerId: provider,
      status: 'initializing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: options.providerOptions,
    };

    this.activeSessions.set(session.id, {
      sessionId: session.id,
      provider: reaProvider,
      targetPath: options.targetPath,
      status: 'initializing',
      createdAt: session.createdAt,
    });

    // Wait for session to be ready
    await this.waitForSessionReady(session.id);
    
    session.status = 'ready';
    session.updatedAt = Date.now();
    this.updateSessionStatus(session.id, 'ready');
    
    this.emitEvent({ type: 'session:created', sessionId: session.id, targetId: session.targetId, providerId: session.providerId, payload: session, timestamp: Date.now() });
    this.emitEvent({ type: 'session:ready', sessionId: session.id, targetId: session.targetId, providerId: session.providerId, payload: session, timestamp: Date.now() });

    return session;
  }

  async closeBinary(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`, sessionId, 'unknown');
    }

    await this.callTool('rea_close_binary', { session_id: sessionId });
    
    this.activeSessions.delete(sessionId);
    
    this.emitEvent({ type: 'session:closed', sessionId, targetId: session.targetId, providerId: session.provider as ProviderId, payload: { sessionId }, timestamp: Date.now() });
  }

  async getSessionStatus(sessionId: string): Promise<Session | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    const result = await this.callTool('rea_get_session_status', { session_id: sessionId });
    
    return {
      id: session.sessionId,
      targetId: session.targetId,
      providerId: session.provider as ProviderId,
      status: result.status,
      createdAt: session.createdAt,
      updatedAt: Date.now(),
    };
  }

  // ============================================================================
  // Analysis Operations
  // ============================================================================

  async runTriage(sessionId: string, options?: { detail?: 'summary' | 'full' }): Promise<TriageResult> {
    this.emitEvent({ type: 'triage:started', sessionId, payload: {}, timestamp: Date.now() });

    try {
      const result = await this.callTool('rea_binary_triage', {
        session_id: sessionId,
        detail: options?.detail || 'summary',
      });

      const triageResult = this.parseTriageResult(sessionId, result);
      
      this.emitEvent({ type: 'triage:completed', sessionId, payload: triageResult, timestamp: Date.now() });
      return triageResult;
    } catch (error) {
      this.emitEvent({ type: 'triage:started', sessionId, payload: { error: String(error) }, timestamp: Date.now() });
      throw new AnalysisError(`Triage failed: ${error}`, sessionId, 'unknown');
    }
  }

  async decompileFunction(sessionId: string, address: string, options?: { provider?: ProviderId }): Promise<DecompilationResult> {
    this.emitEvent({ type: 'decompile:started', sessionId, payload: { address }, timestamp: Date.now() });

    try {
      const provider = options?.provider || 'auto';
      const reaProvider = this.mapProviderId(provider);

      const result = await this.callTool('rea_decompile_function', {
        session_id: sessionId,
        address: address,
        provider_id: reaProvider,
      });

      const decompResult = this.parseDecompilationResult(address, result);
      
      this.emitEvent({ type: 'decompile:completed', sessionId, payload: decompResult, timestamp: Date.now() });
      return decompResult;
    } catch (error) {
      this.emitEvent({ type: 'decompile:error', sessionId, payload: { address, error: String(error) }, timestamp: Date.now() });
      throw new AnalysisError(`Decompilation failed: ${error}`, sessionId, 'unknown');
    }
  }

  async getCallGraph(sessionId: string, options?: { entryPoint?: string; depth?: number; maxNodes?: number }): Promise<CallGraphResult> {
    this.emitEvent({ type: 'callgraph:started', sessionId, payload: options, timestamp: Date.now() });

    try {
      const result = await this.callTool('rea_get_call_graph', {
        session_id: sessionId,
        entry_point: options?.entryPoint,
        max_depth: options?.depth || 10,
        max_nodes: options?.maxNodes || 1000,
      });

      const graphResult = this.parseCallGraphResult(result);
      
      this.emitEvent({ type: 'callgraph:completed', sessionId, payload: graphResult, timestamp: Date.now() });
      return graphResult;
    } catch (error) {
      this.emitEvent({ type: 'callgraph:error', sessionId, payload: { error: String(error) }, timestamp: Date.now() });
      throw new AnalysisError(`Call graph generation failed: ${error}`, sessionId, 'unknown');
    }
  }

  async getStrings(sessionId: string, options?: { minLength?: number; encoding?: string[] }): Promise<StringResult[]> {
    const result = await this.callTool('rea_get_strings', {
      session_id: sessionId,
      min_length: options?.minLength || 4,
      encodings: options?.encoding || ['ascii', 'utf8', 'unicode'],
    });

    return this.parseStringsResult(result);
  }

  async getImports(sessionId: string): Promise<ImportResult[]> {
    const result = await this.callTool('rea_get_imports', { session_id: sessionId });
    return this.parseImportsResult(result);
  }

  async getExports(sessionId: string): Promise<ExportResult[]> {
    const result = await this.callTool('rea_get_exports', { session_id: sessionId });
    return this.parseExportsResult(result);
  }

  async getSections(sessionId: string): Promise<SectionResult[]> {
    const result = await this.callTool('rea_get_sections', { session_id: sessionId });
    return this.parseSectionsResult(result);
  }

  async getFunctions(sessionId: string, options?: { filter?: string }): Promise<FunctionSummary[]> {
    const result = await this.callTool('rea_get_functions', {
      session_id: sessionId,
      filter: options?.filter,
    });
    return this.parseFunctionsResult(result);
  }

  // ============================================================================
  // Evidence Management
  // ============================================================================

  async exportEvidence(sessionId: string, outputPath: string, options?: { format?: 'json' | 'sarif' | 'html' }): Promise<void> {
    await this.callTool('rea_export_evidence', {
      session_id: sessionId,
      output_path: outputPath,
      format: options?.format || 'json',
    });

    this.emitEvent({ type: 'evidence:saved', sessionId, payload: { path: outputPath }, timestamp: Date.now() });
  }

  async importEvidence(filePath: string): Promise<EvidenceBundle> {
    const result = await this.callTool('rea_import_evidence', { path: filePath });
    return this.parseEvidenceBundle(result);
  }

  async listEvidence(options?: FilterOptions): Promise<PaginatedResult<EvidenceBundle>> {
    const result = await this.callTool('rea_list_evidence', options || {});
    return this.parsePaginatedEvidence(result);
  }

  async compareEvidence(baseId: string, compareId: string): Promise<DiffResult> {
    const result = await this.callTool('rea_compare_evidence', {
      base_evidence_id: baseId,
      compare_evidence_id: compareId,
    });
    return this.parseDiffResult(result);
  }

  // ============================================================================
  // JavaScript/Electron Analysis
  // ============================================================================

  async analyzeJavaScriptApplication(appPath: string, options?: { detail?: 'summary' | 'full' }): Promise<unknown> {
    const result = await this.callTool('rea_analyze_javascript_application', {
      path: appPath,
      detail: options?.detail || 'summary',
    });
    return result;
  }

  // ============================================================================
  // Android Analysis
  // ============================================================================

  async inspectAndroidPackage(apkPath: string, options?: { detail?: 'summary' | 'full' }): Promise<unknown> {
    const result = await this.callTool('rea_inspect_android_package', {
      path: apkPath,
      detail: options?.detail || 'summary',
    });
    return result;
  }

  // ============================================================================
  // Firmware Analysis
  // ============================================================================

  async inspectFirmwareRegions(firmwarePath: string): Promise<unknown> {
    const result = await this.callTool('rea_inspect_firmware_regions', { path: firmwarePath });
    return result;
  }

  async extractFirmware(firmwarePath: string, outputDir: string): Promise<unknown> {
    const result = await this.callTool('rea_extract_firmware', {
      path: firmwarePath,
      output_directory: outputDir,
    });
    return result;
  }

  // ============================================================================
  // .NET Analysis
  // ============================================================================

  async inspectManagedArtifact(assemblyPath: string): Promise<unknown> {
    const result = await this.callTool('rea_inspect_managed_artifact', { path: assemblyPath });
    return result;
  }

  // ============================================================================
  // WebAssembly Analysis
  // ============================================================================

  async inspectWasmArtifact(wasmPath: string): Promise<unknown> {
    const result = await this.callTool('rea_inspect_wasm_artifact', { path: wasmPath });
    return result;
  }

  // ============================================================================
  // Browser Runtime Observation
  // ============================================================================

  async listBrowserTargets(): Promise<unknown> {
    const result = await this.callTool('rea_list_browser_targets', {});
    return result;
  }

  async captureBrowserScenario(actions: unknown[]): Promise<unknown> {
    const result = await this.callTool('rea_capture_browser_scenario', { actions });
    return result;
  }

  // ============================================================================
  // Network Capture Analysis
  // ============================================================================

  async inspectNetworkCapture(capturePath: string, format: 'har' | 'saz' | 'pcap' | 'pcapng' | 'qlog'): Promise<unknown> {
    const result = await this.callTool('rea_inspect_web_network_capture', {
      path: capturePath,
      format,
    });
    return result;
  }

  // ============================================================================
  // Event System
  // ============================================================================

  on(eventType: AnalysisEventType, listener: (event: AnalysisEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
    
    return () => this.off(eventType, listener);
  }

  off(eventType: AnalysisEventType, listener: (event: AnalysisEvent) => void): void {
    this.eventListeners.get(eventType)?.delete(listener);
  }

  private emitEvent(event: AnalysisEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error(`Event listener error for ${event.type}:`, error);
        }
      }
    }
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  private async callTool(toolName: string, params: Record<string, unknown>): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await this.executeMCPCall(toolName, params);
        
        if (result.success === false) {
          throw new ProviderError(
            result.error?.message || `Tool ${toolName} failed`,
            'unknown',
            result.error?.retryable ?? false
          );
        }
        
        return result.data;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.retryAttempts) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError || new Error(`Tool ${toolName} failed after ${this.retryAttempts + 1} attempts`);
  }

  private async executeMCPCall(toolName: string, params: Record<string, unknown>): Promise<MCPToolResult> {
    // This is a placeholder for the actual MCP transport implementation
    // In a real implementation, this would use the MCP SDK to communicate
    // with the REA MCP server via stdio, HTTP, or WebSocket
    
    if (this.transport === 'stdio') {
      return this.executeStdioCall(toolName, params);
    } else if (this.transport === 'http') {
      return this.executeHttpCall(toolName, params);
    } else {
      return this.executeWebSocketCall(toolName, params);
    }
  }

  private async executeStdioCall(toolName: string, params: Record<string, unknown>): Promise<MCPToolResult> {
    // For now, we'll use the REA CLI as a subprocess
    // In production, this would use the MCP SDK stdio transport
    const { spawn } = await import('node:child_process');
    const { promisify } = await import('node:util');
    
    return new Promise((resolve, reject) => {
      const args = ['-y', 'rea-agents@6.7.0', 'mcp', 'call', toolName, JSON.stringify(params)];
      const child = spawn('npx', args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch {
            resolve({ success: true, data: stdout });
          }
        } else {
          reject(new Error(`REA MCP call failed (code ${code}): ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to spawn REA MCP: ${error.message}`));
      });
    });
  }

  private async executeHttpCall(toolName: string, params: Record<string, unknown>): Promise<MCPToolResult> {
    const response = await fetch(`${this.endpoint}/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
  }

  private async executeWebSocketCall(toolName: string, params: Record<string, unknown>): Promise<MCPToolResult> {
    // WebSocket implementation would go here
    throw new Error('WebSocket transport not yet implemented');
  }

  private async waitForSessionReady(sessionId: string, maxWait: number = 60000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < maxWait) {
      const session = this.activeSessions.get(sessionId);
      if (session && session.status === 'ready') {
        return;
      }
      await this.sleep(pollInterval);
    }

    throw new SessionError(`Session ${sessionId} did not become ready in time`, sessionId, 'unknown');
  }

  private updateSessionStatus(sessionId: string, status: MCPSession['status']): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = status;
    }
  }

  private mapProviderId(providerId: ProviderId): string {
    const map: Record<ProviderId, string> = {
      'ghidra': 'ghidra',
      'ida': 'ida',
      'kuna': 'kuna',
      'rea-js': 'rea-js',
      'auto': 'auto',
    };
    return map[providerId] || 'auto';
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Result Parsers
  // ============================================================================

  private parseTargetDetection(filePath: string, result: unknown): TargetDetectionResult {
    // Parse REA inspect_artifact result into TargetDetectionResult
    const data = result as Record<string, unknown>;
    return {
      target: {
        id: `target-${Date.now()}`,
        path: filePath,
        name: filePath.split('/').pop() || filePath,
        type: this.inferTargetType(data),
        size: (data.size as number) || 0,
        sha256: (data.sha256 as string) || '',
        magic: data.magic as string,
        architecture: data.architecture as string,
        bits: data.bits as 32 | 64,
        endianness: data.endianness as 'little' | 'big',
        os: data.os as string,
        compiler: data.compiler as string,
        detectedAt: Date.now(),
      },
      confidence: (data.confidence as number) || 0.9,
      alternativeTypes: [],
    };
  }

  private inferTargetType(data: Record<string, unknown>): string {
    const magic = (data.magic as string) || '';
    if (magic.startsWith('ELF')) return 'elf';
    if (magic.startsWith('MZ') || magic.startsWith('PE')) return 'pe';
    if (magic.startsWith('Mach-O') || magic.startsWith('CFFA')) return 'macho';
    if (magic.startsWith('ASAR')) return 'asar';
    if (magic.startsWith('PK') && (data as any).androidManifest) return 'apk';
    return 'unknown';
  }

  private parseTriageResult(sessionId: string, result: unknown): TriageResult {
    const data = result as Record<string, unknown>;
    return {
      targetId: data.target_id as string,
      sessionId,
      summary: {
        strings: (data.strings_count as number) || 0,
        imports: (data.imports_count as number) || 0,
        exports: (data.exports_count as number) || 0,
        sections: (data.sections_count as number) || 0,
        functions: (data.functions_count as number) || 0,
        entropy: (data.entropy as number) || 0,
        architecture: data.architecture as string,
        entryPoint: data.entry_point as string,
      },
      strings: this.parseStringsResult(data.strings),
      imports: this.parseImportsResult(data.imports),
      exports: this.parseExportsResult(data.exports),
      sections: this.parseSectionsResult(data.sections),
      functions: this.parseFunctionsResult(data.functions),
      completedAt: Date.now(),
      durationMs: (data.duration_ms as number) || 0,
    };
  }

  private parseDecompilationResult(address: string, result: unknown): DecompilationResult {
    const data = result as Record<string, unknown>;
    return {
      functionAddress: address,
      functionName: (data.name as string) || `sub_${address}`,
      pseudocode: (data.pseudocode as string) || '',
      assembly: this.parseAssembly(data.assembly),
      signature: this.parseSignature(data.signature),
      variables: this.parseVariables(data.variables),
      calls: this.parseCalls(data.calls),
      xrefs: this.parseXRefs(data.xrefs),
      metadata: {
        provider: (data.provider as ProviderId) || 'unknown',
        decompiledAt: Date.now(),
        durationMs: (data.duration_ms as number) || 0,
        confidence: (data.confidence as number) || 0.8,
      },
    };
  }

  private parseCallGraphResult(result: unknown): CallGraphResult {
    const data = result as Record<string, unknown>;
    return {
      entryPoints: (data.entry_points as string[]) || [],
      nodes: this.parseGraphNodes(data.nodes),
      edges: this.parseGraphEdges(data.edges),
      metadata: {
        provider: (data.provider as ProviderId) || 'unknown',
        generatedAt: Date.now(),
        depth: (data.depth as number) || 0,
        nodeCount: (data.node_count as number) || 0,
        edgeCount: (data.edge_count as number) || 0,
      },
    };
  }

  private parseStringsResult(data: unknown): StringResult[] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      address: item.address,
      value: item.value,
      length: item.length,
      type: item.type || 'ascii',
      section: item.section,
      references: item.references,
    }));
  }

  private parseImportsResult(data: unknown): ImportResult[] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      name: item.name,
      library: item.library,
      address: item.address,
      ordinal: item.ordinal,
      type: item.type || 'function',
    }));
  }

  private parseExportsResult(data: unknown): ExportResult[] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      name: item.name,
      address: item.address,
      ordinal: item.ordinal,
      type: item.type || 'function',
    }));
  }

  private parseSectionsResult(data: unknown): SectionResult[] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      name: item.name,
      address: item.address,
      size: item.size,
      offset: item.offset,
      permissions: item.permissions || 'r',
      type: item.type || 'unknown',
      entropy: item.entropy,
    }));
  }

  private parseFunctionsResult(data: unknown): FunctionSummary[] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      address: item.address,
      name: item.name,
      size: item.size,
      complexity: item.complexity,
      callCount: item.call_count,
      isEntry: item.is_entry,
      isThunk: item.is_thunk,
      isImport: item.is_import,
    }));
  }

  private parseAssembly(data: unknown): DecompilationResult['assembly'] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      address: item.address,
      bytes: item.bytes,
      mnemonic: item.mnemonic,
      operands: item.operands,
      comment: item.comment,
    }));
  }

  private parseSignature(data: unknown): DecompilationResult['signature'] {
    if (!data) return { returnType: 'void', name: '', callingConvention: '', parameters: [], isVariadic: false };
    const d = data as Record<string, unknown>;
    return {
      returnType: (d.return_type as string) || 'void',
      name: (d.name as string) || '',
      callingConvention: (d.calling_convention as string) || '',
      parameters: this.parseParameters(d.parameters),
      isVariadic: (d.is_variadic as boolean) || false,
    };
  }

  private parseParameters(data: unknown): DecompilationResult['signature']['parameters'] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      name: item.name,
      type: item.type,
      offset: item.offset,
      size: item.size,
      register: item.register,
    }));
  }

  private parseVariables(data: unknown): DecompilationResult['variables'] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      name: item.name,
      type: item.type,
      address: item.address,
      size: item.size,
      scope: item.scope || 'local',
      register: item.register,
    }));
  }

  private parseCalls(data: unknown): DecompilationResult['calls'] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      address: item.address,
      targetAddress: item.target_address,
      targetName: item.target_name,
      type: item.type || 'direct',
    }));
  }

  private parseXRefs(data: unknown): DecompilationResult['xrefs'] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      from: item.from,
      to: item.to,
      type: item.type || 'reference',
      isRead: item.is_read ?? false,
      isWrite: item.is_write ?? false,
    }));
  }

  private parseGraphNodes(data: unknown): CallGraphResult['nodes'] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      id: item.id,
      address: item.address,
      name: item.name,
      type: item.type || 'function',
      color: item.color,
      metadata: item.metadata,
    }));
  }

  private parseGraphEdges(data: unknown): CallGraphResult['edges'] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      source: item.source,
      target: item.target,
      type: item.type || 'call',
      count: item.count,
    }));
  }

  private parseEvidenceBundle(data: unknown): EvidenceBundle {
    const d = data as Record<string, unknown>;
    return {
      id: (d.id as string) || `evidence-${Date.now()}`,
      version: (d.version as string) || '1.0',
      createdAt: (d.created_at as number) || Date.now(),
      target: this.parseTargetInfo(d.target),
      sessions: this.parseSessions(d.sessions),
      analyses: d.analyses as EvidenceBundle['analyses'],
      notes: this.parseNotes(d.notes),
      bookmarks: this.parseBookmarks(d.bookmarks),
      tags: (d.tags as string[]) || [],
    };
  }

  private parseTargetInfo(data: unknown): TargetInfo {
    if (!data) return {} as TargetInfo;
    const d = data as Record<string, unknown>;
    return {
      id: (d.id as string) || '',
      path: (d.path as string) || '',
      name: (d.name as string) || '',
      type: (d.type as TargetType) || 'unknown',
      size: (d.size as number) || 0,
      sha256: (d.sha256 as string) || '',
      magic: d.magic as string,
      architecture: d.architecture as string,
      bits: d.bits as 32 | 64,
      endianness: d.endianness as 'little' | 'big',
      os: d.os as string,
      compiler: d.compiler as string,
      detectedAt: (d.detected_at as number) || Date.now(),
    };
  }

  private parseSessions(data: unknown): Session[] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      id: item.id,
      targetId: item.target_id,
      providerId: item.provider_id,
      status: item.status,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      metadata: item.metadata,
    }));
  }

  private parseNotes(data: unknown): Note[] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      id: item.id,
      sessionId: item.session_id,
      address: item.address,
      functionAddress: item.function_address,
      content: item.content,
      author: item.author,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      tags: item.tags || [],
    }));
  }

  private parseBookmarks(data: unknown): Bookmark[] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      id: item.id,
      sessionId: item.session_id,
      address: item.address,
      label: item.label,
      description: item.description,
      color: item.color,
      createdAt: item.created_at,
    }));
  }

  private parsePaginatedEvidence(data: unknown): PaginatedResult<EvidenceBundle> {
    const d = data as Record<string, unknown>;
    return {
      items: ((d.items as unknown[]) || []).map(item => this.parseEvidenceBundle(item)),
      total: (d.total as number) || 0,
      page: (d.page as number) || 1,
      pageSize: (d.page_size as number) || 20,
      hasMore: (d.has_more as boolean) || false,
    };
  }

  private parseDiffResult(data: unknown): DiffResult {
    const d = data as Record<string, unknown>;
    return {
      baseTargetId: (d.base_target_id as string) || '',
      compareTargetId: (d.compare_target_id as string) || '',
      addedFunctions: this.parseFunctionsResult(d.added_functions),
      removedFunctions: this.parseFunctionsResult(d.removed_functions),
      modifiedFunctions: this.parseModifiedFunctions(d.modified_functions),
      similarityScore: (d.similarity_score as number) || 0,
      metadata: {
        comparedAt: (d.compared_at as number) || Date.now(),
        baseSessionId: (d.base_session_id as string) || '',
        compareSessionId: (d.compare_session_id as string) || '',
      },
    };
  }

  private parseModifiedFunctions(data: unknown): DiffResult['modifiedFunctions'] {
    if (!data || !Array.isArray(data)) return [];
    return (data as any[]).map((item) => ({
      base: this.parseFunctionSummary(item.base),
      compare: this.parseFunctionSummary(item.compare),
      changes: {
        sizeDiff: item.changes?.size_diff || 0,
        instructionChanges: item.changes?.instruction_changes || 0,
        structuralSimilarity: item.changes?.structural_similarity || 0,
      },
    }));
  }

  private parseFunctionSummary(data: unknown): FunctionSummary {
    if (!data) return { address: '', name: '', size: 0 };
    const d = data as Record<string, unknown>;
    return {
      address: (d.address as string) || '',
      name: (d.name as string) || '',
      size: (d.size as number) || 0,
      complexity: d.complexity as number,
      callCount: d.call_count as number,
      isEntry: d.is_entry as boolean,
      isThunk: d.is_thunk as boolean,
      isImport: d.is_import as boolean,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createREAClient(options?: REAMCPClientOptions): REAMCPClient {
  return new REAMCPClient(options);
}

// ============================================================================
// Provider Registry
// ============================================================================

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'kuna',
    name: 'Kuna Whole-Program Analysis',
    enabled: true,
    priority: 1,
    capabilities: [
      'native-decompile',
      'native-callgraph',
      'native-strings',
      'native-imports',
      'native-sections',
    ],
  },
  {
    id: 'ghidra',
    name: 'Ghidra Headless Analyzer',
    enabled: true,
    priority: 2,
    capabilities: [
      'native-decompile',
      'native-callgraph',
      'native-strings',
      'native-imports',
      'native-sections',
      'android-decompile',
      'firmware-extract',
    ],
  },
  {
    id: 'ida',
    name: 'IDA Pro MCP',
    enabled: false,
    priority: 3,
    capabilities: [
      'native-decompile',
      'native-callgraph',
      'native-strings',
      'native-imports',
      'native-sections',
    ],
  },
  {
    id: 'rea-js',
    name: 'REA JavaScript Analyzer',
    enabled: true,
    priority: 1,
    capabilities: [
      'js-decompile',
      'js-callgraph',
    ],
  },
];

export function getAvailableProviders(): ProviderConfig[] {
  return DEFAULT_PROVIDERS.filter(p => p.enabled);
}

export function getProviderByCapability(capability: ProviderCapability): ProviderConfig[] {
  return DEFAULT_PROVIDERS.filter(p => p.enabled && p.capabilities.includes(capability))
    .sort((a, b) => a.priority - b.priority);
}