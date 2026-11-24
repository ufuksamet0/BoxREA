/**
 * Analysis Module
 * High-level analysis orchestration
 */

import { UniversalAnalyzer, createUniversalAnalyzer, UniversalAnalysisOptions, UniversalAnalysisResult } from '../targets/index.js';
import { REAMCPClient, createREAClient } from '../providers/rea-mcp.js';
import { TargetDetectionResult, ProviderId, TriageResult, DecompilationResult, CallGraphResult, DiffResult, EvidenceBundle } from '../types.js';

export interface AnalysisOrchestratorOptions {
  reaClient?: REAMCPClient;
  preferredProvider?: ProviderId;
}

export class AnalysisOrchestrator {
  private analyzer: UniversalAnalyzer;
  private reaClient: REAMCPClient;

  constructor(options: AnalysisOrchestratorOptions = {}) {
    this.reaClient = options.reaClient || createREAClient();
    this.analyzer = createUniversalAnalyzer({ reaClient: this.reaClient, preferredProvider: options.preferredProvider });
  }

  /**
   * Perform complete analysis of a target
   */
  async analyze(filePath: string, options: UniversalAnalysisOptions = {}): Promise<UniversalAnalysisResult> {
    return this.analyzer.analyze(filePath, options);
  }

  /**
   * Quick triage only (30 seconds max)
   */
  async quickTriage(filePath: string): Promise<{ detection: TargetDetectionResult; triage: TriageResult }> {
    const result = await this.analyzer.analyze(filePath, {
      analysisProfile: 'quick',
      includeDecompilation: false,
      includeCallGraph: false,
    });
    return { detection: result.detection, triage: result.triage! };
  }

  /**
   * Deep analysis with decompilation and call graph
   */
  async deepAnalysis(filePath: string, maxFunctions: number = 50): Promise<UniversalAnalysisResult> {
    return this.analyzer.analyze(filePath, {
      analysisProfile: 'deep',
      includeDecompilation: true,
      includeCallGraph: true,
      maxFunctions,
    });
  }

  /**
   * Compare two targets
   */
  async compareTargets(basePath: string, comparePath: string): Promise<DiffResult> {
    // This would use evidence comparison
    // For now, return placeholder
    throw new Error('Compare targets not yet implemented');
  }

  /**
   * Analyze multiple targets in batch
   */
  async batchAnalyze(filePaths: string[], options: UniversalAnalysisOptions = {}): Promise<UniversalAnalysisResult[]> {
    const results: UniversalAnalysisResult[] = [];
    for (const path of filePaths) {
      try {
        const result = await this.analyze(path, options);
        results.push(result);
      } catch (error) {
        console.error(`Failed to analyze ${path}:`, error);
        // Add error result
        results.push({ detection: { target: {} as any, confidence: 0 } as any });
      }
    }
    return results;
  }

  getAnalyzer(): UniversalAnalyzer {
    return this.analyzer;
  }

  getClient(): REAMCPClient {
    return this.reaClient;
  }
}

export function createAnalysisOrchestrator(options?: AnalysisOrchestratorOptions): AnalysisOrchestrator {
  return new AnalysisOrchestrator(options);
}

// ============================================================================
// Analysis Profiles
// ============================================================================

export const ANALYSIS_PROFILES = {
  quick: {
    name: 'Quick Triage',
    description: 'Fast overview (strings, imports, sections) - ~30 seconds',
    timeout: 30000,
    includeDecompilation: false,
    includeCallGraph: false,
    maxFunctions: 0,
  },
  standard: {
    name: 'Standard Analysis',
    description: 'Triage + call graph + key function decompilation - ~2 minutes',
    timeout: 120000,
    includeDecompilation: true,
    includeCallGraph: true,
    maxFunctions: 20,
  },
  deep: {
    name: 'Deep Analysis',
    description: 'Comprehensive analysis with full decompilation - ~10 minutes',
    timeout: 600000,
    includeDecompilation: true,
    includeCallGraph: true,
    maxFunctions: 100,
  },
} as const;

export type AnalysisProfileName = keyof typeof ANALYSIS_PROFILES;

// ============================================================================
// Analysis Pipeline
// ============================================================================

export interface AnalysisStep {
  name: string;
  description: string;
  execute: (context: AnalysisContext) => Promise<void>;
}

export interface AnalysisContext {
  filePath: string;
  detection: TargetDetectionResult;
  triage?: TriageResult;
  decompilations?: DecompilationResult[];
  callGraph?: CallGraphResult;
  evidence?: EvidenceBundle;
  errors: Error[];
  metadata: Record<string, unknown>;
}

export class AnalysisPipeline {
  private steps: AnalysisStep[] = [];
  private context: AnalysisContext | null = null;

  addStep(step: AnalysisStep): this {
    this.steps.push(step);
    return this;
  }

  async execute(filePath: string): Promise<AnalysisContext> {
    this.context = {
      filePath,
      detection: { target: {} as any, confidence: 0 } as any,
      errors: [],
      metadata: {},
    };

    for (const step of this.steps) {
      try {
        await step.execute(this.context!);
      } catch (error) {
        this.context!.errors.push(error as Error);
        console.error(`Step "${step.name}" failed:`, error);
      }
    }

    return this.context!;
  }

  getContext(): AnalysisContext | null {
    return this.context;
  }
}

export function createAnalysisPipeline(): AnalysisPipeline {
  return new AnalysisPipeline();
}

// ============================================================================
// Built-in Pipeline Steps
// ============================================================================

export const builtinSteps = {
  detect: {
    name: 'Target Detection',
    description: 'Identify target type and basic properties',
    async execute(context: AnalysisContext): Promise<void> {
      // Detection would be done by the orchestrator
    },
  },
  triage: {
    name: 'Triage Analysis',
    description: 'Quick overview of strings, imports, sections',
    async execute(context: AnalysisContext): Promise<void> {
      // Triage would be done by the orchestrator
    },
  },
  decompile: {
    name: 'Function Decompilation',
    description: 'Decompile key functions',
    async execute(context: AnalysisContext): Promise<void> {
      // Decompilation would be done by the orchestrator
    },
  },
  callgraph: {
    name: 'Call Graph Generation',
    description: 'Build call graph from entry points',
    async execute(context: AnalysisContext): Promise<void> {
      // Call graph would be done by the orchestrator
    },
  },
  evidence: {
    name: 'Evidence Collection',
    description: 'Save analysis results as evidence bundle',
    async execute(context: AnalysisContext): Promise<void> {
      // Evidence saving would be done by the orchestrator
    },
  },
};