import React, { useState, useEffect, useRef } from 'react';

/**
 * Reusable dialog component matching Catppuccin Mocha theme.
 * 
 * Modes:
 * - confirm: title + message + Cancel/Confirm buttons
 * - prompt: title + message + text input + Cancel/Submit buttons
 */
export default function Dialog({ open, mode = 'confirm', title, message, placeholder, defaultValue = '', confirmLabel = 'Confirm', confirmColor = 'blue', onConfirm, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (mode === 'prompt') {
      onConfirm(value.trim());
    } else {
      onConfirm();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onCancel();
  };

  const colorMap = {
    blue: 'bg-[var(--ctp-blue)]',
    red: 'bg-[var(--ctp-red)]',
    yellow: 'bg-[var(--ctp-yellow)]',
    green: 'bg-[var(--ctp-green)]',
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        className="bg-[var(--ctp-mantle)] border border-[var(--ctp-surface1)] rounded-lg p-5 w-[340px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h3 className="text-sm font-bold text-[var(--ctp-text)] font-['Nunito'] mb-1">
            {title}
          </h3>
        )}
        {message && (
          <p className="text-xs text-[var(--ctp-subtext0)] font-['Nunito'] mb-3 leading-relaxed">
            {message}
          </p>
        )}

        {mode === 'prompt' && (
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
              placeholder={placeholder}
              maxLength={60}
              className="w-full bg-[var(--ctp-surface0)] text-[var(--ctp-text)] px-3 py-2 rounded-md border border-[var(--ctp-surface1)] focus:border-[var(--ctp-blue)] focus:outline-none font-['JetBrains_Mono'] text-xs placeholder:text-[var(--ctp-overlay0)]"
            />
          </form>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded-md text-[var(--ctp-subtext0)] hover:bg-[var(--ctp-surface0)] transition-colors font-['Nunito'] font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className={`px-3 py-1.5 text-xs rounded-md text-[var(--ctp-crust)] font-semibold hover:brightness-110 transition-all font-['Nunito'] ${colorMap[confirmColor] || colorMap.blue}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
