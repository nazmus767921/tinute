import React from 'react';
import type { ImageJob } from '../store/pipelineStore';
import { ByteBot } from './ByteBot';

export const BatchProgress: React.FC<{ jobs: ImageJob[]; onStop: () => void }> = ({
  jobs,
  onStop,
}) => {
  const finished = jobs.filter((j) => ['done', 'error', 'cancelled'].includes(j.status)).length;
  const failed = jobs.filter((j) => j.status === 'error').length;
  const stopped = jobs.filter((j) => j.status === 'cancelled').length;
  const value = jobs.length ? (finished / jobs.length) * 100 : 0;
  const indeterminate = jobs.length === 1 && finished === 0;
  return (
    <section aria-labelledby="progress-heading" className="progress-card">
      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="shrink-0">
          <ByteBot size="md" mood="crunching" />
        </div>
        <div className="min-w-0">
          <h2
            id="progress-heading"
            className="text-lg sm:text-xl font-bold tracking-tight text-balance"
          >
            Making your images smaller
          </h2>
          <p className="mt-1 text-sm text-muted text-pretty">
            ByteBot is on it. Your originals stay safe.
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="Images finished"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : value}
        aria-valuetext={
          indeterminate ? 'Making your image smaller' : `${finished} of ${jobs.length} finished`
        }
        className="progress-track mt-5"
      >
        <div
          className={indeterminate ? 'progress-indeterminate' : 'progress-fill'}
          style={indeterminate ? undefined : { width: `${value}%` }}
        />
        {!indeterminate && value === 0 && <span className="progress-start" />}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold tabular-nums whitespace-nowrap">
          {finished} of {jobs.length} finished
        </p>
        <button type="button" onClick={onStop} className="btn btn-quiet text-sm">
          Stop processing
        </button>
      </div>
      {(failed > 0 || stopped > 0) && (
        <p className="text-sm text-muted text-pretty">
          {failed > 0 ? `${failed} couldn’t process` : ''}
          {failed > 0 && stopped > 0 ? ' · ' : ''}
          {stopped > 0 ? `${stopped} stopped` : ''}. Finished images are available below.
        </p>
      )}
    </section>
  );
};
