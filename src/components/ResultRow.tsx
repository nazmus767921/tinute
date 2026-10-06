import { createPreviewUrl } from '../utils/preview';
import React, { useState, useEffect } from 'react';
import {
  FileImage,
  CheckCircle2,
  AlertCircle,
  Download,
  Columns,
  RotateCw,
  X,
  ChevronDown,
} from '@/icons';
import type { ImageJob } from '../store/pipelineStore';
import { formatBytes } from '../utils/format';
import { downloadImageJob } from '../utils/download';

interface ResultRowProps {
  job: ImageJob;
  isSelectedForCompare: boolean;
  onSelectCompare: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}
export const ResultRow: React.FC<ResultRowProps> = React.memo(
  ({ job, onSelectCompare, onCancel, onRetry }) => {
    const [thumbnail, setThumbnail] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const { status, result, error } = job;
    useEffect(() => {
      const controller = new AbortController();
      let revoke: (() => void) | undefined;
      void createPreviewUrl(
        job.file,
        job.file.type === 'image/jpeg' ? 'jpeg' : 'png',
        96,
        controller.signal,
      )
        .then((preview) => {
          if (controller.signal.aborted) preview.revoke();
          else {
            revoke = preview.revoke;
            setThumbnail(preview.url);
          }
        })
        .catch(() => {});
      return () => {
        controller.abort();
        revoke?.();
      };
    }, [job.file]);
    const download = async () => {
      setDownloadError(null);
      try {
        await downloadImageJob(job);
      } catch {
        setDownloadError('Could not start your download. Try again.');
      }
    };
    const ready = status === 'done' && result;
    return (
      <article aria-label={job.name} className="result-card">
        <div className="result-main">
          <div className="result-identity">
            <div className="result-thumb" aria-hidden="true">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="image-outline h-full w-full object-cover"
                  onError={() => setThumbnail(null)}
                />
              ) : (
                <FileImage size={24} className="text-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold text-balance break-words [overflow-wrap:anywhere]">
                {job.name}
              </h3>
              <p className="mt-1 text-xs sm:text-sm text-muted tabular-nums">
                {formatBytes(job.originalSize)}
                {ready && (
                  <>
                    {' '}
                    <span aria-label="to">→</span>{' '}
                    <span className="font-semibold text-text">{formatBytes(result.finalSize)}</span>
                  </>
                )}
              </p>
              <p
                className={`mt-2 inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold ${ready ? 'text-savings-text' : 'text-muted'}`}
              >
                {ready && <CheckCircle2 size={16} aria-hidden="true" />}
                {ready
                  ? result.neverBiggerTriggered
                    ? result.metadataSanitized
                      ? 'Already small — private details removed'
                      : 'Already small — original kept'
                    : result.savingsPercentage < 0
                      ? 'Saved with your settings · larger file'
                      : `${result.savingsPercentage}% smaller`
                  : status === 'queued'
                    ? 'Waiting'
                    : status === 'processing'
                      ? 'Making smaller'
                      : status === 'cancelled'
                        ? 'Stopped'
                        : 'Couldn’t process'}
              </p>
            </div>
          </div>
          <div className="result-actions">
            {ready && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-label={`Download ${job.name}`}
                  onClick={download}
                >
                  <Download size={16} aria-hidden="true" />
                  Download
                </button>
                <button
                  type="button"
                  className="btn btn-quiet"
                  aria-label={`Compare ${job.name}`}
                  onClick={() => onSelectCompare(job.id)}
                >
                  <Columns size={16} aria-hidden="true" />
                  Compare
                </button>
              </>
            )}
            {(status === 'error' || status === 'cancelled') && (
              <button
                type="button"
                className="btn btn-secondary"
                aria-label={`Try again ${job.name}`}
                onClick={() => onRetry(job.id)}
              >
                <RotateCw size={16} aria-hidden="true" />
                Try again
              </button>
            )}
            {(status === 'processing' || status === 'queued') && (
              <button
                type="button"
                className="btn btn-quiet"
                aria-label={`Stop ${job.name}`}
                onClick={() => onCancel(job.id)}
              >
                <X size={16} aria-hidden="true" />
                Stop
              </button>
            )}
          </div>
        </div>
        {status === 'error' && error && (
          <p role="alert" className="result-warning">
            <AlertCircle size={18} aria-hidden="true" />
            <span>
              {error.message}{' '}
              {error.code === 'FILE_TOO_LARGE'
                ? 'Choose an image under 50 MB.'
                : 'Try again, or choose another image.'}
            </span>
          </p>
        )}
        {result?.generationalLossWarning && (
          <p className="result-warning">
            <AlertCircle size={18} aria-hidden="true" />
            <span>
              This image was compressed before. Compressing it again may reduce detail. Compare it
              before downloading.
            </span>
          </p>
        )}
        {downloadError && (
          <p role="alert" className="result-warning">
            <AlertCircle size={18} aria-hidden="true" />
            {downloadError}
          </p>
        )}
        {ready && (
          <details className="result-details">
            <summary className="flex min-h-11 cursor-pointer items-center gap-1.5 text-xs text-muted list-none">
              Details
              <ChevronDown size={14} className="disclosure-chevron" aria-hidden="true" />
            </summary>
            <div className="pb-3 text-xs text-muted space-y-1 text-pretty">
              <p>
                {result.originalFormat.toUpperCase()} → {result.outputFormat.toUpperCase()}
              </p>
              <p className="tabular-nums">
                {result.isLosslessBitExact
                  ? 'Every detail preserved · bit-exact lossless'
                  : result.qualityVerified === false
                    ? 'High-quality compression · compare before downloading'
                    : `Quality score: ${result.qualityScore.toFixed(1)} / 100`}
              </p>
            </div>
          </details>
        )}
      </article>
    );
  },
);
