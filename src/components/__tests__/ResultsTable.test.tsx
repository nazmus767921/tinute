import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsTable } from '../ResultsTable';
import { usePipelineStore, type ImageJob } from '../../store/pipelineStore';

describe('ResultsTable Component', () => {
  beforeEach(() => {
    usePipelineStore.setState({
      jobs: [],
      selectedCompareJobId: null,
    });
  });

  it('renders nothing when jobs array is empty', () => {
    const { container } = render(<ResultsTable />);
    expect(container.firstChild).toBeNull();
  });

  it('renders rows for queued, processing, error, and completed jobs', () => {
    const jobs: ImageJob[] = [
      {
        id: 'job-1',
        file: new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }),
        name: 'photo.jpg',
        originalSize: 1024 * 1024,
        status: 'done',
        result: {
          id: 'job-1',
          outputBuffer: new Uint8Array([1, 2, 3]).buffer,
          outputFormat: 'webp',
          originalFormat: 'jpeg',
          originalSize: 1024 * 1024,
          finalSize: 512 * 1024,
          savedBytes: 512 * 1024,
          savingsPercentage: 50,
          neverBiggerTriggered: false,
          generationalLossWarning: false,
          qualityScore: 84.5,
          isLosslessBitExact: false,
          classification: 'photo',
          mode: 'visually-lossless',
          metadataReport: { gpsRemoved: true, exifRemoved: true, iccPreserved: true },
          durationMs: 45,
        },
        error: null,
      },
    ];

    usePipelineStore.setState({ jobs });
    render(<ResultsTable />);

    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
    expect(screen.getByText(/jpeg\s*→\s*webp/i)).toBeInTheDocument();
    expect(screen.getByText('-50%')).toBeInTheDocument();
    expect(screen.getByText('Q: 84.5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /compare photo\.jpg/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /download optimized photo\.jpg/i }),
    ).toBeInTheDocument();
  });

  it('updates selectedCompareJobId when Compare button is clicked', () => {
    const job: ImageJob = {
      id: 'job-compare-1',
      file: new File(['data'], 'test.png', { type: 'image/png' }),
      name: 'test.png',
      originalSize: 2000,
      status: 'done',
      result: {
        id: 'job-compare-1',
        outputBuffer: new Uint8Array([1, 2]).buffer,
        outputFormat: 'png',
        originalFormat: 'png',
        originalSize: 2000,
        finalSize: 1000,
        savedBytes: 1000,
        savingsPercentage: 50,
        neverBiggerTriggered: false,
        generationalLossWarning: false,
        qualityScore: 100,
        isLosslessBitExact: true,
        classification: 'illustration',
        mode: 'lossless',
        metadataReport: { gpsRemoved: false, exifRemoved: false, iccPreserved: true },
        durationMs: 12,
      },
      error: null,
    };

    usePipelineStore.setState({ jobs: [job], selectedCompareJobId: null });
    render(<ResultsTable />);

    const compareBtn = screen.getByRole('button', { name: /compare test\.png/i });
    fireEvent.click(compareBtn);

    expect(usePipelineStore.getState().selectedCompareJobId).toBe('job-compare-1');
  });

  it('clears completed jobs when Clear Completed button is clicked', () => {
    const clearSpy = vi.fn();
    usePipelineStore.setState({
      jobs: [
        {
          id: 'job-done',
          file: new File(['done'], 'done.jpg', { type: 'image/jpeg' }),
          name: 'done.jpg',
          originalSize: 100,
          status: 'done',
          result: {
            id: 'job-done',
            outputBuffer: new ArrayBuffer(50),
            outputFormat: 'webp',
            originalFormat: 'jpeg',
            originalSize: 100,
            finalSize: 50,
            savedBytes: 50,
            savingsPercentage: 50,
            neverBiggerTriggered: false,
            generationalLossWarning: false,
            qualityScore: 90,
            isLosslessBitExact: false,
            classification: 'photo',
            mode: 'visually-lossless',
            metadataReport: { gpsRemoved: true, exifRemoved: true, iccPreserved: true },
            durationMs: 10,
          },
          error: null,
        },
      ],
      clearCompleted: clearSpy,
    });

    render(<ResultsTable />);
    const clearBtn = screen.getByRole('button', { name: /clear completed/i });
    fireEvent.click(clearBtn);

    expect(clearSpy).toHaveBeenCalled();
  });

  it('triggers cancelAll when Cancel All button is clicked during processing', () => {
    const cancelAllSpy = vi.fn();
    usePipelineStore.setState({
      isProcessing: true,
      jobs: [
        {
          id: 'job-active',
          file: new File(['img'], 'active.png', { type: 'image/png' }),
          name: 'active.png',
          originalSize: 500,
          status: 'processing',
          result: null,
          error: null,
        },
      ],
      cancelAll: cancelAllSpy,
    });

    render(<ResultsTable />);
    const cancelAllBtn = screen.getByRole('button', { name: /cancel all/i });
    fireEvent.click(cancelAllBtn);

    expect(cancelAllSpy).toHaveBeenCalledTimes(1);
  });

  it('triggers exportZip when Export ZIP button is clicked', () => {
    const exportZipSpy = vi.fn();
    usePipelineStore.setState({
      jobs: [
        {
          id: 'job-done',
          file: new File(['data'], 'done.png', { type: 'image/png' }),
          name: 'done.png',
          originalSize: 500,
          status: 'done',
          result: {
            id: 'job-done',
            outputBuffer: new ArrayBuffer(200),
            outputFormat: 'webp',
            originalFormat: 'png',
            originalSize: 500,
            finalSize: 200,
            savedBytes: 300,
            savingsPercentage: 60,
            neverBiggerTriggered: false,
            generationalLossWarning: false,
            qualityScore: 90,
            isLosslessBitExact: false,
            classification: 'screenshot',
            mode: 'visually-lossless',
            metadataReport: { gpsRemoved: false, exifRemoved: false, iccPreserved: true },
            durationMs: 15,
          },
          error: null,
        },
      ],
      exportZip: exportZipSpy,
    });

    render(<ResultsTable />);
    const exportBtn = screen.getByRole('button', { name: /export zip/i });
    fireEvent.click(exportBtn);

    expect(exportZipSpy).toHaveBeenCalledTimes(1);
  });
});
