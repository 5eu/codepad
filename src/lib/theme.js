import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const catppuccin = {
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  overlay0: '#6c7086',
  overlay1: '#7f849c',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  subtext1: '#bac2de',
  blue: '#89b4fa',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  red: '#f38ba8',
  peach: '#fab387',
  mauve: '#cba6f7',
  teal: '#94e2d5',
  lavender: '#b4befe',
  sky: '#89dcfe',
  pink: '#f5c2e7',
};

const catppuccinHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: catppuccin.mauve },
  { tag: tags.operator, color: catppuccin.sky },
  { tag: tags.special(tags.variableName), color: catppuccin.red },
  { tag: tags.typeName, color: catppuccin.yellow },
  { tag: tags.atom, color: catppuccin.peach },
  { tag: tags.number, color: catppuccin.peach },
  { tag: tags.definition(tags.variableName), color: catppuccin.text },
  { tag: tags.string, color: catppuccin.green },
  { tag: tags.special(tags.string), color: catppuccin.green },
  { tag: tags.comment, color: catppuccin.overlay0, fontStyle: 'italic' },
  { tag: tags.variableName, color: catppuccin.text },
  { tag: tags.bracket, color: catppuccin.subtext1 },
  { tag: tags.tagName, color: catppuccin.blue },
  { tag: tags.attributeName, color: catppuccin.yellow },
  { tag: tags.propertyName, color: catppuccin.blue },
  { tag: tags.className, color: catppuccin.yellow },
  { tag: tags.bool, color: catppuccin.peach },
  { tag: tags.function(tags.variableName), color: catppuccin.blue },
  { tag: tags.function(tags.definition(tags.variableName)), color: catppuccin.blue },
  { tag: tags.macroName, color: catppuccin.teal },
  { tag: tags.processingInstruction, color: catppuccin.mauve },
  { tag: tags.meta, color: catppuccin.mauve },
  { tag: tags.heading, color: catppuccin.blue, fontWeight: 'bold' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
]);

export const catppuccinTheme = [
  EditorView.theme({
    '&': {
      backgroundColor: catppuccin.base,
      color: catppuccin.text,
    },
    '.cm-content': {
      caretColor: catppuccin.text,
      fontFamily: "'JetBrains Mono', monospace",
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: catppuccin.text,
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: catppuccin.surface1 + '80',
    },
    '.cm-gutters': {
      backgroundColor: catppuccin.mantle,
      color: catppuccin.overlay0,
      borderRight: `1px solid ${catppuccin.surface0}`,
    },
    '.cm-activeLineGutter': {
      backgroundColor: catppuccin.surface0,
      color: catppuccin.text,
    },
    '.cm-activeLine': {
      backgroundColor: catppuccin.surface0 + '40',
    },
    '.cm-foldGutter .cm-gutterElement': {
      color: catppuccin.overlay0,
    },
    '.cm-matchingBracket': {
      backgroundColor: catppuccin.surface1,
      outline: `1px solid ${catppuccin.overlay0}`,
    },
    '.cm-searchMatch': {
      backgroundColor: catppuccin.yellow + '30',
    },
    '.cm-selectionMatch': {
      backgroundColor: catppuccin.blue + '20',
    },
    '.cm-tooltip': {
      backgroundColor: catppuccin.surface0,
      border: `1px solid ${catppuccin.surface1}`,
      color: catppuccin.text,
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: catppuccin.surface1,
      },
    },
  }, { dark: true }),
  syntaxHighlighting(catppuccinHighlight),
];
