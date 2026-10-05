import React from 'react';
import { Trash2, Archive, Ban, AlertCircle, Trophy, Flame } from '@/icons';
import { usePipelineStore } from '../store/pipelineStore';
import { ResultRow } from './ResultRow';
import { formatBytes } from '../utils/format';
import { arcadeAudio } from '../utils/arcadeAudio';

export const ResultsTable: React.FC = () => {
  const {
    jobs,
    isProcessing,
    isZipping,
    zipProgress,
    batchError,
    selectedCompareJobId,
    setSelectedCompareJobId,
    cancelJob,
    cancelAll,
    retryJob,
    clearCompleted,
    exportZip,
  } = usePipelineStore();

  if (jobs.length === 0 && !batchError) return null;

  const completedJobs = jobs.filter((j) => j.status === 'done' && j.result);
  const inFlightCount = jobs.filter(
    (j) => j.status === 'processing' || j.status === 'queued',
  ).length;
  const totalOriginalBytes = completedJobs.reduce((sum, j) => sum + j.originalSize, 0);
  const totalFinalBytes = completedJobs.reduce(
    (sum, j) => sum + (j.result?.finalSize ?? j.originalSize),
    0,
  );
  const totalSavedBytes = Math.max(0, totalOriginalBytes - totalFinalBytes);
  const overallSavingsPct =
    totalOriginalBytes > 0 ? Math.round((totalSavedBytes / totalOriginalBytes) * 100) : 0;

  const handleCancelAll = () => {
    arcadeAudio.playZap();
    cancelAll();
  };

  const handleClearCompleted = () => {
    arcadeAudio.playZap();
    clearCompleted();
  };

  const handleExportZip = () => {
    arcadeAudio.playVictory();
    void exportZip();
  };

  return (
    <section aria-label="Optimization Results" className="space-y-3">
      {/* Batch Limit / Error Alert */}
      {batchError && (
        <div className="p-3 bg-lossy/10 border-2 border-lossy/40 rounded-xl flex items-center gap-2 text-xs text-lossy-text">
          <AlertCircle
            className="w-4 h-4 text-lossy shrink-0"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span className="font-semibold text-pretty">{batchError}</span>
        </div>
      )}

      {/* Comic Scoreboard Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-surface/95 backdrop-blur-sm rounded-comic border-2 border-border text-xs shadow-comic">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-text flex items-center gap-1.5 text-xs">
              <Trophy className="w-4 h-4 text-comic-yellow" strokeWidth={2.2} aria-hidden="true" />
              <span>Queue</span>
            </span>
            <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-canvas border-2 border-border text-muted tabular-nums font-bold shadow-comic-sm">
              {jobs.length}
            </span>
          </div>

          {completedJobs.length > 0 && totalSavedBytes > 0 && (
            <div className="flex items-center gap-1.5 pl-2.5 pr-3 py-1 rounded-xl bg-savings/15 text-savings-text border-2 border-savings/40 font-mono font-bold tabular-nums shadow-comic-sm">
              <Flame className="w-3.5 h-3.5 text-savings" strokeWidth={2.2} aria-hidden="true" />
              <span>
                Saved {formatBytes(totalSavedBytes)} (-{overallSavingsPct}%)
              </span>
            </div>
          )}

          {isProcessing && inFlightCount > 0 && (
            <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-comic-cyan/15 text-comic-cyan border-2 border-comic-cyan/40 animate-pulse tabular-nums font-bold">
              {inFlightCount} crunching in flight...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Cancel All Button */}
          {isProcessing && inFlightCount > 0 && (
            <button
              type="button"
              onClick={handleCancelAll}
              className="pl-2.5 pr-3 py-1.5 rounded-xl border-2 border-lossy/50 text-lossy hover:bg-lossy/10 text-xs font-bold transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Ban className="w-3.5 h-3.5 text-lossy" strokeWidth={2.2} aria-hidden="true" />
              <span>Cancel All</span>
            </button>
          )}

          {/* Export ZIP Button */}
          {completedJobs.length > 0 && (
            <button
              type="button"
              onClick={handleExportZip}
              disabled={isZipping}
              className="pl-3 pr-3.5 py-1.5 bg-accent hover:bg-accent-hover text-accent-contrast rounded-xl text-xs font-bold uppercase tracking-wider border-2 border-border shadow-comic-sm transition-[background-color,transform,box-shadow] duration-150 ease-out active:translate-x-[1px] active:translate-y-[1px] active:shadow-none active:scale-[0.98] motion-reduce:transform-none flex items-center gap-1.5 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Archive className="w-3.5 h-3.5" strokeWidth={2.2} aria-hidden="true" />
              <span>{isZipping ? `Zipping (${zipProgress}%)...` : 'Export ZIP'}</span>
            </button>
          )}

          {/* Clear Completed */}
          {completedJobs.length > 0 && (
            <button
              type="button"
              onClick={handleClearCompleted}
              className="pl-2.5 pr-3 py-1.5 rounded-xl border-2 border-border text-muted hover:text-text hover:bg-canvas text-xs font-bold transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-comic-sm"
            >
              <Trash2 className="w-3.5 h-3.5 text-muted" strokeWidth={2} aria-hidden="true" />
              <span>Clear Completed</span>
            </button>
          )}
        </div>
      </div>

      {/* Results Rows */}
      <div className="space-y-2">
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
    </section>
  );
};
