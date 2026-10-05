import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemStatus } from '../SystemStatus';

describe('SystemStatus component', () => {
  it('renders all four environment diagnostics cards', () => {
    render(<SystemStatus />);

    expect(
      screen.getByRole('heading', { name: /environment & security diagnostics/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('COOP / COEP Isolation')).toBeInTheDocument();
    expect(screen.getByText('SharedArrayBuffer')).toBeInTheDocument();
    expect(screen.getByText('Worker Pool Target')).toBeInTheDocument();
    expect(screen.getByText('Design Tokens & WCAG')).toBeInTheDocument();
  });

  it('renders tabular figures and baseline badge', () => {
    render(<SystemStatus />);
    expect(screen.getByText('Phase 0 Baseline')).toBeInTheDocument();
  });
});
