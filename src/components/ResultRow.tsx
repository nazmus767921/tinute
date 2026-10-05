import React, { useState, useEffect } from 'react';
import {
  FileImage,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
  X,
  ShieldAlert,
  Columns,
  Download,
  Flame,
} from '@/icons';
import type { ImageJob } from '../store/pipelineStore';
import { formatBytes, getFileExtension } from '../utils/format';
import { arcadeAudio } from '../utils/arcadeAudio';
import { ByteBot } from './ByteBot';

interface ResultRowProps {
  job: ImageJob;
  isSelectedForCompare: boolean;
  onSelectCompare: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}

export const ResultRow: React.FC<ResultRowProps> = ({
  job,
  isSelectedForCompare,
  onSelectCompare,
  onCancel,
  onRetry,
}) => {
  const { status, result, error } = job;
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    if (job.file.type.startsWith('image/')) {
      url = URL.createObjectURL(job.file);
      setThumbUrl(url);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [job.file]);

  const handleDownload = () => {
    if (!result) return;
    arcadeAudio.playInsertCoin();
    const blob = new Blob([result.outputBuffer], { type: `image/${result.outputFormat}` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.name.replace(/\.[^/.]+$/, '')}.optimized.${getFileExtension(result.outputFormat)}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCompareClick = () => {
    arcadeAudio.playClick();
    onSelectCompare(job.id);
  };

  const handleCancelClick = () => {
    arcadeAudio.playZap();
    onCancel(job.id);
  };

  const handleRetryClick = () => {
    arcadeAudio.playClick();
    onRetry(job.id);
  };

  const isBigWin = Boolean(result && result.savingsPercentage >= 50);

  return (
    <div
      className={`p-3 bg-surface/95 backdrop-blur-sm rounded-comic border-2 transition-[border-color,box-shadow,transform] duration-150 ease-out flex flex-col gap-2.5 text-xs shadow-comic-sm ${
        isSelectedForCompare
          ? 'border-comic-cyan ring-2 ring-comic-cyan shadow-comic'
          : status === 'processing'
            ? 'border-comic-cyan/80 ring-1 ring-comic-cyan/40 shadow-comic bg-comic-cyan/[0.03]'
            : 'border-border hover:border-comic-cyan hover:shadow-comic'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
        {/* Thumbnail & Metadata */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-12 h-12 rounded-xl bg-canvas border-2 border-border flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
              onError={() => setThumbUrl(null)}
            />
          ) : (
            <FileImage className="w-5 h-5 text-muted" strokeWidth={2} aria-hidden="true" />
          )}

          {/* Mini Status Mascot */}
          {status === 'processing' && (
            <div className="absolute inset-0 bg-canvas/80 flex items-center justify-center">
              <ByteBot size="sm" mood="crunching" />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="font-bold text-text truncate max-w-[200px] sm:max-w-xs text-xs sm:text-sm"
              title={job.name}
            >
              {job.name}
            </span>
            {result && (
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-canvas border-2 border-border font-bold uppercase text-muted shadow-comic-sm">
                {result.originalFormat} → {result.outputFormat}
              </span>
            )}
          </div>
          <div className="font-mono text-muted text-[11px] mt-0.5 tabular-nums flex items-center gap-1.5 font-medium">
            <span>{formatBytes(job.originalSize)}</span>
            {result && (
              <>
                <span className="text-comic-cyan font-bold">→</span>
                <span className="text-text font-bold">{formatBytes(result.finalSize)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Badges & Actions */}
      <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
        {status === 'queued' && (
          <span className="px-2.5 py-0.5 rounded-lg bg-canvas border-2 border-border font-semibold text-muted text-xs">
            Queued
          </span>
        )}
        {status === 'processing' && (
          <span className="px-2.5 py-0.5 rounded-lg bg-comic-cyan/15 text-comic-cyan border-2 border-comic-cyan/40 font-bold animate-pulse text-xs">
            Crunching...
          </span>
        )}

        {status === 'done' && result && (
          <>
            {result.neverBiggerTriggered ? (
              <span className="flex items-center gap-1 pl-2 pr-2.5 py-0.5 rounded-lg bg-canvas border-2 border-border text-muted font-semibold text-xs">
                <CheckCircle2
                  className="w-3.5 h-3.5 text-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span>Original Kept</span>
              </span>
            ) : (
              <span
                className={`flex items-center gap-1 pl-2.5 pr-3 py-0.5 rounded-xl font-mono font-bold tabular-nums text-xs shadow-comic-sm ${
                  isBigWin
                    ? 'bg-savings/20 text-savings-text border-2 border-savings/50 shadow-comic-sm'
                    : 'bg-savings/15 text-savings-text border-2 border-savings/30'
                }`}
              >
                {isBigWin ? (
                  <Flame className="w-3.5 h-3.5 text-savings" strokeWidth={2.2} aria-hidden="true" />
                ) : (
                  <CheckCircle2
                    className="w-3.5 h-3.5 text-savings"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                )}
                <span>-{result.savingsPercentage}%</span>
              </span>
            )}

            <span
              className="px-2 py-0.5 rounded-lg bg-canvas border-2 border-border font-mono text-muted tabular-nums font-semibold text-xs"
              title={`Score: ${result.qualityScore.toFixed(1)}/100`}
            >
              {result.isLosslessBitExact ? 'Lossless 100' : `Q: ${result.qualityScore.toFixed(1)}`}
            </span>

            {result.generationalLossWarning && (
              <span
                title="Repeated lossy compression detected."
                className="flex items-center gap-1 pl-2 pr-2.5 py-0.5 rounded-lg bg-lossy/15 text-lossy-text font-semibold text-xs border border-lossy/30"
              >
                <AlertTriangle
                  className="w-3.5 h-3.5 text-lossy"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">Lossy Warning</span>
              </span>
            )}

            <button
              type="button"
              onClick={handleCompareClick}
              aria-label={`Compare ${job.name}`}
              className={`pl-2.5 pr-3 py-1 rounded-xl border-2 text-xs font-bold transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isSelectedForCompare
                  ? 'bg-accent text-accent-contrast border-border shadow-comic-sm'
                  : 'bg-canvas border-border text-text hover:bg-surface shadow-comic-sm'
              }`}
            >
              <Columns className="w-3.5 h-3.5 text-comic-cyan" strokeWidth={2.2} aria-hidden="true" />
              <span>Compare</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              aria-label={`Download optimized ${job.name}`}
              className="pl-2.5 pr-3 py-1 rounded-xl bg-canvas border-2 border-border hover:border-comic-cyan hover:bg-surface text-text font-bold text-xs transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:translate-x-[1px] active:translate-y-[1px] active:shadow-none active:scale-[0.98] motion-reduce:transform-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-comic-sm"
            >
              <Download className="w-3.5 h-3.5 text-savings" strokeWidth={2.2} aria-hidden="true" />
              <span>Save</span>
            </button>
          </>
        )}

        {status === 'error' && error && (
          <div className="flex items-center gap-1.5 pl-2 pr-2.5 py-0.5 rounded-lg bg-lossy/15 text-lossy-text font-semibold border-2 border-lossy/40 text-xs">
            <ShieldAlert
              className="w-3.5 h-3.5 text-lossy shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="truncate max-w-[200px]" title={error.message}>
              {error.message}
            </span>
          </div>
        )}

        {status === 'processing' && (
          <button
            type="button"
            onClick={handleCancelClick}
            aria-label={`Cancel ${job.name}`}
            className="w-8 h-8 flex items-center justify-center rounded-[6px] relative after:absolute after:inset-[-6px] after:content-[''] text-muted hover:text-lossy transition-[color,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}

        {status === 'error' && (
          <button
            type="button"
            onClick={handleRetryClick}
            aria-label={`Retry ${job.name}`}
            className="w-8 h-8 flex items-center justify-center rounded-[6px] relative after:absolute after:inset-[-6px] after:content-[''] text-muted hover:text-accent transition-[color,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <RotateCw className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </div>
      </div>

      {/* Active Processing Scanning Beam / Progress Strip */}
      {status === 'processing' && (
        <div className="w-full flex flex-col gap-1.5 pt-2 border-t-2 border-comic-cyan/20">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-comic-cyan font-bold flex items-center gap-1.5">
              <RotateCw className="w-3 h-3 animate-spin text-comic-cyan" strokeWidth={2.2} />
              <span>Crunching via WASM SIMD...</span>
            </span>
            <span className="text-muted text-[10px] uppercase font-bold tracking-wider">Active Worker</span>
          </div>
          <div className="w-full h-2 bg-canvas rounded-full overflow-hidden border border-border p-0.5">
            <div className="h-full bg-gradient-to-r from-comic-cyan via-comic-pink to-comic-yellow rounded-full animate-pulse w-3/4 shadow-sm" />
          </div>
        </div>
      )}
    </div>
  );
};
