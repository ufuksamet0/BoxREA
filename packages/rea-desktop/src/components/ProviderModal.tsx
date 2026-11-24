import React from 'react';
import { X, CheckCircle, Circle, ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import { ProviderInfo } from '../App';

interface ProviderModalProps {
  providers: ProviderInfo[];
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<ProviderInfo>) => void;
}

export function ProviderModal({ providers, onClose, onUpdate }: ProviderModalProps) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const toggleProvider = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleEnabled = (provider: ProviderInfo) => {
    onUpdate(provider.id, { enabled: !provider.enabled });
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-full max-w-2xl max-h-[80vh] mx-4 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Provider Management</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded hover:bg-surface-hover">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-sm text-text-muted">
            Configure which analysis providers are enabled. Providers are tried in priority order (lower = higher priority).
          </div>
          
          {providers.map((provider) => {
            const isExpanded = expanded[provider.id];
            return (
              <div key={provider.id} className="panel border-border">
                <button
                  onClick={() => toggleProvider(provider.id)}
                  className="w-full p-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEnabled(provider);
                      }}
                      className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                        provider.enabled
                          ? 'border-success bg-success text-white'
                          : 'border-border bg-transparent text-text-muted hover:border-text-muted'
                      }`}
                    >
                      {provider.enabled && <CheckCircle className="w-3 h-3" />}
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${provider.enabled ? '' : 'text-text-muted'}`}>
                          {provider.name}
                        </span>
                        <span className={`badge ${provider.status === 'available' ? 'badge-success' : 'badge-warning'}`}>
                          {provider.status}
                        </span>
                        <span className="badge text-xs">Priority: {provider.priority}</span>
                      </div>
                      <div className="text-sm text-text-muted truncate">{provider.id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.capabilities.map((cap) => (
                      <span key={cap} className="badge-primary text-xs">{cap}</span>
                    ))}
                    <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-text-muted">ID:</span>
                        <code className="ml-2 font-mono">{provider.id}</code>
                      </div>
                      <div>
                        <span className="text-text-muted">Priority:</span>
                        <input
                          type="number"
                          className="ml-2 w-16 input"
                          value={provider.priority}
                          onChange={(e) => onUpdate(provider.id, { priority: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-text-muted">Capabilities:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {provider.capabilities.map((cap) => (
                          <span key={cap} className="badge">{cap}</span>
                        ))}
                      </div>
                    </div>
                    {provider.status !== 'available' && (
                      <div className="flex items-center gap-2 p-2 bg-warning/10 rounded border border-warning/20">
                        <AlertCircle className="w-4 h-4 text-warning" />
                        <span className="text-sm text-warning">
                          Provider not available. Check Docker installation and image availability.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="border-t border-border p-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}