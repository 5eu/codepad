import * as Y from 'yjs';
import { YjsDoc } from './models.js';

// In-memory doc store (same interface as y-websocket's `docs`)
export const docs = new Map();

// Debounce timers for persistence
const saveTimers = new Map();
const SAVE_DELAY = 2000; // 2 seconds after last edit

/**
 * Load a Yjs doc from MongoDB, or create a new one.
 */
export async function getOrCreateDoc(docName) {
  if (docs.has(docName)) return docs.get(docName);

  const ydoc = new Y.Doc();
  docs.set(docName, ydoc);

  // Try to load persisted state
  try {
    const stored = await YjsDoc.findOne({ docName });
    if (stored && stored.state) {
      Y.applyUpdate(ydoc, new Uint8Array(stored.state));
      console.log(`📂 Loaded doc "${docName}" from DB`);
    }
  } catch (e) {
    console.error(`Failed to load doc "${docName}":`, e.message);
  }

  // Auto-save on every update (debounced)
  ydoc.on('update', () => {
    scheduleSave(docName, ydoc);
  });

  return ydoc;
}

/**
 * Debounced save — writes Yjs state to MongoDB 2s after last edit.
 */
function scheduleSave(docName, ydoc) {
  if (saveTimers.has(docName)) clearTimeout(saveTimers.get(docName));
  saveTimers.set(docName, setTimeout(async () => {
    try {
      const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
      await YjsDoc.findOneAndUpdate(
        { docName },
        { state, updatedAt: new Date() },
        { upsert: true },
      );
    } catch (e) {
      console.error(`Failed to save doc "${docName}":`, e.message);
    }
  }, SAVE_DELAY));
}

// Compatibility alias
export const getYDoc = getOrCreateDoc;
