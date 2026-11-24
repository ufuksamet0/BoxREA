# BoxREA - Reverse Engineering Analysis Platform

A comprehensive reverse engineering platform supporting native binaries, JavaScript/Electron apps, Android APKs, firmware, .NET assemblies, WebAssembly, and browser runtime analysis.

## Features

- **Multi-target Support**: ELF, PE, Mach-O, APK, AAB, DEX, Firmware, .NET, WASM, ASAR, PCAP, HAR, SAZ, QLOG
- **Multiple Providers**: Ghidra, IDA Pro, Kuna, REA JavaScript Analyzer
- **Dual Interface**: CLI/TUI for servers + Desktop App (Tauri v2) for interactive analysis
- **Evidence Management**: Persistent analysis sessions, notes, bookmarks, comparison
- **Project Workspace**: Organize targets, analyses, and findings
- **Docker-based Providers**: Isolated, reproducible provider environments

## Architecture

```
BoxREA/
├── packages/
│   ├── rea-core/       # Shared TypeScript library (core logic, providers, targets)
│   ├── rea-cli/        # CLI/TUI application (Commander + Ink)
│   └── rea-desktop/    # Desktop app (Tauri v2 + React)
├── docker/             # Docker Compose for provider infrastructure
├── scripts/            # Setup and utility scripts
└── docs/               # Documentation
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Rust (for Tauri desktop app)

### Installation

```bash
# Clone and install dependencies
git clone <repo>
cd BoxREA
npm install

# Setup provider infrastructure (Docker)
npm run setup

# Or dry-run to see what would be installed
npm run setup:dry

# Build all packages
npm run build
```

### Development

```bash
# Start core library in watch mode
npm run dev:core

# Start CLI in watch mode
npm run dev:cli

# Start desktop app in development mode
npm run dev:desktop
```

## CLI Usage

```bash
# Quick triage (30 seconds)
rea triage ./malware.bin

# Standard analysis
rea analyze ./malware.bin --profile standard

# Deep analysis with decompilation
rea deep ./malware.bin --max-functions 50

# Project management
rea project create "My Project" -d "Description"
rea project list
rea project switch "My Project"

# Provider management
rea provider list
rea provider enable ghidra
rea provider preset full

# Evidence management
rea evidence list
rea evidence show <bundle-id>
rea evidence compare <base-id> <compare-id>

# Environment validation
rea doctor
```

## Desktop App

The desktop app provides a full GUI for interactive analysis:

- Multi-tab workspace
- Hex viewer with structure overlay
- Decompiler panel with syntax highlighting
- Interactive call graph visualization
- String/Import/Section browsers
- Evidence browser with search and filtering

## Provider Infrastructure

The Docker Compose setup includes:

- **rea-mcp**: REA MCP Server (main analysis engine)
- **ghidra**: Ghidra Headless Analyzer
- **kuna**: Kuna Whole-Program Analysis
- **firmware-tools**: Binwalk, Unblob, Jefferson
- **android-tools**: JADX, apktool, dex2jar
- **network-tools**: tshark, mitmproxy

## Configuration

Configuration is stored in `config/config.yaml`:

```yaml
providers:
  - id: ghidra
    enabled: true
    priority: 1
  - id: kuna
    enabled: true
    priority: 2
  - id: ida
    enabled: false
    priority: 3
  - id: rea-js
    enabled: true
    priority: 1

workspace:
  defaultPath: ./workspace
  recentProjects: []
  maxRecentProjects: 10

analysis:
  defaultProfile: standard
  timeoutMs: 300000
  maxConcurrentFunctions: 10

evidence:
  storagePath: ./evidence
  autoSave: true
  compression: true
```

## Project Structure

```
workspace/
├── projects/
│   └── my-project/
│       ├── project.json
│       └── targets/
├── evidence/
│   └── <bundle-id>.json
└── config/
    └── config.yaml
```

## Analysis Profiles

| Profile | Duration | Features |
|---------|----------|----------|
| Quick | ~30s | Strings, imports, sections, entropy |
| Standard | ~2min | Quick + call graph + key decompilation |
| Deep | ~10min | Standard + full decompilation |

## Supported Target Types

| Type | Extensions | Provider |
|------|------------|----------|
| Native (ELF) | .elf, .bin, .so | Ghidra, Kuna, IDA |
| Native (PE) | .exe, .dll, .sys | Ghidra, Kuna, IDA |
| Native (Mach-O) | .dylib, .so, binary | Ghidra, Kuna, IDA |
| Android | .apk, .aab, .dex | Ghidra, JADX |
| Firmware | .bin, .img, .fw | Binwalk, Unblob |
| .NET | .exe, .dll | REA Managed |
| WASM | .wasm, .wat | WABT |
| JavaScript | .asar, directory | REA JS |
| Network | .pcap, .pcapng, .har, .saz | tshark |

## Development Roadmap

### Phase 0 (Complete) - Provider Infrastructure
- [x] Docker Compose setup
- [x] Provider installation scripts
- [x] REA MCP integration

### Phase 1 (In Progress) - Core Library + CLI
- [x] REA MCP client wrapper
- [x] Target type handlers (native, JS, Android, firmware, .NET, WASM, browser, network)
- [x] Analysis orchestration (triage, decompile, callgraph)
- [x] Evidence management
- [x] Workspace/project management
- [x] CLI with Commander

### Phase 2 - Desktop App
- [x] Tauri v2 setup
- [x] Basic UI layout (Sidebar, MainContent, StatusBar)
- [x] Project/Provider/Analyze/Settings modals
- [ ] Hex viewer component
- [ ] Decompiler panel with Monaco
- [ ] Call graph with React Flow
- [ ] Evidence browser

### Phase 3 - Advanced Features
- [ ] Binary diff/comparison
- [ ] Plugin system
- [ ] Collaboration (CRDT sync)
- [ ] CI/CD integration
- [ ] Remote analysis

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Acknowledgments

- [REA](https://github.com/morluto/rea) - Reverse Engineering Assistant
- [Ghidra](https://ghidra-sre.org/) - NSA's RE framework
- [Kuna](https://github.com/morluto/kuna) - Whole-program analysis
- [Tauri](https://tauri.app/) - Desktop app framework
- [React Flow](https://reactflow.dev/) - Graph visualization
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor