import React, { useState } from 'react';

export default function CommentsPanel({ slug, filePath, comments, onRefresh, username, onClose }) {
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  const fileComments = comments.filter(c => c.filePath === filePath);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await fetch(`/api/projects/${slug}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        text: newComment.trim(),
        author: username,
        lineStart: 1,
        lineEnd: 1,
      }),
    });
    setNewComment('');
    onRefresh();
  };

  const handleReply = async (commentId) => {
    if (!replyText.trim()) return;
    await fetch(`/api/projects/${slug}/comments/${commentId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: replyText.trim(), author: username }),
    });
    setReplyText('');
    setReplyTo(null);
    onRefresh();
  };

  const handleResolve = async (commentId) => {
    await fetch(`/api/projects/${slug}/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: true }),
    });
    onRefresh();
  };

  return (
    <div className="w-72 bg-[var(--ctp-mantle)] border-l border-[var(--ctp-surface0)] flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--ctp-surface0)]">
        <span className="text-xs font-semibold text-[var(--ctp-overlay0)] uppercase tracking-wider font-['Nunito']">Comments</span>
        <button onClick={onClose} className="text-[var(--ctp-overlay0)] hover:text-[var(--ctp-text)] text-sm">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {fileComments.length === 0 && (
          <p className="text-xs text-[var(--ctp-overlay0)] text-center py-4">No comments on this file</p>
        )}
        {fileComments.map(comment => (
          <div
            key={comment._id}
            className={`rounded-md border text-xs ${comment.resolved ? 'border-[var(--ctp-surface0)] opacity-50' : 'border-[var(--ctp-surface1)]'} bg-[var(--ctp-surface0)]/50`}
          >
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[var(--ctp-blue)] font-['Nunito']">{comment.author}</span>
                <span className="text-xs text-[var(--ctp-overlay0)]">
                  {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {comment.lineStart && (
                <div className="text-xs text-[var(--ctp-overlay0)] mb-1 font-['JetBrains_Mono']">
                  L{comment.lineStart}{comment.lineEnd !== comment.lineStart ? `-${comment.lineEnd}` : ''}
                </div>
              )}
              <p className="text-[var(--ctp-text)] whitespace-pre-wrap">{comment.text}</p>
            </div>

            {/* Replies */}
            {comment.replies?.length > 0 && (
              <div className="border-t border-[var(--ctp-surface0)] px-3 py-1 space-y-1">
                {comment.replies.map((reply, i) => (
                  <div key={i} className="py-1">
                    <span className="font-semibold text-[var(--ctp-teal)] font-['Nunito']">{reply.author}</span>
                    <span className="text-[var(--ctp-text)] ml-1">{reply.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {!comment.resolved && (
              <div className="border-t border-[var(--ctp-surface0)] px-3 py-1.5 flex gap-2">
                <button
                  onClick={() => setReplyTo(replyTo === comment._id ? null : comment._id)}
                  className="text-xs text-[var(--ctp-blue)] hover:underline font-['Nunito']"
                >
                  Reply
                </button>
                <button
                  onClick={() => handleResolve(comment._id)}
                  className="text-xs text-[var(--ctp-green)] hover:underline font-['Nunito']"
                >
                  Resolve ✓
                </button>
              </div>
            )}

            {replyTo === comment._id && (
              <div className="border-t border-[var(--ctp-surface0)] p-2">
                <div className="flex gap-1">
                  <input
                    autoFocus
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleReply(comment._id); }}
                    placeholder="Reply..."
                    className="flex-1 bg-[var(--ctp-surface0)] text-[var(--ctp-text)] text-xs px-2 py-1 rounded border border-[var(--ctp-surface1)] focus:border-[var(--ctp-blue)] focus:outline-none font-['Nunito']"
                  />
                  <button
                    onClick={() => handleReply(comment._id)}
                    className="text-xs px-2 py-1 bg-[var(--ctp-blue)] text-[var(--ctp-crust)] rounded font-['Nunito']"
                  >
                    ↵
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* New comment */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-[var(--ctp-surface0)]">
        <div className="flex gap-1">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-[var(--ctp-surface0)] text-[var(--ctp-text)] text-xs px-3 py-2 rounded border border-[var(--ctp-surface1)] focus:border-[var(--ctp-blue)] focus:outline-none font-['Nunito'] placeholder:text-[var(--ctp-overlay0)]"
          />
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="px-3 py-2 bg-[var(--ctp-blue)] text-[var(--ctp-crust)] text-xs rounded font-semibold disabled:opacity-40 font-['Nunito']"
          >
            ↵
          </button>
        </div>
      </form>
    </div>
  );
}
