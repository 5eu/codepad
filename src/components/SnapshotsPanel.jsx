import React, { useState, useEffect, useCallback } from 'react';
import * as Y from 'yjs';
import Dialog from './Dialog';
import { getFileIcon } from '../lib/constants';
import FileTreeList from './FileTreeList';

export default function SnapshotsPanel({ slug, username, fileMapRef, ydoc, onClose }) {
  const [snapshots, setSnapshots] = useState([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [previewFile, setPreviewFile] = useState(null); // { path, content }
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreSelection, setRestoreSelection] = useState(new Set()); // paths to restore

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/snapshots`);
      if (res.ok) setSnapshots(await res.json());
    } catch (e) { /* ignore */ }
  }, [slug]);

  useEffect(() => { loadSnapshots(); }, [loadSnapshots]);

  const handleViewSnapshot = async (snapshot) => {
    if (selectedSnapshot?._id === snapshot._id) {
      setSelectedSnapshot(null);
      setDiffData(null);
      setPreviewFile(null);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${slug}/snapshots/${snapshot._id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSnapshot(snapshot);
        setDiffData(data.files || []);
        setPreviewFile(null);
        // Default: all files selected for restore
        setRestoreSelection(new Set((data.files || []).map(f => f.path)));
      }
    } catch (e) { /* ignore */ }
  };

  const toggleFileSelection = (path) => {
    setRestoreSelection(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleRestore = async () => {
    if (!restoreTarget || !ydoc || !fileMapRef?.current || restoreSelection.size === 0) return;

    try {
      const res = await fetch(`/api/projects/${slug}/snapshots/${restoreTarget._id}`);
      if (!res.ok) return;
      const data = await res.json();
      const snapshotFiles = (data.files || []).filter(f => restoreSelection.has(f.path));

      const fileMap = fileMapRef.current;
      ydoc.transact(() => {
        snapshotFiles.forEach(f => {
          // Delete existing file if present, then recreate
          if (fileMap.has(f.path)) fileMap.delete(f.path);
          const ytext = new Y.Text();
          ytext.insert(0, f.content || '');
          fileMap.set(f.path, ytext);
        });
      });

      await fetch(`/api/projects/${slug}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore',
          author: username,
          summary: `Restored ${snapshotFiles.length} file(s) from: ${restoreTarget.description}`,
        }),
      }).catch(() => {});

    } catch (e) {
      console.error('Restore failed:', e);
    }
    setRestoreTarget(null);
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <>
      <div className="w-80 bg-[var(--ctp-mantle)] border-l border-[var(--ctp-surface0)] flex flex-col shrink-0 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ctp-surface0)]">
          <span className="text-xs font-semibold text-[var(--ctp-overlay0)] uppercase tracking-wider font-['Nunito']">
            {previewFile ? 'Preview' : 'History'}
          </span>
          <div className="flex items-center gap-1">
            {previewFile && (
              <button
                onClick={() => setPreviewFile(null)}
                className="text-xs text-[var(--ctp-blue)] hover:text-[var(--ctp-text)] font-['Nunito']"
              >
                ← Back
              </button>
            )}
            <button onClick={onClose} className="text-[var(--ctp-overlay0)] hover:text-[var(--ctp-text)] text-sm">✕</button>
          </div>
        </div>

        {/* Code preview mode */}
        {previewFile && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-1.5 border-b border-[var(--ctp-surface0)] flex items-center gap-1.5">
              <span className="text-xs">{getFileIcon(previewFile.path)}</span>
              <span className="text-xs text-[var(--ctp-text)] font-['JetBrains_Mono'] truncate">{previewFile.path}</span>
            </div>
            <pre className="flex-1 overflow-auto p-3 text-xs text-[var(--ctp-subtext1)] font-['JetBrains_Mono'] leading-relaxed whitespace-pre-wrap break-all bg-[var(--ctp-crust)]">
              {previewFile.content || '(empty file)'}
            </pre>
          </div>
        )}

        {/* Snapshot list mode */}
        {!previewFile && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {snapshots.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-[var(--ctp-overlay0)]">No checkpoints yet</p>
                <p className="text-xs text-[var(--ctp-overlay0)] mt-1">Click "Checkpoint" to save your progress</p>
              </div>
            )}
            {snapshots.map(snap => (
              <div key={snap._id}>
                <div
                  className={`rounded-md border text-xs cursor-pointer transition-colors ${selectedSnapshot?._id === snap._id ? 'border-[var(--ctp-blue)] bg-[var(--ctp-surface0)]' : 'border-[var(--ctp-surface0)] hover:border-[var(--ctp-surface1)] bg-[var(--ctp-surface0)]/30'}`}
                  onClick={() => handleViewSnapshot(snap)}
                >
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-semibold text-[var(--ctp-text)] font-['Nunito'] truncate">
                        {snap.description}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--ctp-overlay0)]">
                      <span>{snap.createdBy}</span>
                      <span>{formatTime(snap.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {selectedSnapshot?._id === snap._id && diffData && (
                  <div className="mt-1 rounded-md border border-[var(--ctp-surface0)] bg-[var(--ctp-crust)] p-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-[var(--ctp-overlay0)] font-['Nunito']">
                        {diffData.length} file{diffData.length !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => {
                          if (restoreSelection.size === diffData.length) {
                            setRestoreSelection(new Set());
                          } else {
                            setRestoreSelection(new Set(diffData.map(f => f.path)));
                          }
                        }}
                        className="text-xs text-[var(--ctp-blue)] hover:text-[var(--ctp-text)] font-['Nunito']"
                      >
                        {restoreSelection.size === diffData.length ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>

                    <div className="mb-2 max-h-40 overflow-y-auto">
                      <FileTreeList
                        files={diffData}
                        selected={restoreSelection}
                        onToggle={toggleFileSelection}
                        onClickFile={(f) => setPreviewFile(f)}
                        hoverAction={{ label: 'view', onClick: (f) => setPreviewFile(f) }}
                      />
                    </div>

                    <button
                      onClick={() => setRestoreTarget(snap)}
                      disabled={restoreSelection.size === 0}
                      className="w-full text-xs py-1.5 bg-[var(--ctp-yellow)] text-[var(--ctp-crust)] rounded font-semibold hover:brightness-110 font-['Nunito'] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {restoreSelection.size === diffData.length
                        ? 'Restore all files'
                        : `Restore ${restoreSelection.size} file${restoreSelection.size !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore confirmation dialog */}
      <Dialog
        open={!!restoreTarget}
        mode="confirm"
        title="Restore checkpoint?"
        message={
          restoreSelection.size === diffData?.length
            ? `This will replace all current files with the "${restoreTarget?.description}" checkpoint.`
            : `This will restore ${restoreSelection.size} selected file${restoreSelection.size !== 1 ? 's' : ''} from "${restoreTarget?.description}". Other files won't be affected.`
        }
        confirmLabel={`Restore ${restoreSelection.size} file${restoreSelection.size !== 1 ? 's' : ''}`}
        confirmColor="yellow"
        onConfirm={handleRestore}
        onCancel={() => setRestoreTarget(null)}
      />
    </>
  );
}
