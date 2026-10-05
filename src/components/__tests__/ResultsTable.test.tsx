import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsTable } from '../ResultsTable';
import { usePipelineStore } from '../../store/pipelineStore';
import { imageJob } from '../../test/imageJob';
describe('results', () => {
  beforeEach(() =>
    usePipelineStore.setState({
      jobs: [],
      selectedCompareJobId: null,
      batchError: null,
      isZipping: false,
      zipError: null,
    }),
  );
  it('renders nothing before images are added', () => {
    expect(render(<ResultsTable />).container.firstChild).toBeNull();
  });
  it('opens comparison deliberately', () => {
    usePipelineStore.setState({ jobs: [imageJob()] });
    render(<ResultsTable />);
    expect(usePipelineStore.getState().selectedCompareJobId).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Compare photo.png' }));
    expect(usePipelineStore.getState().selectedCompareJobId).toBe('photo');
  });
  it('guards clearing finished output', () => {
    const clearCompleted = vi.fn();
    usePipelineStore.setState({ jobs: [imageJob()], clearCompleted });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ResultsTable />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear finished images' }));
    expect(clearCompleted).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear finished images' }));
    expect(clearCompleted).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });
});
