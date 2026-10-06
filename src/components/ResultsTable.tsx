import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { usePipelineStore } from '../store/pipelineStore';
import { ResultRow } from './ResultRow';
import { Dropzone } from './Dropzone';
import { DownloadActions } from './DownloadActions';
import { Trash2 } from '@/icons';
import { ByteBot } from './ByteBot';

export const ResultsTable: React.FC = () => {
  const {
    jobs,
    isZipping,
    selectedCompareJobId,
    setSelectedCompareJobId,
    cancelJob,
    retryJob,
    clearCompleted,
  } = usePipelineStore(
    useShallow((state) => ({
      jobs: state.jobs,
      isZipping: state.isZipping,
      selectedCompareJobId: state.selectedCompareJobId,
      setSelectedCompareJobId: state.setSelectedCompareJobId,
      cancelJob: state.cancelJob,
      retryJob: state.retryJob,
      clearCompleted: state.clearCompleted,
    })),
  );
  if (!jobs.length) return null;
  const pending = jobs.some((j) => j.status === 'processing' || j.status === 'queued');
  const ready = jobs.filter((j) => j.status === 'done' && j.result).length;
  const failed = jobs.filter((j) => j.status === 'error').length;
  const clearable = jobs.some(
    (j) => j.status === 'done' || j.status === 'cancelled' || j.status === 'error',
  );
  const clear = () => {
    if (
      window.confirm(
        'Clear finished images? Download anything you want to keep first. Your original files will not be changed.',
      )
    )
      clearCompleted();
  };
  return (
    <section aria-labelledby="results-heading" className="results-section">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="results-heading" className="font-bold text-2xl tracking-tight text-balance">
            {pending ? 'Your images' : ready > 0 ? 'Tiny files. Ready to go.' : 'Your images'}
          </h2>
          <p className="mt-2 text-sm text-muted text-pretty">
            {pending
              ? 'Ready images can be downloaded while the rest finish.'
              : failed > 0
                ? `${ready} ready · ${failed} couldn’t process. Try again below.`
                : ready > 0
                  ? 'Less space. Same big ideas.'
                  : 'Stopped images can be tried again below.'}
          </p>
        </div>
        {!pending && ready > 0 && (
          <div className="hidden sm:block shrink-0" aria-hidden="true">
            <ByteBot size="md" mood="celebrating" />
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        <Dropzone compact />
        {clearable && (
          <button
            type="button"
            className="btn btn-quiet"
            disabled={isZipping}
            onClick={clear}
            aria-label="Clear finished images"
          >
            <Trash2 size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Clear finished</span>
          </button>
        )}
      </div>
      <div className="mt-5 space-y-3">
        {jobs.map((job) => (
          <ResultRow
            key={job.id}
            job={job}
            isSelectedForCompare={job.id === selectedCompareJobId}
            onSelectCompare={setSelectedCompareJobId}
            onCancel={cancelJob}
            onRetry={retryJob}
          />
        ))}
      </div>
      <DownloadActions />
    </section>
  );
};
