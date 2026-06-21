import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'Open command palette / search' },
  { keys: ['R'], description: 'Refresh current dashboard data' },
  { keys: ['?'], description: 'Show this keyboard shortcuts reference' },
  { keys: ['Esc'], description: 'Close any open overlay' },
  { keys: ['Alt', '←'], description: 'Go back' },
];

interface KeyboardShortcutsProps {
  onRefresh: () => void;
  onOpenPalette: () => void;
}

export function useGlobalKeyboardShortcuts({ onRefresh, onOpenPalette }: KeyboardShortcutsProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isTyping) return;

      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }

      if (e.key === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onRefresh();
      }

      if (e.key === 'Escape') {
        setHelpOpen(false);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onRefresh, onOpenPalette]);

  return { helpOpen, setHelpOpen };
}

export function KeyboardShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-100 uppercase tracking-widest">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <ul className="space-y-3">
          {SHORTCUTS.map((s) => (
            <li key={s.description} className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                    {k}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs text-slate-600">Press <kbd className="border border-slate-700 rounded px-1">?</kbd> to toggle this panel</p>
      </div>
    </div>,
    document.body
  );
}
