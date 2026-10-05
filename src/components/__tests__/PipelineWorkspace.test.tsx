import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PipelineWorkspace } from '../PipelineWorkspace';
import { usePipelineStore } from '../../store/pipelineStore';

describe('PipelineWorkspace Component', () => {
  beforeEach(() => {
    usePipelineStore.setState({
      jobs: [],
      settings: {
        targetFormat: 'auto',
        mode: 'visually-lossless',
        stripMetadata: true,
        qualityTarget: 80,
      },
      isProcessing: false,
      selectedCompareJobId: null,
    });
  });

  it('renders target format selector with Auto, JPEG, PNG, WebP, AVIF, JXL, etc.', () => {
    render(<PipelineWorkspace />);

    const select = screen.getByRole('combobox', { name: /target format/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^auto/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^jpeg$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^png$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /^webp$/i })).toBeInTheDocument();
  });

  it('renders compression mode selector and toggles between Visually Lossless and Bit-Exact Lossless', () => {
    render(<PipelineWorkspace />);

    const losslessRadio = screen.getByRole('radio', { name: /bit-exact lossless/i });
    expect(losslessRadio).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(losslessRadio);
    expect(usePipelineStore.getState().settings.mode).toBe('lossless');
    expect(losslessRadio).toHaveAttribute('aria-checked', 'true');
  });

  it('displays quality slider in Visually Lossless mode and updates qualityTarget', () => {
    render(<PipelineWorkspace />);

    const slider = screen.getByLabelText(/quality target:/i);
    expect(slider).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '90' } });
    expect(usePipelineStore.getState().settings.qualityTarget).toBe(90);
  });

  it('renders large dashed dropzone with accessible region role on empty state', () => {
    render(<PipelineWorkspace />);

    const dropzone = screen.getByRole('region', { name: /image dropzone/i });
    expect(dropzone).toBeInTheDocument();
    expect(dropzone).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument();
  });
});
