import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CompareSlider } from '../CompareSlider';
import { usePipelineStore } from '../../store/pipelineStore';
import { imageJob } from '../../test/imageJob';
import { createPreviewUrl } from '../../utils/preview';
vi.mock('../../utils/preview', () => ({ createPreviewUrl: vi.fn() }));
describe('focused comparison', () => {
  beforeEach(() => {
    vi.mocked(createPreviewUrl)
      .mockReset()
      .mockResolvedValue({ url: 'blob:preview', revoke: vi.fn() });
    const job = imageJob();
    job.file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(2));
    usePipelineStore.setState({ jobs: [job], selectedCompareJobId: job.id });
  });
  it('opens a named dialog and supports a custom comparison slider', async () => {
    render(<CompareSlider />);
    expect(screen.getByRole('dialog', { name: /compare images/i })).toBeInTheDocument();
    const slider = await screen.findByRole('slider', { name: 'Image comparison' });
    expect(slider.tagName).toBe('DIV');
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(slider).toHaveAttribute('aria-valuenow', '60');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(screen.getByText('150%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom to fit' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
  it('restores focus to the initiating control after close', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    render(<CompareSlider />);
    fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }));
    expect(usePipelineStore.getState().selectedCompareJobId).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
    trigger.remove();
  });
  it('shows preview failure and keeps close available', async () => {
    vi.mocked(createPreviewUrl).mockRejectedValueOnce(new Error('bad preview'));
    render(<CompareSlider />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/preview.*download/i);
    fireEvent.click(screen.getByRole('button', { name: 'Close comparison' }));
    expect(usePipelineStore.getState().selectedCompareJobId).toBeNull();
  });
  it('revokes previews when dismissed', async () => {
    const revoke = vi.fn();
    vi.mocked(createPreviewUrl).mockResolvedValue({ url: 'blob:preview', revoke });
    const { unmount } = render(<CompareSlider />);
    await screen.findByRole('slider');
    unmount();
    expect(revoke).toHaveBeenCalledTimes(2);
  });
});
