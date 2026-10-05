import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '../ThemeToggle';
import { useThemeStore } from '../../store/theme';

describe('ThemeToggle component', () => {
  beforeEach(() => {
    useThemeStore.setState({ preference: 'dark', resolvedTheme: 'dark' });
  });

  it('renders a radiogroup with options for Light, Dark, and System', () => {
    render(<ThemeToggle />);

    const group = screen.getByRole('radiogroup', { name: /theme selection/i });
    expect(group).toBeInTheDocument();

    const lightRadio = screen.getByRole('radio', { name: /light/i });
    const darkRadio = screen.getByRole('radio', { name: /dark/i });
    const systemRadio = screen.getByRole('radio', { name: /system/i });

    expect(lightRadio).toBeInTheDocument();
    expect(darkRadio).toBeInTheDocument();
    expect(systemRadio).toBeInTheDocument();
  });

  it('indicates the currently selected theme via aria-checked', () => {
    render(<ThemeToggle />);

    const darkRadio = screen.getByRole('radio', { name: /dark/i });
    expect(darkRadio).toHaveAttribute('aria-checked', 'true');

    const lightRadio = screen.getByRole('radio', { name: /light/i });
    expect(lightRadio).toHaveAttribute('aria-checked', 'false');
  });

  it('updates selection when a different radio button is clicked', () => {
    render(<ThemeToggle />);

    const lightRadio = screen.getByRole('radio', { name: /light/i });
    fireEvent.click(lightRadio);

    expect(useThemeStore.getState().preference).toBe('light');
    expect(lightRadio).toHaveAttribute('aria-checked', 'true');
  });
});

it('supports APG keyboard navigation with ArrowRight and ArrowLeft', () => {
  render(<ThemeToggle />);
  const darkRadio = screen.getByRole('radio', { name: /dark/i });

  // Focus darkRadio and press ArrowRight -> advances to 'system'
  fireEvent.keyDown(darkRadio, { key: 'ArrowRight' });
  expect(useThemeStore.getState().preference).toBe('system');

  // Press ArrowRight again -> wraps to 'light'
  const systemRadio = screen.getByRole('radio', { name: /system/i });
  fireEvent.keyDown(systemRadio, { key: 'ArrowRight' });
  expect(useThemeStore.getState().preference).toBe('light');

  // Press ArrowLeft -> wraps back to 'system'
  const lightRadio = screen.getByRole('radio', { name: /light/i });
  fireEvent.keyDown(lightRadio, { key: 'ArrowLeft' });
  expect(useThemeStore.getState().preference).toBe('system');
});
