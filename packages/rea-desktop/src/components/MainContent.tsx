import React from 'react';
import { Play, Bug, Search, Filter, ChevronRight, FileCode, Terminal, Layers, Database } from 'lucide-react';
import { Project, ProviderInfo, AppConfig } from '../App';

interface MainContentProps {
  activePanel: string;
  currentProject: Project | null;
  config: AppConfig | null;
  providers: ProviderInfo[];
  onAnalyzeClick: () => void;
}

export function MainContent({
  activePanel,
  currentProject,
  config,
  providers,
  onAnalyzeClick,
}: MainContentProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Panel Header */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">
            {getPanelTitle(activePanel)}
          </h1>
          {currentProject && (
            <span className="badge-primary text-sm">
              {currentProject.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activePanel === 'analyze' && (
            <button onClick={onAnalyzeClick} className="btn-primary flex items-center gap-2">
              <Play className="w-4 h-4" />
              Analyze
            </button>
          )}
        </div>
      </div>

      {/* Panel Content */}
      <div className="content-area">
        {renderPanelContent(activePanel, currentProject, config, providers)}
      </div>
    </div>
  );
}

function getPanelTitle(panel: string): string {
  switch (panel) {
    case 'dashboard': return 'Dashboard';
    case 'analyze': return 'Analyze Target';
    case 'projects': return 'Projects';
    case 'evidence': return 'Evidence';
    case 'settings': return 'Settings';
    default: return 'Dashboard';
  }
}

function renderPanelContent(
  panel: string,
  currentProject: Project | null,
  config: AppConfig | null,
  providers: ProviderInfo[]
) {
  switch (panel) {
    case 'dashboard':
      return <DashboardPanel currentProject={currentProject} />;
    case 'analyze':
      return <AnalyzePanel currentProject={currentProject} providers={providers} preferredProvider={config?.preferred_provider} />;
    case 'projects':
      return <ProjectsPanel />;
    case 'evidence':
      return <EvidencePanel />;
    case 'settings':
      return <SettingsPanel config={config} providers={providers} />;
    default:
      return <DashboardPanel currentProject={currentProject} />;
  }
}

function DashboardPanel({ currentProject }: { currentProject: Project | null }) {
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Welcome to BoxREA</h2>
        <p className="text-text-muted mb-6">
          A comprehensive reverse engineering platform supporting native binaries, JavaScript/Electron apps, 
          Android APKs, firmware, .NET assemblies, WebAssembly, and browser runtime analysis.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard
            title="Analyze Binary"
            description="Open a native binary (ELF/PE/Mach-O) for analysis"
            icon={FileCode}
            action={() => {}}
          />
          <QuickActionCard
            title="Analyze APK"
            description="Reverse engineer Android applications"
            icon={Layers}
            action={() => {}}
          />
          <QuickActionCard
            title="Analyze Firmware"
            description="Extract and analyze firmware images"
            icon={Database}
            action={() => {}} />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Projects" value={currentProject ? "1" : "0"} icon={Layers} />
        <StatCard label="Providers" value="4" icon={Database} />
        <StatCard label="Analyses" value="0" icon={FileCode} />
        <StatCard label="Evidence" value="0" icon={Database} />
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h3 className="font-semibold mb-4">Recent Activity</h3>
        <div className="text-center py-8 text-text-muted">
          No recent activity. Start by analyzing a target or creating a project.
        </div>
      </div>
    </div>
  );
}

function AnalyzePanel({ 
  currentProject, 
  providers, 
  preferredProvider 
}: { 
  currentProject: Project | null; 
  providers: ProviderInfo[];
  preferredProvider: string | undefined;
}) {
  const [targetPath, setTargetPath] = React.useState('');
  const [provider, setProvider] = React.useState(preferredProvider || 'auto');
  const [profile, setProfile] = React.useState<'quick' | 'standard' | 'deep'>('standard');
  const [includeDecompile, setIncludeDecompile] = React.useState(true);
  const [includeCallgraph, setIncludeCallgraph] = React.useState(true);
  const [maxFunctions, setMaxFunctions] = React.useState(20);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Target Selection */}
      <div className="card">
        <h3 className="font-semibold mb-4">Target File</h3>
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Select or drag a file to analyze..."
            value={targetPath}
            onChange={(e) => setTargetPath(e.target.value)}
          />
          <button className="btn-secondary flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Browse
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">
          Supported: ELF, PE, Mach-O, APK, AAB, DEX, Firmware, .NET, WASM, ASAR, PCAP, HAR, SAZ
        </p>
      </div>

      {/* Provider Selection */}
      <div className="card">
        <h3 className="font-semibold mb-4">Provider</h3>
        <select
          className="input"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="auto">Auto (Best Available)</option>
          {providers.filter(p => p.enabled).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.status === 'available' ? '' : ` (${p.status})`}
            </option>
          ))}
        </select>
      </div>

      {/* Analysis Profile */}
      <div className="card">
        <h3 className="font-semibold mb-4">Analysis Profile</h3>
        <div className="space-y-3">
          {[
            { id: 'quick', title: 'Quick Triage', desc: 'Strings, imports, sections (~30s)' },
            { id: 'standard', title: 'Standard', desc: 'Triage + call graph + key decompilation (~2min)' },
            { id: 'deep', title: 'Deep Analysis', desc: 'Full decompilation + comprehensive analysis (~10min)' },
          ].map((p) => (
            <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              profile === p.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}>
              <input
                type="radio"
                name="profile"
                value={p.id}
                checked={profile === p.id}
                onChange={() => setProfile(p.id as any)}
                className="w-4 h-4 text-primary"
              />
              <div>
                <div className="font-medium">{p.title}</div>
                <div className="text-sm text-text-muted">{p.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Options */}
      <div className="card">
        <h3 className="font-semibold mb-4">Options</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={includeDecompile}
              onChange={(e) => setIncludeDecompile(e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border"
            />
            <div>
              <div className="font-medium">Include Decompilation</div>
              <div className="text-sm text-text-muted">Decompile functions (slower)</div>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={includeCallgraph}
              onChange={(e) => setIncludeCallgraph(e.target.checked)}
              className="w-4 h-4 text-primary rounded border-border"
            />
            <div>
              <div className="font-medium">Include Call Graph</div>
              <div className="text-sm text-text-muted">Generate function call graph</div>
            </div>
          </label>
          <div>
            <label className="label">Max Functions to Decompile</label>
            <input
              type="number"
              className="input w-32"
              value={maxFunctions}
              onChange={(e) => setMaxFunctions(parseInt(e.target.value) || 20)}
              min={1}
              max={200}
            />
          </div>
        </div>
      </div>

      {/* Start Button */}
      <div className="card">
        <button
          onClick={() => {}}
          disabled={!targetPath}
          className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" />
          Start Analysis
        </button>
        <p className="text-center text-sm text-text-muted mt-2">
          {targetPath ? 'Ready to analyze' : 'Select a target file to begin'}
        </p>
      </div>
    </div>
  );
}

function ProjectsPanel() {
  return (
    <div className="card">
      <h3 className="font-semibold mb-4">Project Management</h3>
      <div className="text-center py-8 text-text-muted">
        Project management panel - coming soon
      </div>
    </div>
  );
}

function EvidencePanel() {
  return (
    <div className="card">
      <h3 className="font-semibold mb-4">Evidence Browser</h3>
      <div className="text-center py-8 text-text-muted">
        Evidence browser - coming soon
      </div>
    </div>
  );
}

function SettingsPanel({ config, providers }: { config: AppConfig | null; providers: ProviderInfo[] }) {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="card">
        <h3 className="font-semibold mb-4">General</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Theme</label>
            <select className="input w-48" defaultValue={config?.ui_theme}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div>
            <label className="label">Font Size</label>
            <input type="number" className="input w-32" defaultValue={config?.ui_font_size} min={10} max={24} />
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" defaultChecked={config?.show_addresses} className="w-4 h-4 text-primary rounded border-border" />
            <span>Show addresses in UI</span>
          </label>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Analysis</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Default Provider</label>
            <select className="input w-64" defaultValue={config?.preferred_provider}>
              <option value="auto">Auto</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Default Profile</label>
            <select className="input w-48" defaultValue="standard">
              <option value="quick">Quick</option>
              <option value="standard">Standard</option>
              <option value="deep">Deep</option>
            </select>
          </div>
          <div>
            <label className="label">Timeout (ms)</label>
            <input type="number" className="input w-32" defaultValue={300000} min={30000} max={3600000} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-4">Providers Status</h3>
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-hover">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${p.enabled ? 'bg-success' : 'bg-text-muted'}`} />
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-text-muted">{p.capabilities.join(', ')}</div>
                </div>
              </div>
              <span className={`badge ${p.enabled ? 'badge-success' : 'badge'}`}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ title, description, icon: Icon, action }: { title: string; description: string; icon: React.ComponentType<{ className?: string }>; action: () => void }) {
  return (
    <button
      onClick={action}
      className="card p-4 flex flex-col gap-2 text-left hover:border-primary/50 transition-colors h-full"
    >
      <Icon className="w-8 h-8 text-primary" />
      <div className="font-medium">{title}</div>
      <div className="text-sm text-text-muted">{description}</div>
    </button>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-sm text-text-muted">{label}</div>
      </div>
    </div>
  );
}