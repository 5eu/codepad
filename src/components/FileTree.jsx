import React, { useState, useRef, useCallback } from 'react';
import { getFileIcon, ALLOWED_EXTENSIONS } from '../lib/constants';
import Dialog from './Dialog';

export default function FileTree({ files, activeFile, onSelectFile, onCreateFile, onCreateFolder, onDeleteFile, onRenameFile, onFileDrop, onGetFileContent }) {
  const [newFileName, setNewFileName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, path, name, isFolder?, folderPath? }
  const [renamingFolder, setRenamingFolder] = useState(null); // folderPath being renamed
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [showNew, setShowNew] = useState(false); // false | 'file' | 'folder'
  const [newFileParent, setNewFileParent] = useState(''); // folder path for inline creation
  const [renamingFile, setRenamingFile] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());
  const [dragSource, setDragSource] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState(new Set()); // multi-select
  const [uploadDropTarget, setUploadDropTarget] = useState(null); // folder for external file upload
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  // ===== Create file/folder =====
  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const name = newFileName.trim();
    if (!name) return;
    const prefix = newFileParent ? `${newFileParent}/` : '';
    if (showNew === 'folder') {
      if (onCreateFolder) {
        onCreateFolder(`${prefix}${name}`);
      } else {
        onCreateFile(`${prefix}${name}/.gitkeep`, '');
      }
    } else {
      onCreateFile(`${prefix}${name}`);
    }
    setNewFileName('');
    setShowNew(false);
    setNewFileParent('');
  };

  // ===== Context menu close =====
  React.useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // ===== + menu close =====
  React.useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // ===== Folder rename =====
  const handleFolderRenameSubmit = (e, oldFolderPath) => {
    e.preventDefault();
    const newName = renameFolderValue.trim();
    if (!newName || newName === oldFolderPath.split('/').pop()) {
      setRenamingFolder(null);
      return;
    }
    const parentParts = oldFolderPath.split('/');
    parentParts.pop();
    const parentPrefix = parentParts.length > 0 ? parentParts.join('/') + '/' : '';
    const newFolderPath = `${parentPrefix}${newName}`;
    // Rename all files inside this folder
    files.forEach(filePath => {
      if (filePath.startsWith(oldFolderPath + '/')) {
        const relativePart = filePath.slice(oldFolderPath.length);
        onRenameFile(filePath, `${newFolderPath}${relativePart}`);
      }
    });
    setRenamingFolder(null);
  };

  // ===== Folder delete =====
  const handleDeleteFolder = (folderPath, folderName) => {
    setDeleteTarget({ name: folderName, path: folderPath, isFolder: true });
  };

  const executeDeleteFolder = (folderPath) => {
    files.forEach(filePath => {
      if (filePath.startsWith(folderPath + '/')) {
        onDeleteFile(filePath);
      }
    });
  };

  // ===== Download =====
  const handleDownloadFile = (path, name) => {
    if (!onGetFileContent) return;
    const content = onGetFileContent(path);
    if (content == null) return;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Folder toggle =====
  const toggleFolder = (folderPath) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  // ===== Rename =====
  const handleRenameSubmit = (e, oldPath) => {
    e.preventDefault();
    const newPath = renameValue.trim();
    if (newPath && newPath !== oldPath) {
      onRenameFile(oldPath, newPath);
    }
    setRenamingFile(null);
  };

  // ===== Multi-select =====
  const handleFileClick = (path, e) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedFiles(prev => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    } else {
      setSelectedFiles(new Set());
      onSelectFile(path);
    }
  };

  // ===== External file upload (from OS) =====
  const handleFileUpload = (e) => {
    if (e.target.files.length > 0) {
      onFileDrop(e.target.files);
    }
    e.target.value = '';
  };

  // Check if a drag event carries external files (from OS)
  const isExternalDrag = (e) => {
    return e.dataTransfer.types.includes('Files');
  };

  // ===== Handle external file drop onto folders =====
  const handleExternalDropOnFolder = (e, folderPath) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadDropTarget(null);
    if (e.dataTransfer.files.length > 0 && onFileDrop) {
      // Pass files + folder prefix to App.jsx handler (handles text vs binary routing)
      onFileDrop(e.dataTransfer.files, folderPath);
    }
  };

  // ===== Internal drag (move files/folders) =====
  const handleInternalDrop = (e, targetFolder) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    if (!dragSource) return;

    // Multi-select drag
    const sourcePaths = selectedFiles.size > 1 && selectedFiles.has(dragSource)
      ? Array.from(selectedFiles)
      : [dragSource];

    sourcePaths.forEach(src => {
      if (src.startsWith('__folder__:')) {
        const srcFolder = src.replace('__folder__:', '');
        if (targetFolder && (srcFolder === targetFolder || targetFolder.startsWith(srcFolder + '/'))) return;
        const folderName = srcFolder.split('/').pop();
        const prefix = targetFolder ? `${targetFolder}/${folderName}` : folderName;
        files.forEach(filePath => {
          if (filePath.startsWith(srcFolder + '/')) {
            const relativePart = filePath.slice(srcFolder.length);
            onRenameFile(filePath, `${prefix}${relativePart}`);
          }
        });
      } else {
        const fileName = src.split('/').pop();
        const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
        if (newPath !== src) {
          onRenameFile(src, newPath);
        }
      }
    });

    setDragSource(null);
    setSelectedFiles(new Set());
  };

  // ===== Build tree =====
  const buildTree = (filePaths) => {
    const tree = {};
    filePaths.forEach(path => {
      const parts = path.split('/');
      let current = tree;
      parts.forEach((part, i) => {
        if (i === parts.length - 1) {
          current[part] = { __path: path, __isFile: true };
        } else {
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });
    return tree;
  };

  // ===== Render =====
  const renderTree = (node, depth = 0, parentPath = '') => {
    return Object.entries(node)
      .filter(([key]) => !key.startsWith('__'))
      .sort(([a, aVal], [b, bVal]) => {
        const aIsFile = aVal.__isFile;
        const bIsFile = bVal.__isFile;
        if (aIsFile !== bIsFile) return aIsFile ? 1 : -1;
        return a.localeCompare(b);
      })
      .map(([name, value]) => {
        if (value.__isFile) {
          const path = value.__path;
          if (name === '.gitkeep') return null;
          const isActive = path === activeFile;
          const isSelected = selectedFiles.has(path);

          if (renamingFile === path) {
            return (
              <form key={path} onSubmit={(e) => handleRenameSubmit(e, path)} className="px-2">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => setRenamingFile(null)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setRenamingFile(null); }}
                  className="w-full bg-[var(--ctp-surface0)] text-[var(--ctp-text)] text-xs px-2 py-1 rounded border border-[var(--ctp-blue)] focus:outline-none font-['JetBrains_Mono']"
                  style={{ paddingLeft: `${depth * 12 + 8}px` }}
                />
              </form>
            );
          }

          return (
            <div
              key={path}
              draggable
              onDragStart={(e) => {
                setDragSource(path);
                e.dataTransfer.setData('text/plain', path);
                e.dataTransfer.effectAllowed = 'move';
                // If this file is part of multi-select, drag all
                if (!selectedFiles.has(path)) {
                  setSelectedFiles(new Set([path]));
                }
              }}
              onDragEnd={() => { setDragSource(null); setDropTarget(null); }}
              className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-xs group transition-colors
                ${dragSource === path ? 'opacity-40' : ''}
                ${isSelected ? 'bg-[var(--ctp-blue)]/15 text-[var(--ctp-text)]' : ''}
                ${isActive && !isSelected ? 'bg-[var(--ctp-surface0)] text-[var(--ctp-text)]' : ''}
                ${!isActive && !isSelected ? 'text-[var(--ctp-subtext0)] hover:bg-[var(--ctp-surface0)]/50' : ''}`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={(e) => handleFileClick(path, e)}
              onDoubleClick={() => { setRenamingFile(path); setRenameValue(name); }}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, path, name }); }}
            >
              <span className="text-xs">{getFileIcon(name)}</span>
              <span className="font-['JetBrains_Mono'] truncate flex-1 text-sm">{name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDownloadFile(path, name); }}
                className="opacity-0 group-hover:opacity-100 text-[var(--ctp-overlay0)] hover:text-[var(--ctp-blue)] text-xs transition-opacity"
                title="Download"
              >
                ↓
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget({ name, path }); }}
                className="opacity-0 group-hover:opacity-100 text-[var(--ctp-red)] hover:text-[var(--ctp-red)] text-xs transition-opacity"
                title="Delete"
              >
                ✕
              </button>
            </div>
          );
        }

        // ===== Folder =====
        const folderPath = parentPath ? `${parentPath}/${name}` : name;
        const isCollapsed = collapsedFolders.has(folderPath);
        const isFolderDropTarget = dropTarget === folderPath;
        const isFolderUploadTarget = uploadDropTarget === folderPath;

        // Folder rename mode
        if (renamingFolder === folderPath) {
          return (
            <div key={name}>
              <form onSubmit={(e) => handleFolderRenameSubmit(e, folderPath)} className="px-2 py-0.5" style={{ paddingLeft: `${depth * 12 + 8}px` }}>
                <input
                  autoFocus
                  value={renameFolderValue}
                  onChange={(e) => setRenameFolderValue(e.target.value)}
                  onBlur={() => setRenamingFolder(null)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setRenamingFolder(null); }}
                  className="w-full bg-[var(--ctp-surface0)] text-[var(--ctp-text)] text-xs px-2 py-1 rounded border border-[var(--ctp-blue)] focus:outline-none font-['JetBrains_Mono']"
                />
              </form>
              {!isCollapsed && renderTree(value, depth + 1, folderPath)}
            </div>
          );
        }

        return (
          <div key={name}>
            <div
              data-folder-drop
              draggable
              onDragStart={(e) => {
                setDragSource(`__folder__:${folderPath}`);
                e.dataTransfer.setData('text/plain', `__folder__:${folderPath}`);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => { setDragSource(null); setDropTarget(null); setUploadDropTarget(null); }}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--ctp-subtext0)] cursor-pointer hover:bg-[var(--ctp-surface0)]/50 transition-colors group
                ${dragSource === `__folder__:${folderPath}` ? 'opacity-40' : ''}
                ${isFolderDropTarget || isFolderUploadTarget ? 'bg-[var(--ctp-blue)]/15 ring-1 ring-inset ring-[var(--ctp-blue)]/40 rounded' : ''}`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => toggleFolder(folderPath)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, name, isFolder: true, folderPath }); }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isExternalDrag(e)) {
                  e.dataTransfer.dropEffect = 'copy';
                  setUploadDropTarget(folderPath);
                } else if (dragSource) {
                  e.dataTransfer.dropEffect = 'move';
                  setDropTarget(folderPath);
                }
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                if (dropTarget === folderPath) setDropTarget(null);
                if (uploadDropTarget === folderPath) setUploadDropTarget(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDropTarget(null);
                setUploadDropTarget(null);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !dragSource) {
                  // External file drop (from OS)
                  onFileDrop(e.dataTransfer.files, folderPath);
                } else if (dragSource) {
                  // Internal file/folder move
                  handleInternalDrop(e, folderPath);
                }
              }}
            >
              <span className="text-xs w-3 text-center">{isCollapsed ? '▸' : '▾'}</span>
              <span className="text-xs">📁</span>
              <span className="font-['JetBrains_Mono'] font-semibold text-sm flex-1 truncate">{name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folderPath, name); }}
                className="opacity-0 group-hover:opacity-100 text-[var(--ctp-red)] hover:text-[var(--ctp-red)] text-xs transition-opacity"
                title="Delete folder"
              >
                ✕
              </button>
            </div>

            {/* Inline new file/folder input — appears inside this folder */}
            {showNew && newFileParent === folderPath && (
              <form onSubmit={handleCreateSubmit} className="px-2 py-1" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>
                <input
                  autoFocus
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onBlur={() => { if (!newFileName.trim()) { setShowNew(false); setNewFileParent(''); } }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setShowNew(false); setNewFileParent(''); } }}
                  placeholder={showNew === 'folder' ? 'folder name' : 'filename.ino'}
                  className="w-full bg-[var(--ctp-surface0)] text-[var(--ctp-text)] text-xs px-2 py-1 rounded border border-[var(--ctp-blue)] focus:outline-none font-['JetBrains_Mono'] placeholder:text-[var(--ctp-overlay0)]"
                />
              </form>
            )}

            {!isCollapsed && renderTree(value, depth + 1, folderPath)}
          </div>
        );
      });
  };

  const tree = buildTree(files);

  return (
    <div
      className={`w-52 bg-[var(--ctp-mantle)] border-r border-[var(--ctp-surface0)] flex flex-col shrink-0 overflow-hidden`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ctp-surface0)]">
        <span className="text-xs font-semibold text-[var(--ctp-overlay0)] uppercase tracking-wider font-['Nunito']">Files</span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(s => !s)}
            className="text-[var(--ctp-overlay0)] hover:text-[var(--ctp-blue)] text-sm transition-colors px-1"
            title="Add file or folder"
          >
            +
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-[var(--ctp-surface0)] border border-[var(--ctp-surface1)] rounded-md shadow-lg py-1 z-50 min-w-[140px]">
              <button
                onClick={() => { setShowNew('file'); setNewFileParent(''); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--ctp-text)] hover:bg-[var(--ctp-surface1)] transition-colors font-['Nunito'] flex items-center gap-2"
              >
                <span className="text-xs">📄</span> New File
              </button>
              <button
                onClick={() => { setShowNew('folder'); setNewFileParent(''); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--ctp-text)] hover:bg-[var(--ctp-surface1)] transition-colors font-['Nunito'] flex items-center gap-2"
              >
                <span className="text-xs">📁</span> New Folder
              </button>
              <div className="border-t border-[var(--ctp-surface1)] my-1" />
              <button
                onClick={() => { fileInputRef.current?.click(); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--ctp-text)] hover:bg-[var(--ctp-surface1)] transition-colors font-['Nunito'] flex items-center gap-2"
              >
                <span className="text-xs">📎</span> Upload Files
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".ino,.h,.cpp,.c,.md,.txt,.pdf,.png,.jpg,.jpeg,.gif,.zip"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* File tree area — also accepts external file drops at root */}
      <div
        className={`flex-1 overflow-y-auto py-1 ${uploadDropTarget === '__root__' ? 'ring-2 ring-inset ring-[var(--ctp-blue)]' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          // Only set root target if the event originated from this container directly (not bubbled from a folder)
          if (e.target === e.currentTarget || !e.target.closest('[data-folder-drop]')) {
            if (isExternalDrag(e)) {
              e.dataTransfer.dropEffect = 'copy';
              setUploadDropTarget('__root__');
            } else if (dragSource) {
              e.dataTransfer.dropEffect = 'move';
              setDropTarget(null);
            }
          }
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) setUploadDropTarget(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setUploadDropTarget(null);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && !dragSource) {
            onFileDrop(e.dataTransfer.files);
          } else if (dragSource) {
            handleInternalDrop(e, null);
          }
        }}
      >
        {renderTree(tree)}
      </div>

      {/* Root-level new file/folder input (when no parent folder) */}
      {showNew && newFileParent === '' && (
        <form onSubmit={handleCreateSubmit} className="px-2 pb-2 pt-1 border-t border-[var(--ctp-surface0)]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs">{showNew === 'folder' ? '📁' : '📄'}</span>
            <span className="text-xs text-[var(--ctp-overlay0)] font-['Nunito']">
              New {showNew === 'folder' ? 'folder' : 'file'}
            </span>
          </div>
          <input
            autoFocus
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onBlur={() => { if (!newFileName.trim()) setShowNew(false); }}
            onKeyDown={(e) => { if (e.key === 'Escape') setShowNew(false); }}
            placeholder={showNew === 'folder' ? 'folder name' : 'filename.ino'}
            className="w-full bg-[var(--ctp-surface0)] text-[var(--ctp-text)] text-xs px-2 py-1.5 rounded border border-[var(--ctp-blue)] focus:outline-none font-['JetBrains_Mono'] placeholder:text-[var(--ctp-overlay0)]"
          />
        </form>
      )}

      {/* Empty state */}
      {files.length === 0 && !showNew && (
        <div className="px-3 py-8 text-center text-[var(--ctp-overlay0)] text-xs">
          <p>Drop files here</p>
          <p className="mt-1 text-xs">.ino .h .cpp .c .md .txt</p>
        </div>
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--ctp-surface0)] border border-[var(--ctp-surface1)] rounded-md shadow-lg py-1 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!contextMenu.isFolder && (
            <button
              onClick={() => { handleDownloadFile(contextMenu.path, contextMenu.name); setContextMenu(null); }}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--ctp-text)] hover:bg-[var(--ctp-surface1)] transition-colors font-['Nunito'] flex items-center gap-2"
            >
              ⬇ Download
            </button>
          )}
          {contextMenu.isFolder && (
            <>
              <button
                onClick={() => { setShowNew('file'); setNewFileParent(contextMenu.folderPath); setContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--ctp-text)] hover:bg-[var(--ctp-surface1)] transition-colors font-['Nunito'] flex items-center gap-2"
              >
                📄 New File Here
              </button>
              <button
                onClick={() => { setShowNew('folder'); setNewFileParent(contextMenu.folderPath); setContextMenu(null); }}
                className="w-full text-left px-3 py-1.5 text-xs text-[var(--ctp-text)] hover:bg-[var(--ctp-surface1)] transition-colors font-['Nunito'] flex items-center gap-2"
              >
                📁 New Folder Here
              </button>
              <div className="border-t border-[var(--ctp-surface1)] my-1" />
            </>
          )}
          <button
            onClick={() => {
              if (contextMenu.isFolder) {
                setRenamingFolder(contextMenu.folderPath);
                setRenameFolderValue(contextMenu.name);
              } else {
                setRenamingFile(contextMenu.path);
                setRenameValue(contextMenu.name);
              }
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-[var(--ctp-text)] hover:bg-[var(--ctp-surface1)] transition-colors font-['Nunito'] flex items-center gap-2"
          >
            ✏️ Rename
          </button>
          <div className="border-t border-[var(--ctp-surface1)] my-1" />
          <button
            onClick={() => {
              if (contextMenu.isFolder) {
                handleDeleteFolder(contextMenu.folderPath, contextMenu.name);
              } else {
                setDeleteTarget({ name: contextMenu.name, path: contextMenu.path });
              }
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 text-xs text-[var(--ctp-red)] hover:bg-[var(--ctp-surface1)] transition-colors font-['Nunito'] flex items-center gap-2"
          >
            🗑 Delete
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        mode="confirm"
        title={`Delete ${deleteTarget?.isFolder ? 'folder' : 'file'} "${deleteTarget?.name}"?`}
        message={deleteTarget?.isFolder
          ? 'This folder and all files inside will be removed for all collaborators.'
          : 'This file will be removed for all collaborators.'}
        confirmLabel="Delete"
        confirmColor="red"
        onConfirm={() => {
          if (deleteTarget.isFolder) {
            executeDeleteFolder(deleteTarget.path);
          } else {
            onDeleteFile(deleteTarget.path);
          }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
