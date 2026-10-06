import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultRow } from '../ResultRow';
import { imageJob } from '../../test/imageJob';
import { downloadImageJob } from '../../utils/download';
vi.mock('../../utils/preview', () => ({
  createPreviewUrl: vi.fn().mockRejectedValue(new Error('no preview')),
}));
vi.mock('../../utils/download', () => ({ downloadImageJob: vi.fn() }));
const props = {
  isSelectedForCompare: false,
  onSelectCompare: vi.fn(),
  onCancel: vi.fn(),
  onRetry: vi.fn(),
};
describe('readable image cards', () => {
  it('shows plain savings and puts technical scores in details', () => {
    render(<ResultRow {...props} job={imageJob()} />);
    expect(screen.getByText('50% smaller')).toBeInTheDocument();
    expect(screen.getByText(/quality score/i).closest('details')).not.toHaveAttribute('open');
  });
  it('explains original-kept outcomes', () => {
    const job = imageJob();
    job.result!.neverBiggerTriggered = true;
    render(<ResultRow {...props} job={job} />);
    expect(screen.getByText('Already small — original kept')).toBeInTheDocument();
    expect(screen.queryByText(/location data removed/i)).not.toBeInTheDocument();
  });
  it('keeps full error text visible with a retry path', () => {
    render(
      <ResultRow
        {...props}
        job={imageJob({
          status: 'error',
          result: null,
          error: {
            code: 'DECODE_ERROR',
            message: 'This long file could not be read. Choose another image.',
          },
        })}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This long file could not be read. Choose another image.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again photo.png' }));
    expect(props.onRetry).toHaveBeenCalledWith('photo');
  });
  it('lets stopped images be retried', () => {
    render(<ResultRow {...props} job={imageJob({ status: 'cancelled', result: null })} />);
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again photo.png' })).toBeInTheDocument();
  });
  it('shows download failure while preserving other actions', () => {
    vi.mocked(downloadImageJob).mockImplementationOnce(() => {
      throw new Error('blocked');
    });
    render(<ResultRow {...props} job={imageJob()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download photo.png' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/try again/i);
    expect(screen.getByRole('button', { name: 'Compare photo.png' })).toBeEnabled();
  });
});
