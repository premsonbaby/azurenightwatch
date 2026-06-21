import { Moon, Sun } from 'lucide-react';

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isDark ? 'Light Mode' : 'Dark Mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex items-center rounded-xl border border-slate-500/30 bg-slate-900/70 p-2.5 text-slate-100 transition hover:bg-slate-800 dark:border-slate-300/20 dark:bg-slate-100/10"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
