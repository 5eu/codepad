import React, { useState, useRef, useEffect } from 'react';

export default function UsernameModal({ onSubmit }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 bg-[#11111bee] flex items-center justify-center z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--ctp-mantle)] border border-[var(--ctp-surface0)] rounded-lg p-8 w-[340px] shadow-2xl"
      >
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">⚡</div>
          <h2 className="text-xl font-bold text-[var(--ctp-text)] font-['Nunito']">
            CodePad
          </h2>
          <p className="text-sm text-[var(--ctp-overlay1)] mt-1">
            Enter your name to start collaborating
          </p>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name..."
          maxLength={20}
          className="w-full bg-[var(--ctp-surface0)] text-[var(--ctp-text)] px-4 py-3 rounded-md border border-[var(--ctp-surface1)] focus:border-[var(--ctp-blue)] focus:outline-none font-['Nunito'] text-sm placeholder:text-[var(--ctp-overlay0)]"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="w-full mt-4 bg-[var(--ctp-blue)] text-[var(--ctp-crust)] font-semibold py-3 rounded-md hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-['Nunito'] text-sm"
        >
          Join Session
        </button>
      </form>
    </div>
  );
}
