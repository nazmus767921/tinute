import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsPanel } from '../SettingsPanel';
import { usePipelineStore } from '../../store/pipelineStore';

describe('SettingsPanel Component', () => {
  beforeEach(() => {
    usePipelineStore.setState({
      settings: {
        targetFormat: 'auto',
        mode: 'visually-lossless',
        stripMetadata: true,
        qualityTarget: 80,
      },
    });
  });

  it('updates target format in store when changed', () => {
    render(<SettingsPanel />);
    const select = screen.getByRole('combobox', { name: /target format/i });

    fireEvent.change(select, { target: { value: 'avif' } });
    expect(usePipelineStore.getState().settings.targetFormat).toBe('avif');
  });

  it('updates optimization mode when toggling radio buttons', () => {
    render(<SettingsPanel />);
    const losslessRadio = screen.getByRole('radio', { name: /bit-exact lossless/i });

    fireEvent.click(losslessRadio);
    expect(usePipelineStore.getState().settings.mode).toBe('lossless');
  });

  it('updates quality target when slider moves', () => {
    render(<SettingsPanel />);
    const slider = screen.getByLabelText(/quality target:/i);

    fireEvent.change(slider, { target: { value: '85' } });
    expect(usePipelineStore.getState().settings.qualityTarget).toBe(85);
  });

  it('toggles strip metadata checkbox in store', () => {
    render(<SettingsPanel />);
    const checkbox = screen.getByRole('checkbox', { name: /strip gps & exif/i });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(usePipelineStore.getState().settings.stripMetadata).toBe(false);
  });

  it('updates maxDimension when selected', () => {
    render(<SettingsPanel />);
    const select = screen.getByRole('combobox', { name: /max dimension resize/i });

    fireEvent.change(select, { target: { value: '1920' } });
    expect(usePipelineStore.getState().settings.maxDimension).toBe(1920);

    fireEvent.change(select, { target: { value: 'none' } });
    expect(usePipelineStore.getState().settings.maxDimension).toBeUndefined();
  });
});

it('supports roving tabindex and arrow key navigation between modes', () => {
  render(<SettingsPanel />);
  const visuallyLosslessRadio = screen.getByRole('radio', { name: /visually lossless/i });
  expect(visuallyLosslessRadio).toHaveAttribute('aria-checked', 'true');

  fireEvent.keyDown(visuallyLosslessRadio, { key: 'ArrowRight' });
  expect(usePipelineStore.getState().settings.mode).toBe('lossless');

  const losslessRadio = screen.getByRole('radio', { name: /bit-exact lossless/i });
  expect(losslessRadio).toHaveAttribute('aria-checked', 'true');

  fireEvent.keyDown(losslessRadio, { key: 'ArrowLeft' });
  expect(usePipelineStore.getState().settings.mode).toBe('visually-lossless');
});
