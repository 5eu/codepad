export const CURSOR_COLORS = [
  { color: '#f38ba8', light: '#f38ba830' },
  { color: '#89b4fa', light: '#89b4fa30' },
  { color: '#a6e3a1', light: '#a6e3a130' },
  { color: '#fab387', light: '#fab38730' },
  { color: '#cba6f7', light: '#cba6f730' },
  { color: '#94e2d5', light: '#94e2d530' },
];

export const FILE_ICONS = {
  '.ino': '⚡',
  '.cpp': '⚙️',
  '.c': '⚙️',
  '.h': '📎',
  '.md': '📝',
  '.txt': '📄',
  '.pdf': '📕',
  '.png': '🖼️',
  '.jpg': '🖼️',
  '.jpeg': '🖼️',
  '.gif': '🖼️',
  '.zip': '📦',
};

export const TEXT_EXTENSIONS = ['.ino', '.h', '.cpp', '.c', '.md', '.txt'];
export const BINARY_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.zip'];
export const ALLOWED_EXTENSIONS = [...TEXT_EXTENSIONS, ...BINARY_EXTENSIONS];

export const getFileIcon = (filename) => {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📄';
};

export const getLanguage = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  if (['ino', 'cpp', 'c', 'h'].includes(ext)) return 'cpp';
  if (ext === 'md') return 'markdown';
  return 'text';
};

const ADJECTIVES = [
  'Swift', 'Brave', 'Calm', 'Sharp', 'Bold', 'Keen', 'Warm', 'Cool',
  'Quick', 'Bright', 'Lucky', 'Fuzzy', 'Tiny', 'Mega', 'Chill', 'Nimble',
  'Witty', 'Zen', 'Jolly', 'Snappy', 'Turbo', 'Pixel', 'Cosmic', 'Neon',
];
const ANIMALS = [
  'Panda', 'Fox', 'Owl', 'Cat', 'Wolf', 'Bear', 'Hawk', 'Deer',
  'Otter', 'Lynx', 'Raven', 'Cobra', 'Tiger', 'Dolphin', 'Falcon', 'Koala',
  'Penguin', 'Rabbit', 'Badger', 'Parrot', 'Gecko', 'Moose', 'Seal', 'Crane',
];

export const generateUsername = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj}${animal}`;
};

export const getOrCreateUsername = () => {
  const KEY = 'codepad-username';
  const stored = localStorage.getItem(KEY);
  if (stored) return stored;
  const name = generateUsername();
  localStorage.setItem(KEY, name);
  return name;
};
