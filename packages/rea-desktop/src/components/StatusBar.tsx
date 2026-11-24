import React from 'react';
import { Project, AppConfig } from '../App';
import { Database, Zap, Cpu, MemoryStick, Wifi, WifiOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface StatusBarProps {
  currentProject: Project | null;
  config: AppConfig | null;
}

export function StatusBar({ currentProject, config }: StatusBarProps) {
  const [status, setStatus] = React.useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  React.useEffect(() => {
    // Check REA MCP connection status
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    setStatus('connecting');
    try {
      // This would actually check the REA MCP connection
      // For now, simulate
      await new Promise(r => setTimeout(r, 500));
      setStatus('connected');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="status-bar">
      {/* Project Status */}
      {currentProject && (
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="font-medium">{currentProject.name}</span>
          <span className="text-text-muted">•</span>
          <span className="text-sm">{currentProject.targets.length} targets</span>
        </div>
      )}

      <div className="flex-1" />

      {/* REA MCP Status */}
      <div className="flex items-center gap-2">
        {status === 'connecting' && <Loader2 className="w-4 h-4 animate-spin text-warning" />}
        {status === 'connected' && <CheckCircle className="w-4 h-4 text-success" />}
        {status === 'error' && <AlertCircle className="w-4 h-4 text-error" />}
        {status === 'idle' && <WifiOff className="w-4 h-4 text-text-muted" />}
        <span className="text-sm text-text-muted capitalize">{status}</span>
      </div>

      <div className="w-px h-6 bg-border mx-2" />

      {/* Quick Stats */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span><Cpu className="w-3 h-3 inline mr-1" /> Provider: {config?.preferred_provider || 'auto'}</span>
        <span><MemoryStick className="w-3 h-3 inline mr-1" /> Font: {config?.ui_font_size}px</span>
        <span><Zap className="w-3 h-3 inline mr-1" /> Theme: {config?.ui_theme}</span>
      </div>
    </div>
  );
}