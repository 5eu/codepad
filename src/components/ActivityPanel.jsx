import React, { useState, useEffect, useCallback } from 'react';

const ACTION_ICONS = {
  edit: '✏️',
  create: '📄',
  delete: '🗑️',
  snapshot: '📸',
  restore: '⏪',
  upload: '↑',
};

export default function ActivityPanel({ slug, onClose }) {
  const [activities, setActivities] = useState([]);

  const loadActivities = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${slug}/activity`);
      if (res.ok) setActivities(await res.json());
    } catch (e) { /* ignore */ }
  }, [slug]);

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 15000);
    return () => clearInterval(interval);
  }, [loadActivities]);

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-72 bg-[var(--ctp-mantle)] border-l border-[var(--ctp-surface0)] flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ctp-surface0)]">
        <span className="text-xs font-semibold text-[var(--ctp-overlay0)] uppercase tracking-wider font-['Nunito']">Activity</span>
        <button onClick={onClose} className="text-[var(--ctp-overlay0)] hover:text-[var(--ctp-text)] text-sm">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activities.length === 0 && (
          <p className="text-xs text-[var(--ctp-overlay0)] text-center py-4">No activity yet</p>
        )}
        {activities.map((act, i) => (
          <div
            key={act._id || i}
            className="px-3 py-2 border-b border-[var(--ctp-surface0)]/50 text-xs hover:bg-[var(--ctp-surface0)]/20"
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs">{ACTION_ICONS[act.action] || '•'}</span>
              <span className="font-semibold text-[var(--ctp-blue)] font-['Nunito']">{act.author}</span>
              <span className="text-[var(--ctp-overlay0)]">{act.action}</span>
            </div>
            {act.filePath && (
              <div className="text-[var(--ctp-subtext0)] font-['JetBrains_Mono'] text-xs truncate ml-5">
                {act.filePath}
              </div>
            )}
            {act.summary && (
              <div className="text-[var(--ctp-overlay1)] text-xs ml-5 truncate">{act.summary}</div>
            )}
            <div className="text-xs text-[var(--ctp-overlay0)] ml-5 mt-0.5">{formatTime(act.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
