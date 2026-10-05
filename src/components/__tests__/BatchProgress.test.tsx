import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchProgress } from '../BatchProgress';
import type { ImageJob, JobStatus } from '../../store/pipelineStore';
const jobs = (states: JobStatus[]): ImageJob[] =>
  states.map((status, i) => ({
    id: String(i),
    file: new File(['x'], 'photo.png'),
    name: 'photo.png',
    originalSize: 1,
    status,
    result: null,
    error: null,
  }));
describe('honest visual progress', () => {
  it('counts settled work without claiming errors succeeded', () => {
    render(
      <BatchProgress
        jobs={jobs([
          'done',
          'error',
          'cancelled',
          'processing',
          'queued',
          'queued',
          'queued',
          'queued',
        ])}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '37.5');
    expect(screen.getByText('3 of 8 finished')).toBeInTheDocument();
    expect(screen.getByText(/1 couldn’t process/)).toBeInTheDocument();
  });
  it('uses an indeterminate bar for one unfinished image', () => {
    render(<BatchProgress jobs={jobs(['processing'])} onStop={vi.fn()} />);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });
  it('starts batches at zero and exposes stop', () => {
    const onStop = vi.fn();
    render(<BatchProgress jobs={jobs(['processing', 'queued'])} onStop={onStop} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Stop processing' }));
    expect(onStop).toHaveBeenCalledOnce();
  });
});
