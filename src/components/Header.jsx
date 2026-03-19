import React, { useState } from 'react';
import Dialog from './Dialog';
import { getFileIcon } from '../lib/constants';
import FileTreeList from './FileTreeList';

export default function Header({ slug, onlineUsers, onToggleSidebar, sidebarOpen, rightPanel, onSetRightPanel, username, onRenameUser, allFiles, onDeselectFile }) {
  const [copied, setCopied] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportSelected, setExportSelected] = useState(new Set());

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openExportDialog = () => {
    // Default: all files selected
    setExportSelected(new Set(allFiles || []));
    setShowExport(true);
  };

  const toggleExportFile = (path) => {
    setExportSelected(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleExport = async () => {
    setShowExport(false);
    const selected = Array.from(exportSelected);
    if (selected.length === 0) return;

    // POST with selected files → download
    const res = await fetch(`/api/projects/${slug}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: selected }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slug}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveSnapshot = async (description) => {
    if (!description) description = 'Manual save';
    setShowSave(false);
    await fetch(`/api/projects/${slug}/snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, createdBy: username }),
    });
    if (rightPanel === 'snapshots') onSetRightPanel(null);
    setTimeout(() => onSetRightPanel('snapshots'), 50);
  };

  const allSelected = allFiles && exportSelected.size === allFiles.length;
  const noneSelected = exportSelected.size === 0;

  return (
    <>
      <header className="h-11 bg-[var(--ctp-mantle)] border-b border-[var(--ctp-surface0)] flex items-center px-3 gap-2 shrink-0 select-none">
        <button
          onClick={onToggleSidebar}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--ctp-surface0)] text-[var(--ctp-overlay1)] transition-colors text-sm"
          title={sidebarOpen ? 'Hide files' : 'Show files'}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>

        <span
          onClick={onDeselectFile}
          className="text-base font-bold text-[var(--ctp-text)] font-['Nunito'] tracking-tight cursor-pointer hover:text-[var(--ctp-blue)] transition-colors"
          title="Home"
        >
          ⚡ CodePad
        </span>

        <button
          onClick={copyLink}
          className="ml-1 px-2 py-0.5 text-xs font-['JetBrains_Mono'] text-[var(--ctp-blue)] bg-[var(--ctp-surface0)] rounded hover:bg-[var(--ctp-surface1)] transition-colors"
          title="Click to copy link"
        >
          /{slug} {copied ? '✓' : ''}
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setShowRename(true)}
          className="text-xs text-[var(--ctp-subtext0)] hover:text-[var(--ctp-text)] font-['Nunito'] transition-colors mr-1"
          title="Click to change name"
        >
          {username}
        </button>

        <div className="flex items-center gap-1 mr-2">
          {onlineUsers.map((user) => (
            <div
              key={user.clientId}
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-[var(--ctp-crust)] font-['Nunito']"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name[0].toUpperCase()}
            </div>
          ))}
          <span className="text-xs text-[var(--ctp-overlay0)] ml-1">
            {onlineUsers.length} online
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowSave(true)}
            className="px-2.5 py-1 text-xs rounded hover:bg-[var(--ctp-surface0)] text-[var(--ctp-overlay1)] hover:text-[var(--ctp-text)] transition-colors font-['Nunito'] font-medium"
          >
            Save
          </button>
          <button
            onClick={() => onSetRightPanel(rightPanel === 'comments' ? null : 'comments')}
            className={`px-2.5 py-1 text-xs rounded transition-colors font-['Nunito'] font-medium ${rightPanel === 'comments' ? 'bg-[var(--ctp-surface0)] text-[var(--ctp-blue)]' : 'hover:bg-[var(--ctp-surface0)] text-[var(--ctp-overlay1)] hover:text-[var(--ctp-text)]'}`}
          >
            Comments
          </button>
          <button
            onClick={() => onSetRightPanel(rightPanel === 'snapshots' ? null : 'snapshots')}
            className={`px-2.5 py-1 text-xs rounded transition-colors font-['Nunito'] font-medium ${rightPanel === 'snapshots' ? 'bg-[var(--ctp-surface0)] text-[var(--ctp-blue)]' : 'hover:bg-[var(--ctp-surface0)] text-[var(--ctp-overlay1)] hover:text-[var(--ctp-text)]'}`}
          >
            History
          </button>
          <button
            onClick={() => onSetRightPanel(rightPanel === 'activity' ? null : 'activity')}
            className={`px-2.5 py-1 text-xs rounded transition-colors font-['Nunito'] font-medium ${rightPanel === 'activity' ? 'bg-[var(--ctp-surface0)] text-[var(--ctp-blue)]' : 'hover:bg-[var(--ctp-surface0)] text-[var(--ctp-overlay1)] hover:text-[var(--ctp-text)]'}`}
          >
            Activity
          </button>
          <div className="w-px h-4 bg-[var(--ctp-surface1)] mx-1" />
          <button
            onClick={openExportDialog}
            className="px-2.5 py-1 text-xs rounded bg-[var(--ctp-blue)]/10 text-[var(--ctp-blue)] hover:bg-[var(--ctp-blue)]/20 transition-colors font-['Nunito'] font-semibold"
          >
            Export .zip
          </button>
        </div>
      </header>

      {/* Rename dialog */}
      <Dialog
        open={showRename}
        mode="prompt"
        title="Change your name"
        message="Other collaborators will see this name next to your cursor."
        placeholder="Enter a new name..."
        defaultValue={username}
        confirmLabel="Save"
        onConfirm={(name) => {
          setShowRename(false);
          if (name && onRenameUser) onRenameUser(name);
        }}
        onCancel={() => setShowRename(false)}
      />

      {/* Save version dialog */}
      <Dialog
        open={showSave}
        mode="prompt"
        title="Save a version"
        message="Your code auto-saves as you type. This creates a named snapshot you can go back to anytime — like a save slot."
        placeholder="e.g. Before changing sensor code"
        confirmLabel="Save"
        confirmColor="green"
        onConfirm={handleSaveSnapshot}
        onCancel={() => setShowSave(false)}
      />

      {/* Export dialog */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowExport(false)}>
          <div
            className="bg-[var(--ctp-surface0)] rounded-lg shadow-2xl w-[400px] max-h-[70vh] flex flex-col overflow-hidden border border-[var(--ctp-surface1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-sm font-bold text-[var(--ctp-text)] font-['Nunito']">Export .zip</h3>
              <p className="text-xs text-[var(--ctp-overlay1)] mt-1 font-['Nunito']">
                Select files to include ({exportSelected.size} of {allFiles?.length || 0})
              </p>
            </div>

            {/* Select all / none */}
            <div className="px-4 py-1.5 flex gap-2 border-b border-[var(--ctp-surface1)]">
              <button
                onClick={() => setExportSelected(new Set(allFiles || []))}
                className={`text-xs font-['Nunito'] transition-colors ${allSelected ? 'text-[var(--ctp-blue)]' : 'text-[var(--ctp-overlay0)] hover:text-[var(--ctp-text)]'}`}
              >
                Select All
              </button>
              <span className="text-[var(--ctp-surface2)]">·</span>
              <button
                onClick={() => setExportSelected(new Set())}
                className={`text-xs font-['Nunito'] transition-colors ${noneSelected ? 'text-[var(--ctp-blue)]' : 'text-[var(--ctp-overlay0)] hover:text-[var(--ctp-text)]'}`}
              >
                Select None
              </button>
              <span className="text-[var(--ctp-surface2)]">·</span>
              <button
                onClick={() => {
                  const inverted = new Set((allFiles || []).filter(f => !exportSelected.has(f)));
                  setExportSelected(inverted);
                }}
                className="text-xs text-[var(--ctp-overlay0)] hover:text-[var(--ctp-text)] font-['Nunito'] transition-colors"
              >
                Invert
              </button>
            </div>

            {/* File list — tree structure */}
            <div className="flex-1 overflow-y-auto px-2 py-1">
              <FileTreeList
                files={(allFiles || []).map(p => ({ path: p }))}
                selected={exportSelected}
                onToggle={toggleExportFile}
              />
            </div>

            {/* Actions */}
            <div className="px-4 py-3 flex justify-end gap-2 border-t border-[var(--ctp-surface1)]">
              <button
                onClick={() => setShowExport(false)}
                className="px-3 py-1.5 text-xs rounded text-[var(--ctp-overlay1)] hover:bg-[var(--ctp-surface1)] transition-colors font-['Nunito']"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exportSelected.size === 0}
                className="px-4 py-1.5 text-xs rounded bg-[var(--ctp-blue)] text-[var(--ctp-crust)] font-semibold hover:bg-[var(--ctp-blue)]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-['Nunito']"
              >
                Download ({exportSelected.size} files)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
