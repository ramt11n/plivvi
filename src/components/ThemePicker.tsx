import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
export type Theme = 'light' | 'dark' | 'system';
function preferred(): Theme {
  try {
    const value = localStorage.getItem('pocket-theme');
    if (value === 'light' || value === 'dark') return value;
  } catch {}
  return 'system';
}
export function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#151a24' : '#f7f8fa');
}
export default function ThemePicker({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>(preferred);
  useEffect(() => {
    applyTheme(theme);
    const media = matchMedia('(prefers-color-scheme: dark)'),
      update = () => applyTheme(theme);
    const sync = () => setTheme(preferred());
    media.addEventListener('change', update);
    window.addEventListener('pocket-theme-change', sync);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('pocket-theme-change', sync);
      window.removeEventListener('storage', sync);
    };
  }, [theme]);
  return (
    <div
      className={`theme-picker ${compact ? 'compact' : ''}`}
      role="group"
      aria-label="Appearance"
    >
      {[
        { id: 'light', label: 'Light', icon: Sun },
        { id: 'dark', label: 'Dark', icon: Moon },
        { id: 'system', label: 'System', icon: Monitor },
      ].map((t) => (
        <button
          key={t.id}
          onClick={() => {
            try {
              localStorage.setItem('pocket-theme', t.id);
            } catch {}
            setTheme(t.id as Theme);
            window.dispatchEvent(new Event('pocket-theme-change'));
          }}
          aria-pressed={theme === t.id}
          className={theme === t.id ? 'active' : ''}
          title={
            t.id === 'system'
              ? 'Follow your device, including its sunrise/sunset appearance schedule'
              : t.label + ' appearance'
          }
        >
          <t.icon size={16} />
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
