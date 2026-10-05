import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompareSlider } from '../CompareSlider';
import { usePipelineStore, type ImageJob } from '../../store/pipelineStore';

describe('CompareSlider Component', () => {
  const mockJob: ImageJob = {
    id: 'compare-1',
    file: new File(['image-bytes'], 'sample.jpg', { type: 'image/jpeg' }),
    name: 'sample.jpg',
    originalSize: 4000,
    status: 'done',
    result: {
      id: 'compare-1',
      outputBuffer: new Uint8Array([1, 2, 3, 4]).buffer,
      outputFormat: 'webp',
      originalFormat: 'jpeg',
      originalSize: 4000,
      finalSize: 1500,
      savedBytes: 2500,
      savingsPercentage: 62,
      neverBiggerTriggered: false,
      generationalLossWarning: false,
      qualityScore: 88.5,
      isLosslessBitExact: false,
      classification: 'photo',
      mode: 'visually-lossless',
      metadataReport: { gpsRemoved: true, exifRemoved: true, iccPreserved: true },
      durationMs: 30,
    },
    error: null,
  };

  beforeEach(() => {
    // Mock URL.createObjectURL & URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    File.prototype.arrayBuffer = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer);

    usePipelineStore.setState({
      jobs: [mockJob],
      selectedCompareJobId: 'compare-1',
    });
  });

  it('renders slider when selected completed job is present', async () => {
    render(<CompareSlider />);

    await waitFor(() => {
      const slider = screen.getByRole('slider', { name: /image comparison slider/i });
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    // Pinned Quality Score HUD
    expect(screen.getByText(/SSIMULACRA2: 88.5\/100/i)).toBeInTheDocument();
    // Labels
    expect(screen.getByText(/Original: JPEG/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimized: WEBP/i)).toBeInTheDocument();
  });

  it('adjusts split position via keyboard arrow keys and Home/End', async () => {
    render(<CompareSlider />);

    let slider: HTMLElement;
    await waitFor(() => {
      slider = screen.getByRole('slider', { name: /image comparison slider/i });
      expect(slider).toBeInTheDocument();
    });

    slider = screen.getByRole('slider', { name: /image comparison slider/i });

    // ArrowLeft nudges split down
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(slider).toHaveAttribute('aria-valuenow', '49');

    // ArrowRight nudges split up
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider).toHaveAttribute('aria-valuenow', '50');

    // Home jumps to 0
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(slider).toHaveAttribute('aria-valuenow', '0');

    // End jumps to 100
    fireEvent.keyDown(slider, { key: 'End' });
    expect(slider).toHaveAttribute('aria-valuenow', '100');
  });

  it('zooms in, zooms out, and resets to Fit', async () => {
    render(<CompareSlider />);

    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    const zoomInBtn = screen.getByRole('button', { name: /zoom in/i });
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('150%')).toBeInTheDocument();

    const zoomOutBtn = screen.getByRole('button', { name: /zoom out/i });
    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();

    const fitBtn = screen.getByRole('button', { name: /reset zoom to fit/i });
    fireEvent.click(fitBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('closes comparison view when close button is clicked', async () => {
    render(<CompareSlider />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close comparison view/i })).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /close comparison view/i });
    fireEvent.click(closeBtn);

    expect(usePipelineStore.getState().selectedCompareJobId).toBeNull();
  });

  it('closes comparison view when Escape key is pressed on the slider', async () => {
    render(<CompareSlider />);

    await waitFor(() => {
      const slider = screen.getByRole('slider', { name: /image comparison slider/i });
      expect(slider).toBeInTheDocument();
    });

    const slider = screen.getByRole('slider', { name: /image comparison slider/i });
    fireEvent.keyDown(slider, { key: 'Escape' });

    expect(usePipelineStore.getState().selectedCompareJobId).toBeNull();
  });
});
