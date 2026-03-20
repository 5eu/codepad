import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Header from './components/Header';
import FileTree from './components/FileTree';
import Editor from './components/Editor';
import CommentsPanel from './components/CommentsPanel';
import SnapshotsPanel from './components/SnapshotsPanel';
import ActivityPanel from './components/ActivityPanel';
import { TEXT_EXTENSIONS, BINARY_EXTENSIONS } from './lib/constants';
// UsernameModal removed — auto-assign random names
import { CURSOR_COLORS, getOrCreateUsername } from './lib/constants';

export default function App() {
  const { slug } = useParams();
  const [username, setUsername] = useState(() => getOrCreateUsername());
  const providerRef = useRef(null);

  const handleRenameUser = useCallback((newName) => {
    localStorage.setItem('codepad-username', newName);
    setUsername(newName);
    // Update Yjs awareness
    if (providerRef.current) {
      const state = providerRef.current.awareness.getLocalState();
      const user = state?.user || {};
      providerRef.current.awareness.setLocalStateField('user', { ...user, name: newName });
    }
  }, []);
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);
  const [files, setFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [synced, setSynced] = useState(false);
  const [binaryFiles, setBinaryFiles] = useState([]); // [{filePath, size}]
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanel, setRightPanel] = useState(null); // 'comments' | 'snapshots' | 'activity' | null
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [comments, setComments] = useState([]);
  const fileMapRef = useRef(null);

  // Initialize Yjs
  useEffect(() => {

    const doc = new Y.Doc();
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
    const ws = new WebsocketProvider(wsUrl, slug, doc);

    // Set awareness info
    const colorIndex = Math.floor(Math.random() * CURSOR_COLORS.length);
    ws.awareness.setLocalStateField('user', {
      name: username,
      color: CURSOR_COLORS[colorIndex].color,
      colorLight: CURSOR_COLORS[colorIndex].light,
    });

    // Track online users
    const updateUsers = () => {
      const states = ws.awareness.getStates();
      const users = [];
      states.forEach((state, clientId) => {
        if (state.user) {
          users.push({ clientId, ...state.user });
        }
      });
      setOnlineUsers(users);
    };
    ws.awareness.on('change', updateUsers);
    updateUsers();

    // File map (Y.Map of Y.Text objects)
    const fileMap = doc.getMap('files');
    fileMapRef.current = fileMap;

    const updateFiles = () => {
      const fileList = [];
      fileMap.forEach((value, key) => {
        fileList.push(key);
      });
      fileList.sort();
      setFiles(fileList);
      // Don't auto-select any file — show welcome screen by default
    };
    fileMap.observe(updateFiles);
    updateFiles();

    // Wait for initial sync before showing UI
    const onSync = (isSynced) => {
      if (isSynced) {
        // Only create default file if this is a truly empty project (after sync)
        if (fileMap.size === 0) {
          const defaultText = new Y.Text();
          defaultText.insert(0, `// ${slug} - Arduino Project
#include <Arduino.h>

void setup() {
  Serial.begin(9600);
  // Initialize your components here
}

void loop() {
  // Main loop code
}
`);
          fileMap.set('main.ino', defaultText);
        }
        updateFiles();
        setSynced(true);
      }
    };
    ws.on('sync', onSync);
    // If already synced (rare but possible)
    if (ws.synced) onSync(true);

    setYdoc(doc);
    setProvider(ws);
    providerRef.current = ws;

    // Register project on server
    fetch(`/api/projects/${slug}`, { method: 'POST' }).catch(() => {});

    return () => {
      ws.off('sync', onSync);
      ws.awareness.off('change', updateUsers);
      ws.destroy();
      doc.destroy();
    };
  }, [slug]);

  // Load comments
  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/comments`);
      if (res.ok) setComments(await res.json());
    } catch (e) { /* ignore */ }
  }, [slug]);

  useEffect(() => {
    loadComments();
    const interval = setInterval(loadComments, 10000);
    return () => clearInterval(interval);
  }, [loadComments]);

  // Load binary files list
  const loadBinaryFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/binary-files`);
      if (res.ok) setBinaryFiles(await res.json());
    } catch (_) {}
  }, [slug]);

  useEffect(() => { loadBinaryFiles(); }, [loadBinaryFiles]);

  // Upload binary file
  const uploadBinaryFile = useCallback(async (file, targetPath) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filePath', targetPath);
    formData.append('author', username);
    try {
      const res = await fetch(`/api/projects/${slug}/upload`, { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        // Immediately add to state so it shows up without waiting for refetch
        setBinaryFiles(prev => {
          if (prev.some(b => b.filePath === targetPath)) return prev;
          return [...prev, { filePath: targetPath, size: data.size || file.size }];
        });
      }
    } catch (_) {}
  }, [slug, username]);

  const handleCreateFile = useCallback((path, content = '', silent = false) => {
    if (!ydoc || !fileMapRef.current) return;
    const fileMap = fileMapRef.current;
    if (!fileMap.has(path)) {
      const ytext = new Y.Text();
      if (content) ytext.insert(0, content);
      fileMap.set(path, ytext);
      // Don't auto-select newly created files
      // Only log activity for user-initiated file creation, not moves/gitkeep
      if (!silent && !path.endsWith('.gitkeep')) {
        fetch(`/api/projects/${slug}/activity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', filePath: path, author: username }),
        }).catch(() => {});
      }
    }
  }, [ydoc, slug, username]);

  const handleDeleteFile = useCallback((path) => {
    const ext = '.' + path.split('.').pop().toLowerCase();
    if (BINARY_EXTENSIONS.includes(ext)) {
      // Delete from server
      fetch(`/api/projects/${slug}/delete-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path }),
      }).then(() => loadBinaryFiles()).catch(() => {});
      if (activeFile === path) setActiveFile(null);
    } else {
      if (!fileMapRef.current) return;
      fileMapRef.current.delete(path);
    }
    fetch(`/api/projects/${slug}/activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', filePath: path, author: username }),
    }).catch(() => {});
  }, [slug, username, activeFile, loadBinaryFiles]);

  const handleRenameFile = useCallback((oldPath, newPath) => {
    // Check if it's a binary file
    const ext = '.' + oldPath.split('.').pop().toLowerCase();
    if (BINARY_EXTENSIONS.includes(ext)) {
      // Rename on server
      fetch(`/api/projects/${slug}/rename-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath, newPath }),
      }).then(() => loadBinaryFiles()).catch(() => {});
      if (activeFile === oldPath) setActiveFile(newPath);
      return;
    }
    if (!fileMapRef.current || !ydoc) return;
    const fileMap = fileMapRef.current;
    const oldText = fileMap.get(oldPath);
    if (oldText) {
      const content = oldText.toString();
      const newText = new Y.Text();
      newText.insert(0, content);
      fileMap.set(newPath, newText);
      fileMap.delete(oldPath);
      if (activeFile === oldPath) setActiveFile(newPath);
    }
  }, [ydoc, activeFile, slug, loadBinaryFiles]);

  const getFileContent = useCallback((path) => {
    if (!fileMapRef.current) return null;
    const ytext = fileMapRef.current.get(path);
    return ytext ? ytext.toString() : null;
  }, []);

  // Drag & drop upload (text → Yjs, binary → server)
  const handleFileDrop = useCallback((droppedFiles, folderPrefix = '') => {
    Array.from(droppedFiles).forEach(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const targetPath = folderPrefix ? `${folderPrefix}/${file.name}` : file.name;
      if (TEXT_EXTENSIONS.includes(ext)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          handleCreateFile(targetPath, e.target.result);
        };
        reader.readAsText(file);
      } else if (BINARY_EXTENSIONS.includes(ext)) {
        // Upload binary directly (avoid stale closure)
        const formData = new FormData();
        formData.append('file', file);
        formData.append('filePath', targetPath);
        formData.append('author', username);
        fetch(`/api/projects/${slug}/upload`, { method: 'POST', body: formData })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              setBinaryFiles(prev => {
                if (prev.some(b => b.filePath === targetPath)) return prev;
                return [...prev, { filePath: targetPath, size: data.size || file.size }];
              });
            }
          })
          .catch(() => {});
      }
    });
  }, [handleCreateFile, slug, username]);

  // Merge text files (Yjs) + binary files (server) into one list
  const allFiles = [...files, ...binaryFiles.map(b => b.filePath)];
  const binarySet = new Set(binaryFiles.map(b => b.filePath));

  const handleSelectFile = useCallback((filePath) => {
    setActiveFile(filePath);
  }, []);

  const activeYText = activeFile && fileMapRef.current ? fileMapRef.current.get(activeFile) : null;

  // Show loading until initial sync completes
  if (!synced) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--ctp-base)]">
        <div className="text-center">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-sm text-[var(--ctp-overlay1)] font-['Nunito']">Connecting...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        slug={slug}
        onlineUsers={onlineUsers}
        onToggleSidebar={() => setSidebarOpen(s => !s)}
        sidebarOpen={sidebarOpen}
        rightPanel={rightPanel}
        onSetRightPanel={setRightPanel}
        username={username}
        onRenameUser={handleRenameUser}
        allFiles={allFiles}
        onDeselectFile={() => setActiveFile(null)}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* File Tree */}
        {sidebarOpen && (
          <FileTree
            files={allFiles}
            activeFile={activeFile}
            onSelectFile={handleSelectFile}
            onCreateFile={handleCreateFile}
            onDeleteFile={handleDeleteFile}
            onRenameFile={handleRenameFile}
            onFileDrop={handleFileDrop}
            onGetFileContent={getFileContent}
          />
        )}

        {/* Editor / Binary Preview */}
        <div className="flex-1 overflow-hidden">
          {activeFile && binarySet.has(activeFile) ? (
            // Binary file preview
            (() => {
              const ext = '.' + activeFile.split('.').pop().toLowerCase();
              const fileUrl = `/api/projects/${slug}/files/${activeFile.split('/').map(s => encodeURIComponent(s)).join('/')}`;
              const fileName = activeFile.split('/').pop();
              if (ext === '.pdf') {
                return (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--ctp-mantle)] border-b border-[var(--ctp-surface0)]">
                      <span className="text-xs text-[var(--ctp-subtext0)] font-['JetBrains_Mono']">📕 {activeFile}</span>
                      <a href={fileUrl} download={fileName} className="text-xs text-[var(--ctp-blue)] hover:underline font-['Nunito']">↓ Download</a>
                    </div>
                    <iframe src={fileUrl} className="flex-1 w-full bg-white" title={fileName} />
                  </div>
                );
              } else if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
                return (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-[var(--ctp-mantle)] border-b border-[var(--ctp-surface0)]">
                      <span className="text-xs text-[var(--ctp-subtext0)] font-['JetBrains_Mono']">🖼️ {activeFile}</span>
                      <a href={fileUrl} download={fileName} className="text-xs text-[var(--ctp-blue)] hover:underline font-['Nunito']">↓ Download</a>
                    </div>
                    <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[var(--ctp-crust)]">
                      <img src={fileUrl} alt={fileName} className="max-w-full max-h-full object-contain rounded shadow-lg" />
                    </div>
                  </div>
                );
              } else {
                return (
                  <div className="h-full flex flex-col items-center justify-center text-[var(--ctp-overlay0)]">
                    <span className="text-3xl mb-2">📦</span>
                    <p className="font-['Nunito'] text-sm mb-2">{fileName}</p>
                    <a href={fileUrl} download={fileName} className="text-xs text-[var(--ctp-blue)] hover:underline font-['Nunito'] px-3 py-1.5 bg-[var(--ctp-surface0)] rounded">↓ Download</a>
                  </div>
                );
              }
            })()
          ) : activeYText && provider ? (
            <Editor
              key={activeFile}
              ytext={activeYText}
              provider={provider}
              filePath={activeFile}
              slug={slug}
              username={username}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--ctp-overlay0)]">
              <div className="max-w-sm text-center">
                <div className="text-3xl mb-3">⚡</div>
                <h2 className="text-lg font-bold text-[var(--ctp-text)] font-['Nunito'] mb-1">CodePad</h2>
                <p className="text-xs text-[var(--ctp-subtext0)] mb-6 font-['Nunito']">
                  Share this link with your team — anyone with the URL can edit together.
                </p>
                <div className="text-left space-y-3 text-xs font-['Nunito']">
                  <div className="flex items-start gap-3">
                    <span className="text-sm shrink-0">📄</span>
                    <div>
                      <span className="text-[var(--ctp-text)] font-medium">Create files</span>
                      <span className="text-[var(--ctp-overlay1)]"> — click <span className="font-['JetBrains_Mono'] text-[var(--ctp-blue)]">+</span> in the sidebar</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm shrink-0">📁</span>
                    <div>
                      <span className="text-[var(--ctp-text)] font-medium">Upload from computer</span>
                      <span className="text-[var(--ctp-overlay1)]"> — drag files into the sidebar</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm shrink-0">💬</span>
                    <div>
                      <span className="text-[var(--ctp-text)] font-medium">Leave comments</span>
                      <span className="text-[var(--ctp-overlay1)]"> — click Comments in the toolbar</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm shrink-0">💾</span>
                    <div>
                      <span className="text-[var(--ctp-text)] font-medium">Save a version</span>
                      <span className="text-[var(--ctp-overlay1)]"> — click Save in the toolbar</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm shrink-0">📦</span>
                    <div>
                      <span className="text-[var(--ctp-text)] font-medium">Export .zip</span>
                      <span className="text-[var(--ctp-overlay1)]"> — select files and download</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-4 border-t border-[var(--ctp-surface0)]">
                  <p className="text-[10px] text-[var(--ctp-overlay0)]">
                    Supports .ino .cpp .h .c .md .txt .pdf .png .jpg .gif .zip
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        {rightPanel === 'comments' && (
          <CommentsPanel
            slug={slug}
            filePath={activeFile}
            comments={comments}
            onRefresh={loadComments}
            username={username}
            onClose={() => setRightPanel(null)}
          />
        )}
        {rightPanel === 'snapshots' && (
          <SnapshotsPanel
            slug={slug}
            username={username}
            fileMapRef={fileMapRef}
            ydoc={ydoc}
            onClose={() => setRightPanel(null)}
          />
        )}
        {rightPanel === 'activity' && (
          <ActivityPanel
            slug={slug}
            onClose={() => setRightPanel(null)}
          />
        )}
      </div>
    </div>
  );
}
