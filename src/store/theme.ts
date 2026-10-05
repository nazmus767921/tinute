import { create } from 'zustand';

export type ThemePreference = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeState {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
  initTheme: () => () => void;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveEffectiveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') {
    return getSystemTheme();
  }
  return pref;
}

function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;

  // Suppress transitions temporarily to prevent whole-page color smearing
  const css = document.createElement('style');
  css.appendChild(
    document.createTextNode(
      '*,*::before,*::after{-webkit-transition:none!important;-moz-transition:none!important;-o-transition:none!important;-ms-transition:none!important;transition:none!important}',
    ),
  );
  document.head.appendChild(css);

  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Update theme-color meta tag
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', resolved === 'dark' ? '#0B0B0C' : '#FAFAF9');
  }

  // Force reflow
  if (typeof window !== 'undefined' && document.body) {
    void document.body.offsetHeight;
  }

  // Restore transitions on the next frame
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (css.parentNode) {
          css.parentNode.removeChild(css);
        }
      });
    });
  } else {
    if (css.parentNode) {
      css.parentNode.removeChild(css);
    }
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'dark', // Default at launch
  resolvedTheme: 'dark',

  setPreference: (preference: ThemePreference) => {
    const resolvedTheme = resolveEffectiveTheme(preference);
    applyThemeToDocument(resolvedTheme);
    set({ preference, resolvedTheme });
  },

  toggleTheme: () => {
    const current = get().resolvedTheme;
    const next: ThemePreference = current === 'dark' ? 'light' : 'dark';
    const resolvedTheme = resolveEffectiveTheme(next);
    applyThemeToDocument(resolvedTheme);
    set({ preference: next, resolvedTheme });
  },

  initTheme: () => {
    const currentPref = get().preference;
    const resolvedTheme = resolveEffectiveTheme(currentPref);
    applyThemeToDocument(resolvedTheme);
    set({ resolvedTheme });

    if (typeof window === 'undefined') return () => {};

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if (get().preference === 'system') {
        const updated = getSystemTheme();
        applyThemeToDocument(updated);
        set({ resolvedTheme: updated });
      }
    };

    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  },
}));
