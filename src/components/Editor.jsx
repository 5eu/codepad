import React, { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { yCollab } from 'y-codemirror.next';
import { UndoManager } from 'yjs';
import { getLanguage } from '../lib/constants';
import { catppuccinTheme } from '../lib/theme';

export default function Editor({ ytext, provider, filePath, slug, username }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !ytext || !provider) return;

    const lang = getLanguage(filePath);
    const langExtension = lang === 'cpp' ? cpp() : lang === 'markdown' ? markdown() : [];

    const undoManager = new UndoManager(ytext);

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        // NOTE: Do NOT use CodeMirror's history() here — it conflicts with Yjs UndoManager.
        // yCollab handles undo/redo via Yjs UndoManager, which is CRDT-aware.
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        foldGutter({
          openText: '▾',
          closedText: '▸',
        }),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        langExtension,
        keymap.of([
          // Filter out history keybindings from defaultKeymap — Yjs UndoManager handles them
          ...defaultKeymap.filter(k => !['undo', 'redo'].includes(k.name)),
          ...closeBracketsKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        catppuccinTheme,
        // yCollab binds the Yjs doc to CodeMirror AND handles remote cursors + undo
        yCollab(ytext, provider.awareness, { undoManager }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', monospace" },
          // Remote cursor styling
          '.cm-ySelectionInfo': {
            fontFamily: "'Nunito', sans-serif",
            fontSize: '10px',
            padding: '1px 4px',
            borderRadius: '3px',
            opacity: '0.9',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      undoManager.destroy();
    };
  }, [ytext, provider, filePath]);

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden" />
  );
}
