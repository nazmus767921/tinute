import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DownloadActions } from '../DownloadActions';
import { usePipelineStore } from '../../store/pipelineStore';
import { imageJob } from '../../test/imageJob';
import { downloadImageJob } from '../../utils/download';
vi.mock('../../utils/download', () => ({ downloadImageJob: vi.fn() }));
describe('simple downloads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePipelineStore.setState({ jobs: [], isZipping: false, zipProgress: 0, zipError: null });
  });
  it('downloads one image directly', () => {
    const job = imageJob();
    usePipelineStore.setState({ jobs: [job] });
    render(<DownloadActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
    expect(downloadImageJob).toHaveBeenCalledWith(job);
  });
  it('packs multiple images and names the ready subset during processing', () => {
    const exportZip = vi.fn();
    usePipelineStore.setState({
      jobs: [
        imageJob(),
        imageJob({ id: 'two' }),
        imageJob({ id: 'three', status: 'processing', result: null }),
      ],
      exportZip,
    });
    render(<DownloadActions />);
    fireEvent.click(screen.getByRole('button', { name: 'Download ready images' }));
    expect(exportZip).toHaveBeenCalledOnce();
    expect(screen.getByText(/ZIP/)).toBeInTheDocument();
  });
  it('shows preparation progress and prevents duplicate downloads', () => {
    usePipelineStore.setState({ jobs: [imageJob()], isZipping: true, zipProgress: 50 });
    render(<DownloadActions />);
    expect(screen.getByRole('button', { name: /preparing/i })).toBeDisabled();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });
  it('shows export failures with recovery guidance', () => {
    usePipelineStore.setState({
      jobs: [imageJob()],
      zipError: 'Could not prepare your download. Try again.',
    });
    render(<DownloadActions />);
    expect(screen.getByRole('alert')).toHaveTextContent(/try again/i);
  });
});
