#!/usr/bin/env node
/**
 * BoxREA CLI Entry Point
 */

import { Command } from 'commander';
import { createBoxREA, quickAnalyze, quickTriage } from '@boxrea/core';
import { version } from '../package.json';
import chalk from 'chalk';
import boxen from 'boxen';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

const program = new Command();

program
  .name('rea')
  .description('BoxREA - Reverse Engineering Analysis Platform')
  .version(version)
  .option('-w, --workspace <path>', 'Workspace path', process.cwd())
  .option('-p, --provider <provider>', 'Preferred provider (ghidra, ida, kuna, auto)')
  .option('-v, --verbose', 'Verbose output')
  .hook('preAction', (thisCommand, actionCommand) => {
    // Merge parent options into child command
    const parentOpts = thisCommand.opts();
    const childOpts = actionCommand.opts();
    Object.assign(actionCommand.opts(), parentOpts);
  });

// ============================================================================
// Global Options
// ============================================================================

program
  .option('--config <path>', 'Config file path')
  .option('--no-color', 'Disable colored output');

// ============================================================================
// Analyze Command
// ============================================================================

program
  .command('analyze <file>')
  .alias('a')
  .description('Analyze a binary/target file')
  .option('-p, --profile <profile>', 'Analysis profile (quick, standard, deep)', 'standard')
  .option('--provider <provider>', 'Override provider (ghidra, ida, kuna, auto)')
  .option('-o, --output <path>', 'Output file for results (JSON)')
  .option('--format <format>', 'Output format (json, summary, sarif)', 'summary')
  .option('--decompile', 'Include function decompilation')
  .option('--callgraph', 'Include call graph')
  .option('--max-functions <n>', 'Maximum functions to decompile', '20')
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(file);
      
      // Check file exists
      try {
        await fs.access(filePath);
      } catch {
        console.error(chalk.red(`Error: File not found: ${filePath}`));
        process.exit(1);
      }

      const instance = await createBoxREA({
        workspacePath: options.workspace,
        preferredProvider: options.provider as any,
      });

      console.log(chalk.cyan(`Analyzing: ${filePath}`));
      console.log(chalk.gray(`Profile: ${options.profile}`));

      const result = await instance.analyze(filePath, {
        analysisProfile: options.profile as any,
        provider: options.provider as any,
        includeDecompilation: options.decompile,
        includeCallGraph: options.callgraph,
        maxFunctions: parseInt(options.maxFunctions),
      });

      // Output results
      if (options.format === 'json') {
        const output = JSON.stringify(result, null, 2);
        if (options.output) {
          await fs.writeFile(options.output, output);
          console.log(chalk.green(`Results saved to: ${options.output}`));
        } else {
          console.log(output);
        }
      } else if (options.format === 'sarif') {
        // TODO: SARIF export
        console.log(chalk.yellow('SARIF format not yet implemented'));
      } else {
        printSummary(result);
      }

      await instance.saveConfig();
    } catch (error) {
      console.error(chalk.red('Analysis failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Triage Command
// ============================================================================

program
  .command('triage <file>')
  .alias('t')
  .description('Quick triage analysis (30 seconds)')
  .option('--provider <provider>', 'Override provider (ghidra, ida, kuna, auto)')
  .option('-o, --output <path>', 'Output file for results (JSON)')
  .option('--format <format>', 'Output format (json, summary)', 'summary')
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(file);
      
      try {
        await fs.access(filePath);
      } catch {
        console.error(chalk.red(`Error: File not found: ${filePath}`));
        process.exit(1);
      }

      const instance = await createBoxREA({
        workspacePath: options.workspace,
        preferredProvider: options.provider as any,
      });

      console.log(chalk.cyan(`Triage: ${filePath}`));

      const { detection, triage } = await instance.quickTriage(filePath);

      if (options.format === 'json') {
        const output = JSON.stringify({ detection, triage }, null, 2);
        if (options.output) {
          await fs.writeFile(options.output, output);
          console.log(chalk.green(`Results saved to: ${options.output}`));
        } else {
          console.log(output);
        }
      } else {
        printTriageSummary(detection.target, triage);
      }

      await instance.saveConfig();
    } catch (error) {
      console.error(chalk.red('Triage failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Deep Command
// ============================================================================

program
  .command('deep <file>')
  .alias('d')
  .description('Deep analysis with full decompilation')
  .option('--provider <provider>', 'Override provider (ghidra, ida, kuna, auto)')
  .option('-o, --output <path>', 'Output file for results (JSON)')
  .option('--max-functions <n>', 'Maximum functions to decompile', '50')
  .action(async (file, options) => {
    try {
      const filePath = path.resolve(file);
      
      try {
        await fs.access(filePath);
      } catch {
        console.error(chalk.red(`Error: File not found: ${filePath}`));
        process.exit(1);
      }

      const instance = await createBoxREA({
        workspacePath: options.workspace,
        preferredProvider: options.provider as any,
      });

      console.log(chalk.cyan(`Deep analysis: ${filePath}`));

      const result = await instance.deepAnalysis(filePath, parseInt(options.maxFunctions));

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(result, null, 2));
        console.log(chalk.green(`Results saved to: ${options.output}`));
      } else {
        printSummary(result);
        if (result.decompilations && result.decompilations.length > 0) {
          console.log(chalk.cyan('\nDecompiled Functions:'));
          for (const decomp of result.decompilations) {
            console.log(chalk.gray(`  ${decomp.functionName} (0x${decomp.functionAddress})`));
            console.log(chalk.gray(`  ${decomp.pseudocode.split('\n')[0]}...`));
          }
        }
      }

      await instance.saveConfig();
    } catch (error) {
      console.error(chalk.red('Deep analysis failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Project Commands
// ============================================================================

const projectCmd = program
  .command('project')
  .alias('p')
  .description('Project management');

projectCmd
  .command('create <name>')
  .description('Create a new project')
  .option('-d, --description <text>', 'Project description')
  .action(async (name, options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      const project = await instance.createProject(name, options.description);
      console.log(chalk.green(`Created project: ${project.name} (${project.id})`));
      console.log(chalk.gray(`Path: ${project.path}`));
    } catch (error) {
      console.error(chalk.red('Failed to create project:'), error);
      process.exit(1);
    }
  });

projectCmd
  .command('list')
  .description('List all projects')
  .action(async (options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      const projects = await instance.listProjects();
      
      if (projects.length === 0) {
        console.log(chalk.yellow('No projects found'));
        return;
      }

      console.log(chalk.cyan('Projects:'));
      for (const project of projects) {
        const current = instance.getCurrentProject()?.id === project.id ? ' *' : '';
        console.log(`  ${project.name}${current} - ${project.targets.length} targets - ${new Date(project.updatedAt).toLocaleDateString()}`);
      }
    } catch (error) {
      console.error(chalk.red('Failed to list projects:'), error);
      process.exit(1);
    }
  });

projectCmd
  .command('switch <nameOrId>')
  .description('Switch current project')
  .action(async (nameOrId, options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      let project = await instance.loadProject(nameOrId);
      
      if (!project) {
        project = await instance.workspace.loadProjectByName(nameOrId);
      }
      
      if (!project) {
        console.error(chalk.red(`Project not found: ${nameOrId}`));
        process.exit(1);
      }

      console.log(chalk.green(`Switched to project: ${project.name}`));
    } catch (error) {
      console.error(chalk.red('Failed to switch project:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Provider Commands
// ============================================================================

const providerCmd = program
  .command('provider')
  .alias('prov')
  .description('Provider management');

providerCmd
  .command('list')
  .description('List available providers')
  .action(async (options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      const providers = instance.config.getProviders();
      
      console.log(chalk.cyan('Providers:'));
      for (const provider of providers) {
        const status = provider.enabled ? chalk.green('enabled') : chalk.red('disabled');
        const caps = provider.capabilities.join(', ');
        console.log(`  ${provider.name} (${provider.id}) - ${status}`);
        console.log(chalk.gray(`    Capabilities: ${caps}`));
        console.log(chalk.gray(`    Priority: ${provider.priority}`));
      }
    } catch (error) {
      console.error(chalk.red('Failed to list providers:'), error);
      process.exit(1);
    }
  });

providerCmd
  .command('enable <providerId>')
  .description('Enable a provider')
  .action(async (providerId, options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      if (instance.config.enableProvider(providerId as any)) {
        console.log(chalk.green(`Enabled provider: ${providerId}`));
        await instance.saveConfig();
      } else {
        console.error(chalk.red(`Provider not found: ${providerId}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Failed to enable provider:'), error);
      process.exit(1);
    }
  });

providerCmd
  .command('disable <providerId>')
  .description('Disable a provider')
  .action(async (providerId, options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      if (instance.config.disableProvider(providerId as any)) {
        console.log(chalk.yellow(`Disabled provider: ${providerId}`));
        await instance.saveConfig();
      } else {
        console.error(chalk.red(`Provider not found: ${providerId}`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Failed to disable provider:'), error);
      process.exit(1);
    }
  });

providerCmd
  .command('preset <preset>')
  .description('Apply provider preset (minimal, full, cloud, offline)')
  .action(async (preset, options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      instance.config.applyPreset(preset as any);
      console.log(chalk.green(`Applied preset: ${preset}`));
      await instance.saveConfig();
    } catch (error) {
      console.error(chalk.red('Failed to apply preset:'), error);
      process.exit(1);
    }
  });

providerCmd
  .command('validate')
  .description('Validate provider environment')
  .action(async (options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      const result = await instance.validateEnvironment();
      
      console.log(chalk.cyan('Environment Validation:'));
      
      if (result.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        for (const error of result.errors) console.log(`  ${error}`);
      }
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        for (const warning of result.warnings) console.log(`  ${warning}`);
      }
      
      if (result.info.length > 0) {
        console.log(chalk.green('\nInfo:'));
        for (const info of result.info) console.log(`  ${info}`);
      }
      
      if (result.valid) {
        console.log(chalk.green('\n✓ Environment is valid'));
      } else {
        console.log(chalk.red('\n✗ Environment has errors'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Validation failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Evidence Commands
// ============================================================================

const evidenceCmd = program
  .command('evidence')
  .alias('e')
  .description('Evidence management');

evidenceCmd
  .command('list')
  .description('List evidence bundles')
  .option('--tags <tags>', 'Filter by tags (comma-separated)')
  .option('--provider <provider>', 'Filter by provider')
  .option('--type <type>', 'Filter by target type')
  .action(async (options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      const tags = options.tags ? options.tags.split(',') : undefined;
      
      const result = await instance.evidence.list({
        tags,
        providerId: options.provider as any,
        targetType: options.type as any,
      });
      
      if (result.items.length === 0) {
        console.log(chalk.yellow('No evidence bundles found'));
        return;
      }

      console.log(chalk.cyan(`Evidence Bundles (${result.total} total):`));
      for (const bundle of result.items) {
        console.log(`  ${bundle.target.name} (${bundle.target.type})`);
        console.log(chalk.gray(`    ID: ${bundle.id}`));
        console.log(chalk.gray(`    Created: ${new Date(bundle.createdAt).toLocaleString()}`));
        console.log(chalk.gray(`    Sessions: ${bundle.sessions.length}, Notes: ${bundle.notes.length}`));
        if (bundle.tags.length > 0) {
          console.log(chalk.gray(`    Tags: ${bundle.tags.join(', ')}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('Failed to list evidence:'), error);
      process.exit(1);
    }
  });

evidenceCmd
  .command('show <bundleId>')
  .description('Show evidence bundle details')
  .action(async (bundleId, options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      const bundle = await instance.evidence.load(bundleId);
      
      console.log(chalk.cyan(`Evidence Bundle: ${bundle.id}`));
      console.log(`Target: ${bundle.target.name} (${bundle.target.type})`);
      console.log(`Path: ${bundle.target.path}`);
      console.log(`SHA256: ${bundle.target.sha256}`);
      console.log(`Created: ${new Date(bundle.createdAt).toLocaleString()}`);
      console.log(`Sessions: ${bundle.sessions.length}`);
      console.log(`Notes: ${bundle.notes.length}`);
      console.log(`Bookmarks: ${bundle.bookmarks.length}`);
      console.log(`Tags: ${bundle.tags.join(', ') || 'none'}`);
      
      if (bundle.analyses.triage) {
        const t = bundle.analyses.triage;
        console.log(chalk.cyan('\nTriage Summary:'));
        console.log(`  Functions: ${t.summary.functions}`);
        console.log(`  Strings: ${t.summary.strings}`);
        console.log(`  Imports: ${t.summary.imports}`);
        console.log(`  Exports: ${t.summary.exports}`);
        console.log(`  Sections: ${t.summary.sections}`);
        console.log(`  Entropy: ${t.summary.entropy.toFixed(2)}`);
        console.log(`  Architecture: ${t.summary.architecture}`);
      }
    } catch (error) {
      console.error(chalk.red('Failed to show evidence:'), error);
      process.exit(1);
    }
  });

evidenceCmd
  .command('export <bundleId> <outputPath>')
  .description('Export evidence bundle')
  .option('--format <format>', 'Export format (json, sarif, html, markdown)', 'json')
  .action(async (bundleId, outputPath, options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      await instance.evidence.export(bundleId, outputPath, options.format as any);
      console.log(chalk.green(`Exported to: ${outputPath}`));
    } catch (error) {
      console.error(chalk.red('Export failed:'), error);
      process.exit(1);
    }
  });

evidenceCmd
  .command('compare <baseId> <compareId>')
  .description('Compare two evidence bundles')
  .action(async (baseId, compareId, options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      const diff = await instance.evidence.compare(baseId, compareId);
      
      console.log(chalk.cyan(`Comparison: ${baseId} vs ${compareId}`));
      console.log(`Similarity: ${(diff.similarityScore * 100).toFixed(1)}%`);
      console.log(`Added functions: ${diff.addedFunctions.length}`);
      console.log(`Removed functions: ${diff.removedFunctions.length}`);
      console.log(`Modified functions: ${diff.modifiedFunctions.length}`);
    } catch (error) {
      console.error(chalk.red('Comparison failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Config Commands
// ============================================================================

const configCmd = program
  .command('config')
  .alias('c')
  .description('Configuration management');

configCmd
  .command('show')
  .description('Show current configuration')
  .action(async (options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      const config = instance.config.getConfig();
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error(chalk.red('Failed to show config:'), error);
      process.exit(1);
    }
  });

configCmd
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key, value, options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      // Simple key-value setting would need more sophisticated path handling
      console.log(chalk.yellow('Config set not fully implemented - edit config file directly'));
    } catch (error) {
      console.error(chalk.red('Failed to set config:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Setup Command
// ============================================================================

program
  .command('setup')
  .description('Run provider setup script')
  .option('--dry-run', 'Show what would be done without executing')
  .option('--provider <provider>', 'Setup specific provider only')
  .action(async (options) => {
    try {
      const scriptPath = path.resolve(__dirname, '../../scripts/setup-providers.sh');
      const args = [];
      if (options.dryRun) args.push('--dry-run');
      if (options.provider) args.push('--provider', options.provider);
      
      console.log(chalk.cyan('Running provider setup...'));
      
      const { spawn } = await import('node:child_process');
      const child = spawn('bash', [scriptPath, ...args], {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../..'),
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          console.log(chalk.green('Setup completed successfully'));
        } else {
          console.error(chalk.red(`Setup failed with code ${code}`));
          process.exit(code || 1);
        }
      });
    } catch (error) {
      console.error(chalk.red('Setup failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Doctor Command
// ============================================================================

program
  .command('doctor')
  .description('Check REA installation and environment')
  .action(async (options) => {
    try {
      const instance = await createBoxREA({ workspacePath: options.workspace });
      const result = await instance.validateEnvironment();
      
      console.log(boxen(
        chalk.bold('BoxREA Doctor\n') +
        `Workspace: ${options.workspace}\n` +
        `Config: ${instance.config.getConfig().workspace.defaultPath}\n` +
        `Status: ${result.valid ? chalk.green('Healthy') : chalk.red('Issues Found')}`,
        { padding: 1, borderColor: result.valid ? 'green' : 'red' }
      ));
      
      if (result.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        for (const error of result.errors) console.log(`  ✗ ${error}`);
      }
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        for (const warning of result.warnings) console.log(`  ⚠ ${warning}`);
      }
      
      if (result.info.length > 0) {
        console.log(chalk.blue('\nInfo:'));
        for (const info of result.info) console.log(`  ℹ ${info}`);
      }
      
      if (!result.valid) {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('Doctor check failed:'), error);
      process.exit(1);
    }
  });

// ============================================================================
// Help & Version
// ============================================================================

program
  .command('completion <shell>')
  .description('Generate shell completion script')
  .action((shell) => {
    console.log(chalk.yellow('Shell completion generation not yet implemented'));
    console.log(chalk.gray(`Run: rea --help for usage`));
  });

// ============================================================================
// Utility Functions
// ============================================================================

function printSummary(result: any): void {
  console.log(chalk.cyan('\n═══ Analysis Summary ═══'));
  
  if (result.detection) {
    console.log(chalk.white(`Target: ${result.detection.target.name} (${result.detection.target.type})`));
    console.log(chalk.gray(`  Path: ${result.detection.target.path}`));
    console.log(chalk.gray(`  SHA256: ${result.detection.target.sha256}`));
    console.log(chalk.gray(`  Architecture: ${result.detection.target.architecture || 'unknown'}`));
    console.log(chalk.gray(`  Confidence: ${(result.detection.confidence * 100).toFixed(0)}%`));
  }

  if (result.triage) {
    const t = result.triage;
    console.log(chalk.cyan('\nTriage:'));
    console.log(`  Functions: ${t.summary.functions}`);
    console.log(`  Strings: ${t.summary.strings}`);
    console.log(`  Imports: ${t.summary.imports}`);
    console.log(`  Exports: ${t.summary.exports}`);
    console.log(`  Sections: ${t.summary.sections}`);
    console.log(`  Entropy: ${t.summary.entropy.toFixed(2)}`);
    console.log(`  Architecture: ${t.summary.architecture}`);
    if (t.summary.entryPoint) {
      console.log(`  Entry Point: 0x${t.summary.entryPoint}`);
    }
  }

  if (result.callGraph) {
    console.log(chalk.cyan('\nCall Graph:'));
    console.log(`  Nodes: ${result.callGraph.metadata.nodeCount}`);
    console.log(`  Edges: ${result.callGraph.metadata.edgeCount}`);
    console.log(`  Depth: ${result.callGraph.metadata.depth}`);
    console.log(`  Entry Points: ${result.callGraph.entryPoints.length}`);
  }

  if (result.decompilations && result.decompilations.length > 0) {
    console.log(chalk.cyan('\nDecompilations:'));
    for (const d of result.decompilations) {
      console.log(`  ${d.functionName} (0x${d.functionAddress}) - ${d.metadata.confidence * 100 | 0}%`);
    }
  }

  if (result.native) {
    console.log(chalk.cyan('\nNative Details:'));
    console.log(`  Strings: ${result.native.strings.length}`);
    console.log(`  Imports: ${result.native.imports.length}`);
    console.log(`  Exports: ${result.native.exports.length}`);
    console.log(`  Sections: ${result.native.sections.length}`);
  }
}

function printTriageSummary(target: any, triage: any): void {
  console.log(chalk.cyan('\n═══ Triage Summary ═══'));
  console.log(chalk.white(`Target: ${target.name} (${target.type})`));
  console.log(chalk.gray(`  Path: ${target.path}`));
  console.log(chalk.gray(`  SHA256: ${target.sha256}`));
  console.log(chalk.gray(`  Architecture: ${target.architecture || 'unknown'}`));
  
  console.log(chalk.cyan('\nSummary:'));
  console.log(`  Functions: ${triage.summary.functions}`);
  console.log(`  Strings: ${triage.summary.strings}`);
  console.log(`  Imports: ${triage.summary.imports}`);
  console.log(`  Exports: ${triage.summary.exports}`);
  console.log(`  Sections: ${triage.summary.sections}`);
  console.log(`  Entropy: ${triage.summary.entropy.toFixed(2)}`);
  console.log(`  Architecture: ${triage.summary.architecture}`);
  if (triage.summary.entryPoint) {
    console.log(`  Entry Point: 0x${triage.summary.entryPoint}`);
  }
  
  if (triage.strings.length > 0) {
    console.log(chalk.cyan('\nTop Strings:'));
    for (const s of triage.strings.slice(0, 10)) {
      console.log(`  0x${s.address}: ${s.value.substring(0, 80)}${s.value.length > 80 ? '...' : ''}`);
    }
    if (triage.strings.length > 10) {
      console.log(chalk.gray(`  ... and ${triage.strings.length - 10} more`));
    }
  }
}

// ============================================================================
// Error Handling
// ============================================================================

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled Rejection:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

// Parse arguments
program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red('Command failed:'), error);
  process.exit(1);
});