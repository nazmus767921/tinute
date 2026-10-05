import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { App } from '../App';

describe('App component', () => {
  it('renders application header with title and tagline', () => {
    render(<App />);

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('heading', { level: 1, name: /tinute/i })).toBeInTheDocument();
    expect(within(header).getByText('Bake tiny images in minutes with Tinutes')).toBeInTheDocument();
    expect(within(header).getByText('Private & Secure')).toBeInTheDocument();
  });

  it('renders dropzone region with keyboard focusable attribute', () => {
    render(<App />);

    const dropzone = screen.getByRole('region', { name: /image dropzone/i });
    expect(dropzone).toBeInTheDocument();
    expect(dropzone).toHaveAttribute('tabIndex', '0');
    expect(screen.getByText(/Drop images here to convert & optimize/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument();
  });

  it('renders ARIA live region for batch progress and accessibility announcements', () => {
    render(<App />);

    const liveRegion = document.getElementById('accessibility-announcer');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('renders footer confirming private local compression', () => {
    render(<App />);

    expect(
      screen.getByText(/all compression happens privately on your device/i),
    ).toBeInTheDocument();
  });
});
