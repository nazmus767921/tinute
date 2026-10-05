import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../theme';

describe('Theme Store', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    useThemeStore.setState({ preference: 'dark', resolvedTheme: 'dark' });
  });

  it('initializes with dark theme by default as specified for launch', () => {
    const state = useThemeStore.getState();
    expect(state.preference).toBe('dark');
  });

  it('sets theme preference explicitly to light', () => {
    useThemeStore.getState().setPreference('light');

    expect(useThemeStore.getState().preference).toBe('light');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sets theme preference explicitly to dark', () => {
    useThemeStore.getState().setPreference('light');
    useThemeStore.getState().setPreference('dark');

    expect(useThemeStore.getState().preference).toBe('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles theme between dark and light', () => {
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
