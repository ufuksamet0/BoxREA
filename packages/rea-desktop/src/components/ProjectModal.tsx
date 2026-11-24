import React, { useState } from 'react';
import { X, FolderOpen } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ProjectModalProps {
  onClose: () => void;
  onCreate: (name: string, description?: string) => void;
}

export function ProjectModal({ onClose, onCreate }: ProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }
    onCreate(name.trim(), description.trim() || undefined);
    setName('');
    setDescription('');
    setError('');
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">New Project</h2>
          <button onClick={onClose} className="btn-ghost p-1 rounded hover:bg-surface-hover">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">Project Name</label>
            <input
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Reverse Engineering Project"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project..."
              rows={3}
            />
          </div>
          {error && (
            <div className="text-sm text-error bg-error/10 p-2 rounded">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}