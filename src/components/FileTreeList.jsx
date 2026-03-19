import React, { useState } from 'react';
import { getFileIcon } from '../lib/constants';

/**
 * Displays a list of file paths as a collapsible tree structure.
 * Used by SnapshotsPanel and Export dialog.
 *
 * Props:
 *  - files: array of { path, content? } or just string paths
 *  - selected: Set of selected paths (optional)
 *  - onToggle: (path) => void — checkbox toggle (optional, hides checkboxes if not provided)
 *  - onClickFile: (file) => void — click on file name (optional)
 *  - hoverAction: { label, onClick } — hover button per file (optional)
 *  - className: extra class on root div
 */
export default function FileTreeList({ files, selected, onToggle, onClickFile, hoverAction, className = '' }) {
  const [collapsed, setCollapsed] = useState(new Set());

  // Normalize to objects
  const fileObjs = (files || []).map(f => typeof f === 'string' ? { path: f } : f);

  // Build tree
  const tree = {};
  fileObjs.forEach(f => {
    const parts = f.path.split('/');
    let node = tree;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node[part] = { __file: f, __isFile: true };
      } else {
        if (!node[part]) node[part] = {};
        node = node[part];
      }
    });
  });

  const toggleCollapse = (folderPath) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  // Check if all files under a folder are selected
  const getFolderFiles = (folderPath) => {
    return fileObjs.filter(f => f.path.startsWith(folderPath + '/'));
  };

  const renderNode = (node, depth = 0, parentPath = '') => {
    return Object.entries(node)
      .filter(([key]) => !key.startsWith('__'))
      .sort(([a, aVal], [b, bVal]) => {
        const aIsFile = !!aVal.__isFile;
        const bIsFile = !!bVal.__isFile;
        if (aIsFile !== bIsFile) return aIsFile ? 1 : -1;
        return a.localeCompare(b);
      })
      .map(([name, value]) => {
        if (value.__isFile) {
          const f = value.__file;
          const isChecked = selected?.has(f.path);
          return (
            <div
              key={f.path}
              className="flex items-center gap-1.5 py-0.5 group"
              style={{ paddingLeft: `${depth * 14 + 4}px` }}
            >
              {onToggle && (
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggle(f.path)}
                  className="w-3 h-3 rounded accent-[var(--ctp-blue)] shrink-0"
                />
              )}
              <span className="text-xs">{getFileIcon(name)}</span>
              <span
                className={`text-xs font-['JetBrains_Mono'] truncate flex-1 ${onClickFile ? 'cursor-pointer hover:text-[var(--ctp-blue)]' : ''} text-[var(--ctp-subtext0)]`}
                onClick={() => onClickFile && onClickFile(f)}
                title={f.path}
              >
                {name}
              </span>
              {hoverAction && (
                <button
                  onClick={() => hoverAction.onClick(f)}
                  className="text-xs text-[var(--ctp-overlay0)] opacity-0 group-hover:opacity-100 hover:text-[var(--ctp-blue)] transition-opacity font-['Nunito']"
                >
                  {hoverAction.label}
                </button>
              )}
            </div>
          );
        }

        // Folder
        const folderPath = parentPath ? `${parentPath}/${name}` : name;
        const isCollapsed = collapsed.has(folderPath);
        const folderFiles = getFolderFiles(folderPath);
        const allChecked = selected && folderFiles.length > 0 && folderFiles.every(f => selected.has(f.path));
        const someChecked = selected && folderFiles.some(f => selected.has(f.path));

        return (
          <div key={folderPath}>
            <div
              className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-[var(--ctp-surface0)]/30 rounded transition-colors"
              style={{ paddingLeft: `${depth * 14 + 4}px` }}
              onClick={() => toggleCollapse(folderPath)}
            >
              {onToggle && (
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={() => {
                    folderFiles.forEach(f => {
                      if (allChecked) {
                        if (selected.has(f.path)) onToggle(f.path);
                      } else {
                        if (!selected.has(f.path)) onToggle(f.path);
                      }
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-3 h-3 rounded accent-[var(--ctp-blue)] shrink-0"
                />
              )}
              <span className="text-xs w-3 text-center text-[var(--ctp-overlay0)]">{isCollapsed ? '▸' : '▾'}</span>
              <span className="text-xs">📁</span>
              <span className="text-xs font-semibold text-[var(--ctp-subtext0)] font-['JetBrains_Mono']">{name}</span>
              <span className="text-xs text-[var(--ctp-overlay0)] ml-1">{folderFiles.length}</span>
            </div>
            {!isCollapsed && renderNode(value, depth + 1, folderPath)}
          </div>
        );
      });
  };

  return (
    <div className={`space-y-0 ${className}`}>
      {renderNode(tree)}
    </div>
  );
}
