import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PipelineWorkspace } from '../PipelineWorkspace';
import { usePipelineStore, RECOMMENDED_SETTINGS } from '../../store/pipelineStore';

describe('simple workspace', () => {
  beforeEach(() =>
    usePipelineStore.setState({
      jobs: [],
      settings: { ...RECOMMENDED_SETTINGS },
      isProcessing: false,
      selectedCompareJobId: null,
      batchError: null,
    }),
  );
  it('starts with one obvious action and hides expert choices', () => {
    render(<PipelineWorkspace />);
    expect(screen.getByRole('button', { name: 'Choose images' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Advanced settings'));
    expect(screen.getByRole('combobox', { name: 'Output format' })).toBeInTheDocument();
  });
  it('shows custom settings even after closing the disclosure', () => {
    render(<PipelineWorkspace />);
    fireEvent.click(screen.getByText('Advanced settings'));
    fireEvent.click(screen.getByRole('combobox', { name: 'Output format' }));
    fireEvent.click(screen.getByRole('option', { name: 'PNG' }));
    fireEvent.click(screen.getByText('Advanced settings'));
    expect(screen.getByText('Custom settings')).toBeInTheDocument();
  });
  it('shows rejected batches even without result rows', () => {
    usePipelineStore.setState({ batchError: 'Choose fewer images.' });
    render(<PipelineWorkspace />);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose fewer images.');
  });
});
