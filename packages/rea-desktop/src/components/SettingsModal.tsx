import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AppConfig, ProviderInfo } from '../App';

interface SettingsModalProps {
  config: AppConfig | null;
  providers: ProviderInfo[];
  onClose: () => void;
  onSave: (config: Partial<AppConfig>) => void;
}

export function SettingsModal({ config, providers, onClose, onSave }: SettingsModalProps) {
  const [localConfig, setLocalConfig] = useState<AppConfig>(config || {
    workspace_path: '',
    preferred_provider: 'auto',
    ui_theme: 'system',
    ui_font_size: 13,
    show_addresses: true,
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'analysis' | 'providers' | 'advanced'>('general');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localConfig);
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-full max-w-3xl max-h-[90vh] mx-4 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Settings</h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost p-1 rounded hover:bg-surface-hover" disabled={saving}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs border-b border-border px-4">
          {[
            { id: 'general', label: 'General', icon: null },
            { id: 'analysis', label: 'Analysis', icon: null },
            { id: 'providers', label: 'Providers', icon: null },
            { id: 'advanced', label: 'Advanced', icon: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'general' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h3 className="font-semibold mb-4">Appearance</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Theme</label>
                    <select
                      className="input w-48"
                      value={localConfig.ui_theme}
                      onChange={(e) => setLocalConfig({ ...localConfig, ui_theme: e.target.value as any })}
                    >
                      <option value="system">System</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Font Size</label>
                    <input
                      type="number"
                      className="input w-32"
                      value={localConfig.ui_font_size}
                      onChange={(e) => setLocalConfig({ ...localConfig, ui_font_size: parseInt(e.target.value) })}
                      min={10}
                      max={24}
                    />
                  </div>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={localConfig.show_addresses}
                      onChange={(e) => setLocalConfig({ ...localConfig, show_addresses: e.target.checked })}
                      className="w-4 h-4 text-primary rounded border-border"
                    />
                    <span>Show addresses in UI</span>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Workspace</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Workspace Path</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input flex-1"
                        value={localConfig.workspace_path}
                        onChange={(e) => setLocalConfig({ ...localConfig, workspace_path: e.target.value })}
                        readOnly
                      />
                      <button className="btn-secondary" disabled>Browse</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h3 className="font-semibold mb-4">Default Analysis Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="label">Default Provider</label>
                    <select
                      className="input w-64"
                      value={localConfig.preferred_provider}
                      onChange={(e) => setLocalConfig({ ...localConfig, preferred_provider: e.target.value })}
                    >
                      <option value="auto">Auto</option>
                      {providers.filter(p => p.enabled).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Default Profile</label>
                    <select
                      className="input w-48"
                      value="standard"
                      onChange={(e) => {}}
                    >
                      <option value="quick">Quick</option>
                      <option value="standard">Standard</option>
                      <option value="deep">Deep</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Analysis Timeout (ms)</label>
                    <input
                      type="number"
                      className="input w-32"
                      value={300000}
                      onChange={(e) => {}}
                      min={30000}
                      max={3600000}
                      step={30000}
                    />
                  </div>
                  <div>
                    <label className="label">Max Concurrent Functions</label>
                    <input
                      type="number"
                      className="input w-32"
                      value={10}
                      onChange={(e) => {}}
                      min={1}
                      max={50}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Evidence</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-primary rounded border-border" />
                    <span>Auto-save evidence after analysis</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-primary rounded border-border" />
                    <span>Compress evidence bundles</span>
                  </label>
                  <div>
                    <label className="label">Retention Period (days)</label>
                    <input type="number" className="input w-32" defaultValue={30} min={1} max={365} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'providers' && (
            <div className="space-y-4">
              <h3 className="font-semibold mb-4">Provider Configuration</h3>
              <div className="space-y-3">
                {providers.map((p) => (
                  <div key={p.id} className="panel p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={() => {}}
                        className="w-4 h-4 text-primary rounded border-border"
                      />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-sm text-text-muted">{p.capabilities.join(', ')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`badge ${p.status === 'available' ? 'badge-success' : 'badge-warning'}`}>
                        {p.status}
                      </span>
                      <span className="badge text-xs">Priority: {p.priority}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h3 className="font-semibold mb-4">Debug</h3>
                <div className="space-y-3">
                  <button className="btn-secondary w-full justify-start">View Logs</button>
                  <button className="btn-secondary w-full justify-start">Clear Cache</button>
                  <button className="btn-secondary w-full justify-start">Reset All Settings</button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4">About</h3>
                <div className="text-sm text-text-muted space-y-1">
                  <p>BoxREA v0.1.0</p>
                  <p>Reverse Engineering Analysis Platform</p>
                  <p>Built with Tauri v2, React, TypeScript</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary flex items-center gap-2" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}