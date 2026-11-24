import React, { useState, useRef, useEffect } from 'react';
import { X, FolderOpen, Play, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Project, ProviderInfo } from '../App';

interface AnalyzeModalProps {
  onClose: () => void;
  onAnalyze: (targetPath: string, options: any) => void;
  currentProject: Project | null;
  providers: ProviderInfo[];
  preferredProvider: string | undefined;
}

export function AnalyzeModal({ onClose, onAnalyze, currentProject, providers, preferredProvider }: AnalyzeModalProps) {
  const [targetPath, setTargetPath] = useState('');
  const [provider, setProvider] = useState(preferredProvider || 'auto');
  const [profile, setProfile] = useState<'quick' | 'standard' | 'deep'>('standard');
  const [includeDecompile, setIncludeDecompile] = useState(true);
  const [includeCallgraph, setIncludeCallgraph] = useState(true);
  const [maxFunctions, setMaxFunctions] = useState(20);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the file input when modal opens
    // fileInputRef.current?.click();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTargetPath(file.path || URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      setTargetPath(file.path);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPath.trim()) {
      setError('Please select a target file');
      return;
    }
    if (analyzing) return;

    setAnalyzing(true);
    setError('');

    try {
      await onAnalyze(targetPath, {
        providerId: provider,
        analysisProfile: profile,
        includeDecompilation: includeDecompile,
        includeCallGraph: includeCallgraph,
        maxFunctions,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-full max-w-2xl max-h-[90vh] mx-4 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Analyze Target</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded hover:bg-surface-hover" disabled={analyzing}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Target File */}
          <div>
            <label className="label">Target File</label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                id="file-input"
                onChange={handleFileSelect}
                accept=".elf,.bin,.exe,.dll,.so,.dylib,.apk,.aab,.dex,.wasm,.asar,.pcap,.pcapng,.har,.saz,.qlog"
              />
              <div
                className={`border-2 rounded-lg p-4 transition-colors ${
                  targetPath
                    ? 'border-success bg-success/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="text"
                  className="hidden"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                />
                <div className="flex items-center justify-center gap-3 min-h-[80px]">
                  {targetPath ? (
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 text-success">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium truncate">{targetPath.split('/').pop() || targetPath}</span>
                      </div>
                      <div className="text-xs text-text-muted mt-1">{targetPath}</div>
                    </div>
                  ) : (
                    <div className="text-center text-text-muted">
                      <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>Click or drag a file to analyze</p>
                      <p className="text-xs mt-1">
                        ELF, PE, Mach-O, APK, AAB, DEX, WASM, ASAR, PCAP, HAR, SAZ, QLOG
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Provider */}
          <div>
            <label className="label">Analysis Provider</label>
            <select
              className="input"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={analyzing}
            >
              <option value="auto">Auto (Best Available)</option>
              {providers.filter(p => p.enabled).map((p) => (
                <option key={p.id} value={p.id} disabled={p.status !== 'available'}>
                  {p.name} {p.status !== 'available' ? ` (${p.status})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Profile */}
          <div>
            <label className="label">Analysis Profile</label>
            <div className="space-y-2">
              {[
                { id: 'quick', title: 'Quick Triage', desc: 'Strings, imports, sections (~30s)' },
                { id: 'standard', title: 'Standard', desc: 'Triage + call graph + key decompilation (~2min)' },
                { id: 'deep', title: 'Deep Analysis', desc: 'Full decompilation + comprehensive analysis (~10min)' },
              ].map((p) => (
                <label
                  key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    profile === p.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="profile"
                    value={p.id}
                    checked={profile === p.id}
                    onChange={() => setProfile(p.id as any)}
                    disabled={analyzing}
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
          <div>
            <label className="label">Options</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={includeDecompile}
                  onChange={(e) => setIncludeDecompile(e.target.checked)}
                  disabled={analyzing}
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
                  disabled={analyzing}
                  className="w-4 h-4 text-primary rounded border-border"
                />
                <div>
                  <div className="font-medium">Include Call Graph</div>
                  <div className="text-sm text-text-muted">Generate function call graph</div>
                </div>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Max Functions to Decompile</label>
                  <input
                    type="number"
                    className="input"
                    value={maxFunctions}
                    onChange={(e) => setMaxFunctions(Math.max(1, Math.min(200, parseInt(e.target.value) || 20)))}
                    min={1}
                    max={200}
                    disabled={analyzing}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={analyzing}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex items-center gap-2" disabled={analyzing || !targetPath}>
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start Analysis
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}