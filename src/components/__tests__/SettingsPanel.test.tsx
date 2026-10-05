import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '../SettingsPanel';
import { usePipelineStore, RECOMMENDED_SETTINGS } from '../../store/pipelineStore';

describe('advanced settings', () => {
  beforeEach(() => usePipelineStore.setState({ settings: { ...RECOMMENDED_SETTINGS } }));
  it('retains format, mode, quality, metadata, and resize controls', () => {
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('combobox', { name: 'Output format' }));
    fireEvent.click(screen.getByRole('option', { name: 'AVIF' }));
    fireEvent.keyDown(screen.getByRole('slider', { name: /quality/i }), { key: 'PageUp' });
    fireEvent.click(screen.getByRole('checkbox', { name: /remove location/i }));
    fireEvent.click(screen.getByRole('combobox', { name: /image dimensions/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Up to 1920 px' }));
    expect(usePipelineStore.getState().settings).toMatchObject({
      targetFormat: 'avif',
      qualityTarget: 90,
      stripMetadata: false,
      maxDimension: 1920,
    });
    fireEvent.click(screen.getByRole('radio', { name: /keep every detail/i }));
    expect(usePipelineStore.getState().settings.mode).toBe('lossless');
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
  it('resets all controls to the recommended values', () => {
    usePipelineStore.setState({
      settings: {
        ...RECOMMENDED_SETTINGS,
        targetFormat: 'png',
        maxDimension: 1920,
        stripMetadata: false,
      },
    });
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to recommended' }));
    expect(usePipelineStore.getState().settings).toEqual(RECOMMENDED_SETTINGS);
    expect(screen.getByText('Applies to images you add next.')).toBeInTheDocument();
  });
});
