import mongoose from 'mongoose';

const ProjectSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
});

const FileSchema = new mongoose.Schema({
  projectSlug: { type: String, required: true, index: true },
  path: { type: String, required: true },
  content: { type: String, default: '' },
  language: { type: String, default: 'cpp' },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String },
});

const SnapshotSchema = new mongoose.Schema({
  projectSlug: { type: String, required: true, index: true },
  description: { type: String, default: 'Manual snapshot' },
  files: [{ path: String, content: String }],
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String, default: 'system' },
});

const CommentSchema = new mongoose.Schema({
  projectSlug: { type: String, required: true, index: true },
  filePath: { type: String, required: true },
  lineStart: { type: Number },
  lineEnd: { type: Number },
  text: { type: String, required: true },
  author: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  replies: [{
    text: String,
    author: String,
    createdAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
});

const ActivitySchema = new mongoose.Schema({
  projectSlug: { type: String, required: true, index: true },
  action: { type: String, required: true },
  filePath: { type: String },
  author: { type: String },
  summary: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Stores Yjs binary doc state — survives server restart
const YjsDocSchema = new mongoose.Schema({
  docName: { type: String, required: true, unique: true, index: true },
  state: { type: Buffer, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const YjsDoc = mongoose.model('YjsDoc', YjsDocSchema);
export const Project = mongoose.model('Project', ProjectSchema);
export const File = mongoose.model('File', FileSchema);
export const Snapshot = mongoose.model('Snapshot', SnapshotSchema);
export const Comment = mongoose.model('Comment', CommentSchema);
export const Activity = mongoose.model('Activity', ActivitySchema);
