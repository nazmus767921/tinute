import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';
import { useThemeStore } from '../../store/theme';
describe('theme preference', () => {
  it('offers a keyboard-operated segmented theme switcher', () => {
    useThemeStore.setState({ preference: 'dark', resolvedTheme: 'dark' });
    render(<ThemeToggle />);
    const dark = screen.getByRole('radio', { name: 'Dark theme' });
    expect(dark).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(dark, { key: 'ArrowRight' });
    expect(useThemeStore.getState().preference).toBe('system');
    expect(screen.getByRole('radio', { name: 'Automatic theme' })).toHaveFocus();
  });
});
