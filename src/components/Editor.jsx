import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { marked } from 'marked';

// Markdown toolbar actions
const MD_TOOLS = [
  { label: 'B', title: 'Bold', wrap: '**', placeholder: 'bold text' },
  { label: 'I', title: 'Italic', wrap: '*', placeholder: 'italic text' },
  { label: 'H1', title: 'Heading 1', prefix: '# ', placeholder: 'Heading' },
  { label: 'H2', title: 'Heading 2', prefix: '## ', placeholder: 'Heading' },
  { label: '•', title: 'Bullet list', prefix: '- ', placeholder: 'List item' },
  { label: '1.', title: 'Numbered list', prefix: '1. ', placeholder: 'List item' },
  { label: '<>', title: 'Code block', blockWrap: '```', placeholder: 'code' },
  { label: '—', title: 'Horizontal rule', insert: '\n---\n' },
  { label: '🔗', title: 'Link', template: '[link text](url)' },
];

function MarkdownToolbar({ viewRef }) {
  const applyTool = useCallback((tool) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    const selected = view.state.sliceDoc(from, to);

    let insert, cursorPos;

    if (tool.insert) {
      insert = tool.insert;
      cursorPos = from + insert.length;
    } else if (tool.template) {
      insert = tool.template;
      cursorPos = from + insert.length;
    } else if (tool.blockWrap) {
      const content = selected || tool.placeholder;
      insert = `\n${tool.blockWrap}\n${content}\n${tool.blockWrap}\n`;
      cursorPos = from + tool.blockWrap.length + 2;
    } else if (tool.prefix) {
      const content = selected || tool.placeholder;
      // Check if we're at line start
      const line = view.state.doc.lineAt(from);
      const atStart = from === line.from;
      insert = (atStart ? '' : '\n') + tool.prefix + content;
      if (!selected) {
        cursorPos = from + (atStart ? 0 : 1) + tool.prefix.length;
      } else {
        cursorPos = from + insert.length;
      }
    } else if (tool.wrap) {
      const content = selected || tool.placeholder;
      insert = `${tool.wrap}${content}${tool.wrap}`;
      if (!selected) {
        cursorPos = from + tool.wrap.length;
      } else {
        cursorPos = from + insert.length;
      }
    }

    if (insert) {
      view.dispatch({
        changes: { from, to, insert },
        selection: selected ? { anchor: from + insert.length } : { anchor: cursorPos, head: cursorPos + (selected ? 0 : (tool.placeholder || '').length) },
      });
      view.focus();
    }
  }, [viewRef]);

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-[var(--ctp-mantle)] border-b border-[var(--ctp-surface0)]">
      {MD_TOOLS.map((tool, i) => (
        <button
          key={i}
          onClick={() => applyTool(tool)}
          title={tool.title}
          className="px-2 py-0.5 text-xs rounded font-['JetBrains_Mono'] text-[var(--ctp-subtext1)] hover:bg-[var(--ctp-surface0)] hover:text-[var(--ctp-text)] transition-colors cursor-pointer"
        >
          {tool.label}
        </button>
      ))}
    </div>
  );
}

function MarkdownPreview({ content }) {
  const html = marked.parse(content || '', { breaks: true, gfm: true });
  return (
    <div
      className="h-full overflow-auto p-6 prose-invert max-w-none font-['Nunito']"
      style={{
        color: 'var(--ctp-text)',
        fontSize: '15px',
        lineHeight: '1.7',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function Editor({ ytext, provider, filePath, slug, username }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  const [previewContent, setPreviewContent] = useState('');

  const isMarkdown = filePath && (filePath.endsWith('.md') || filePath.endsWith('.MD'));

  // Reset mode when file changes
  useEffect(() => {
    setMode('edit');
  }, [filePath]);

  useEffect(() => {
    if (!containerRef.current || !ytext || !provider) return;
    if (mode === 'preview') return; // Don't create editor in preview mode

    const lang = getLanguage(filePath);
    const langExtension = lang === 'cpp' ? cpp() : lang === 'markdown' ? markdown() : [];

    const undoManager = new UndoManager(ytext);

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
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
          ...defaultKeymap.filter(k => !['undo', 'redo'].includes(k.name)),
          ...closeBracketsKeymap,
          ...searchKeymap,
          indentWithTab,
        ]),
        catppuccinTheme,
        yCollab(ytext, provider.awareness, { undoManager }),
        EditorView.theme({
          '&': { height: '100%' },
          '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', monospace" },
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
  }, [ytext, provider, filePath, mode]);

  // Update preview content when switching to preview
  useEffect(() => {
    if (mode === 'preview' && ytext) {
      setPreviewContent(ytext.toString());
    }
  }, [mode, ytext]);

  return (
    <div className="h-full flex flex-col">
      {isMarkdown && (
        <div className="flex items-center bg-[var(--ctp-mantle)] border-b border-[var(--ctp-surface0)]">
          {mode === 'edit' && <MarkdownToolbar viewRef={viewRef} />}
          <div className="ml-auto flex items-center pr-2">
            <button
              onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
              className={`px-2 py-0.5 text-xs rounded font-['Nunito'] cursor-pointer transition-colors ${
                mode === 'preview'
                  ? 'bg-[var(--ctp-blue)] text-[var(--ctp-base)]'
                  : 'text-[var(--ctp-subtext0)] hover:text-[var(--ctp-text)] hover:bg-[var(--ctp-surface0)]'
              }`}
              title={mode === 'edit' ? 'Preview' : 'Edit'}
            >
              {mode === 'edit' ? '👁 Preview' : '✏️ Edit'}
            </button>
          </div>
        </div>
      )}
      {mode === 'preview' && isMarkdown ? (
        <MarkdownPreview content={previewContent} />
      ) : (
        <div ref={containerRef} className="flex-1 w-full overflow-hidden" />
      )}
    </div>
  );
}
