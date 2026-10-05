import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { App } from '../App';
import { usePipelineStore, RECOMMENDED_SETTINGS } from '../store/pipelineStore';
describe('simple application shell', () => {
  beforeEach(() =>
    usePipelineStore.setState({
      jobs: [],
      settings: { ...RECOMMENDED_SETTINGS },
      batchError: null,
      selectedCompareJobId: null,
    }),
  );
  it('keeps branding and accessible utilities in a compact header', () => {
    render(<App />);
    const header = screen.getByRole('banner');
    expect(within(header).getByText('Tinute')).toBeInTheDocument();
    expect(within(header).getAllByRole('button')).toHaveLength(1);
    expect(within(header).getByRole('radiogroup', { name: 'Color theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose images' })).toBeInTheDocument();
  });
  it('discloses technical diagnostics rather than showing them upfront', () => {
    render(<App />);
    expect(screen.getByText('Technical details').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Images stay on your device.')).toBeInTheDocument();
  });
  it('retains live announcements', () => {
    render(<App />);
    const live = document.getElementById('accessibility-announcer');
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveAttribute('aria-atomic', 'true');
  });
});
