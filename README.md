# ⚡ CodePad

**Real-time collaborative code editor for Arduino projects. Zero login. Zero setup.**

🔗 **Live Demo:** [code.b0th.com](https://code.b0th.com)

![CodePad](https://img.shields.io/badge/status-live-brightgreen) ![React](https://img.shields.io/badge/React-18-61dafb) ![License](https://img.shields.io/badge/license-MIT-blue)

## Why?

Our ENGR290 team was passing `.ino` files around on Discord — messy, confusing, and someone always had an outdated version. Git was too much overhead for a 6-person Arduino project. So I built CodePad: open a link, start editing together.

## Features

- **URL = Room** — `code.b0th.com/your-project` creates a shared workspace instantly
- **Real-time Collaboration** — CRDT-based sync (Yjs), multiple cursors with colored indicators
- **C++ Syntax Highlighting** — CodeMirror 6 with Arduino-native support
- **File Tree** — Multi-file projects with folders, drag & drop, upload from desktop
- **Binary File Support** — Upload PDFs, images, zip files with inline preview
- **Version History** — Save named snapshots, selective file restore
- **Comments** — Leave feedback on code for your teammates
- **Export .zip** — Select files and download, ready for Arduino IDE
- **Activity Log** — See who changed what and when
- **Auto Cleanup** — Rooms inactive for 30 days are automatically purged

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Editor | CodeMirror 6 |
| Real-time Sync | Yjs (CRDT) + WebSocket |
| Backend | Express.js |
| Database | MongoDB (Yjs state persistence) |
| Design | Catppuccin Mocha palette, JetBrains Mono + Nunito |

## Architecture

```
Browser ←→ WebSocket ←→ Express Server ←→ MongoDB
                              ↓
                        File uploads → disk
```

- **Yjs CRDT** handles conflict-free real-time sync — no operational transform needed
- **MongoDB** persists Yjs document state, survives server restarts
- **Binary files** (PDF, images) stored on disk, served with correct MIME types for inline preview
- **Awareness protocol** tracks online users and cursor positions per WebSocket connection

## Local Development

```bash
# Prerequisites: Node.js 18+, MongoDB running on localhost:27017

git clone https://github.com/5eu/codepad.git
cd codepad
npm install

# Start dev server (frontend + backend)
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Open `http://localhost:5173/any-room-name` to create a room

## Deployment

```bash
# Build frontend
npx vite build

# Start production server
node server/index.js
```

The server serves the built frontend from `dist/` and handles API + WebSocket on the same port.

For production, use a reverse proxy (Nginx) with WebSocket upgrade support:

```nginx
location /ws {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

## Project Structure

```
├── src/
│   ├── App.jsx              # Main app, Yjs init, file management
│   ├── components/
│   │   ├── Editor.jsx       # CodeMirror 6 + Yjs binding
│   │   ├── FileTree.jsx     # Sidebar file browser
│   │   ├── Header.jsx       # Toolbar + export dialog
│   │   ├── CommentsPanel.jsx
│   │   ├── SnapshotsPanel.jsx
│   │   ├── ActivityPanel.jsx
│   │   ├── FileTreeList.jsx # Reusable tree view component
│   │   └── Dialog.jsx       # Custom modal component
│   ├── lib/constants.js     # File types, icons, username generator
│   └── styles/index.css     # Catppuccin theme + CodeMirror overrides
├── server/
│   ├── index.js             # Express + WebSocket + REST API
│   ├── yjs-server.js        # Yjs doc management + MongoDB persistence
│   └── models.js            # Mongoose schemas
└── index.html
```

## License

MIT
