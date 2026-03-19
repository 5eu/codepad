import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
import cors from 'cors';
import archiver from 'archiver';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { getOrCreateDoc, docs } from './yjs-server.js';
import { Project, File, Snapshot, Comment, Activity } from './models.js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Connect MongoDB
mongoose.connect('mongodb://localhost:27017/syncsketch')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Per-doc awareness + client tracking
const awarenessMap = new Map(); // docName → Awareness
const docClients = new Map();  // docName → Set<ws>

function getAwareness(docName, ydoc) {
  if (!awarenessMap.has(docName)) {
    awarenessMap.set(docName, new awarenessProtocol.Awareness(ydoc));
  }
  return awarenessMap.get(docName);
}

function getClients(docName) {
  if (!docClients.has(docName)) docClients.set(docName, new Set());
  return docClients.get(docName);
}

function broadcast(docName, message, exclude) {
  const clients = getClients(docName);
  clients.forEach(ws => {
    if (ws !== exclude && ws.readyState === 1) {
      ws.send(message);
    }
  });
}

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname.startsWith('/ws/') || pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', async (ws, req) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const parts = pathname.split('/').filter(Boolean);
  const docName = parts[1] || 'default';

  const ydoc = await getOrCreateDoc(docName);
  const awareness = getAwareness(docName, ydoc);
  const clients = getClients(docName);
  clients.add(ws);

  // Update project lastActiveAt
  Project.updateOne({ slug: docName }, { lastActiveAt: new Date() }).catch(() => {});

  // Track which awareness client IDs this WebSocket connection owns
  const ownedClientIds = new Set();

  // Send initial sync step 1
  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeSyncStep1(encoder, ydoc);
    ws.send(encoding.toUint8Array(encoder));
  }

  // Send current awareness states
  {
    const states = awareness.getStates();
    if (states.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(states.keys())));
      ws.send(encoding.toUint8Array(encoder));
    }
  }

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = new Uint8Array(data);
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      if (messageType === MSG_SYNC) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_SYNC);
        const syncType = syncProtocol.readSyncMessage(decoder, encoder, ydoc, null);
        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }
        // If it was a sync step 2 or update, broadcast to others
        if (syncType === 1 || syncType === 2) {
          // Broadcast the original update to other clients
          broadcast(docName, data, ws);
        }
      } else if (messageType === MSG_AWARENESS) {
        const update = decoding.readVarUint8Array(decoder);
        // Track which client IDs this connection sets
        try {
          const decoded = awarenessProtocol.Awareness.prototype
            ? JSON.parse(new TextDecoder().decode(update))
            : null;
        } catch (_) {}
        awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
        // Extract client IDs from the update and track them
        // Awareness updates are encoded as: [numberOfClients, clientID, clock, state, ...]
        try {
          const tmpDecoder = decoding.createDecoder(update);
          const len = decoding.readVarUint(tmpDecoder);
          for (let i = 0; i < len; i++) {
            const clientID = decoding.readVarUint(tmpDecoder);
            ownedClientIds.add(clientID);
            // Skip clock + state
            decoding.readVarUint(tmpDecoder);
            decoding.readVarString(tmpDecoder);
          }
        } catch (_) {}
        // Broadcast awareness to all other clients
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(encoder, update);
        broadcast(docName, encoding.toUint8Array(encoder), ws);
      }
    } catch (e) {
      console.error('WS message error:', e.message);
    }
  });

  // Also broadcast doc updates that originate from server-side operations (e.g. restore)
  const docUpdateHandler = (update, origin) => {
    if (origin === ws) return; // Don't echo back
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const msg = encoding.toUint8Array(encoder);
    clients.forEach(client => {
      if (client.readyState === 1) client.send(msg);
    });
  };
  ydoc.on('update', docUpdateHandler);

  ws.on('close', () => {
    clients.delete(ws);
    ydoc.off('update', docUpdateHandler);
    // Remove awareness states for all client IDs owned by this connection
    if (ownedClientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(awareness, Array.from(ownedClientIds), null);
      // Broadcast the removal to remaining clients
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_AWARENESS);
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(ownedClientIds)));
      broadcast(docName, encoding.toUint8Array(encoder));
    }
  });
});

// ============= REST API =============

// Create/get project
app.post('/api/projects/:slug', async (req, res) => {
  try {
    let project = await Project.findOne({ slug: req.params.slug });
    if (!project) {
      project = await Project.create({ slug: req.params.slug });
    }
    project.lastActiveAt = new Date();
    await project.save();
    res.json(project);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects/:slug', async (req, res) => {
  try {
    const project = await Project.findOne({ slug: req.params.slug });
    if (!project) return res.status(404).json({ error: 'Not found' });
    const files = await File.find({ projectSlug: req.params.slug }).select('path language updatedAt');
    res.json({ ...project.toObject(), files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Comments
app.get('/api/projects/:slug/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ projectSlug: req.params.slug }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:slug/comments', async (req, res) => {
  try {
    const comment = await Comment.create({
      projectSlug: req.params.slug,
      ...req.body,
    });
    // Log activity
    await Activity.create({
      projectSlug: req.params.slug,
      action: 'comment',
      filePath: req.body.filePath,
      author: req.body.author,
      summary: req.body.text?.substring(0, 100),
    });
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:slug/comments/:id/reply', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Not found' });
    comment.replies.push({ text: req.body.text, author: req.body.author, createdAt: new Date() });
    await comment.save();
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/projects/:slug/comments/:id', async (req, res) => {
  try {
    const comment = await Comment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(comment);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Snapshots
app.get('/api/projects/:slug/snapshots', async (req, res) => {
  try {
    const snapshots = await Snapshot.find({ projectSlug: req.params.slug })
      .select('description createdBy createdAt')
      .sort({ createdAt: -1 });
    res.json(snapshots);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:slug/snapshots', async (req, res) => {
  try {
    // Get current files from Yjs doc
    const doc = docs.get(req.params.slug);
    const files = [];
    if (doc) {
      const fileMap = doc.getMap('files');
      fileMap.forEach((ytext, path) => {
        files.push({ path, content: ytext.toString() });
      });
    }
    const snapshot = await Snapshot.create({
      projectSlug: req.params.slug,
      description: req.body.description || 'Manual snapshot',
      files,
      createdBy: req.body.createdBy || 'system',
    });
    // Log activity
    await Activity.create({
      projectSlug: req.params.slug,
      action: 'snapshot',
      author: req.body.createdBy || 'system',
      summary: req.body.description,
    });
    res.json(snapshot);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/projects/:slug/snapshots/:id', async (req, res) => {
  try {
    const snapshot = await Snapshot.findById(req.params.id);
    if (!snapshot) return res.status(404).json({ error: 'Not found' });
    res.json(snapshot);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:slug/snapshots/:id/restore', async (req, res) => {
  try {
    const snapshot = await Snapshot.findById(req.params.id);
    if (!snapshot) return res.status(404).json({ error: 'Not found' });

    // Restore files into Yjs doc
    const doc = docs.get(req.params.slug);
    if (doc) {
      const fileMap = doc.getMap('files');
      doc.transact(() => {
        // Clear existing files
        fileMap.forEach((_, key) => fileMap.delete(key));
        // Restore from snapshot
        snapshot.files.forEach(f => {
          const ytext = new Y.Text();
          ytext.insert(0, f.content);
          fileMap.set(f.path, ytext);
        });
      });
    }

    await Activity.create({
      projectSlug: req.params.slug,
      action: 'restore',
      author: req.body.author || 'system',
      summary: `Restored to: ${snapshot.description}`,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Activity log
app.get('/api/projects/:slug/activity', async (req, res) => {
  try {
    const activities = await Activity.find({ projectSlug: req.params.slug })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(activities);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/projects/:slug/activity', async (req, res) => {
  try {
    const activity = await Activity.create({
      projectSlug: req.params.slug,
      ...req.body,
    });
    res.json(activity);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Export zip (GET = all files, kept for backward compat)
app.get('/api/projects/:slug/export', async (req, res) => {
  try {
    const doc = docs.get(req.params.slug);
    if (!doc) return res.status(404).json({ error: 'Project not found' });

    const fileMap = doc.getMap('files');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment(`${req.params.slug}.zip`);
    archive.pipe(res);

    fileMap.forEach((ytext, filePath) => {
      archive.append(ytext.toString(), { name: filePath });
    });

    const binDir = path.join(UPLOAD_DIR, req.params.slug);
    if (fs.existsSync(binDir)) {
      fs.readdirSync(binDir).forEach(f => {
        const originalPath = f.replace(/__/g, '/');
        archive.file(path.join(binDir, f), { name: originalPath });
      });
    }

    await archive.finalize();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============= Binary file uploads =============
const UPLOAD_DIR = path.resolve('uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_DIR, req.params.slug);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Use the original filename (with subfolder path encoded as __)
      const safeName = (req.body.filePath || file.originalname).replace(/\//g, '__');
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Upload binary file
app.post('/api/projects/:slug/upload', upload.single('file'), async (req, res) => {
  try {
    const filePath = req.body.filePath || req.file.originalname;
    // Log activity
    await Activity.create({
      projectSlug: req.params.slug,
      action: 'upload',
      filePath,
      author: req.body.author || 'anonymous',
      summary: `Uploaded ${filePath}`,
    });
    res.json({ ok: true, filePath, size: req.file.size });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve binary file (inline for PDF/images, download for others)
app.get('/api/projects/:slug/files/*', (req, res) => {
  const filePath = req.params[0];
  const safeName = filePath.replace(/\//g, '__');
  const fullPath = path.join(UPLOAD_DIR, req.params.slug, safeName);
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' };
  if (mimeTypes[ext]) {
    res.setHeader('Content-Type', mimeTypes[ext]);
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(fullPath).pipe(res);
  } else {
    res.download(fullPath, filePath.split('/').pop());
  }
});

// List binary files for a project
app.get('/api/projects/:slug/binary-files', (req, res) => {
  const dir = path.join(UPLOAD_DIR, req.params.slug);
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).map(f => ({
    filePath: f.replace(/__/g, '/'),
    size: fs.statSync(path.join(dir, f)).size,
  }));
  res.json(files);
});

// Rename binary file
app.post('/api/projects/:slug/rename-file', (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath required' });
  const oldSafe = oldPath.replace(/\//g, '__');
  const newSafe = newPath.replace(/\//g, '__');
  const dir = path.join(UPLOAD_DIR, req.params.slug);
  const oldFull = path.join(dir, oldSafe);
  const newFull = path.join(dir, newSafe);
  if (!fs.existsSync(oldFull)) return res.status(404).json({ error: 'File not found' });
  fs.renameSync(oldFull, newFull);
  res.json({ ok: true });
});

// Delete binary file
app.post('/api/projects/:slug/delete-file', (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath required' });
  const safeName = filePath.replace(/\//g, '__');
  const fullPath = path.join(UPLOAD_DIR, req.params.slug, safeName);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  res.json({ ok: true });
});

// Auto-snapshot removed — manual Checkpoint only.
// File content is already auto-persisted to MongoDB via Yjs state (yjs-server.js).

// ============= 30-day cleanup =============
async function cleanupStaleProjects() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    const stale = await Project.find({ lastActiveAt: { $lt: cutoff } });
    for (const proj of stale) {
      const { slug } = proj;
      console.log(`🧹 Cleaning stale project: ${slug}`);
      await File.deleteMany({ projectSlug: slug });
      await Snapshot.deleteMany({ projectSlug: slug });
      await Comment.deleteMany({ projectSlug: slug });
      await Activity.deleteMany({ projectSlug: slug });
      await YjsDoc.deleteOne({ docName: slug });
      // Remove uploaded binary files
      const uploadDir = path.join(UPLOAD_DIR, slug);
      if (fs.existsSync(uploadDir)) {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      }
      await proj.deleteOne();
    }
    if (stale.length > 0) console.log(`🧹 Cleaned ${stale.length} stale projects`);
  } catch (e) {
    console.error('Cleanup error:', e.message);
  }
}
// Run cleanup daily
setInterval(cleanupStaleProjects, 24 * 60 * 60 * 1000);
// Also run once on startup (after a short delay)
setTimeout(cleanupStaleProjects, 10000);

// ============= Export with file selection =============
app.post('/api/projects/:slug/export', async (req, res) => {
  try {
    const doc = docs.get(req.params.slug);
    if (!doc) return res.status(404).json({ error: 'Project not found' });

    const selectedFiles = req.body.files; // array of file paths to include
    const fileMap = doc.getMap('files');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment(`${req.params.slug}.zip`);
    archive.pipe(res);

    fileMap.forEach((ytext, filePath) => {
      if (!selectedFiles || selectedFiles.includes(filePath)) {
        archive.append(ytext.toString(), { name: filePath });
      }
    });

    // Include binary files
    const binDir = path.join(UPLOAD_DIR, req.params.slug);
    if (fs.existsSync(binDir)) {
      fs.readdirSync(binDir).forEach(f => {
        const originalPath = f.replace(/__/g, '/');
        if (!selectedFiles || selectedFiles.includes(originalPath)) {
          archive.file(path.join(binDir, f), { name: originalPath });
        }
      });
    }

    await archive.finalize();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`⚡ CodePad server running on http://localhost:${PORT}`);
});
