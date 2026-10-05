import React, { useState } from 'react';
import { Download, AlertCircle } from '@/icons';
import { usePipelineStore } from '../store/pipelineStore';
import { formatBytes } from '../utils/format';
import { downloadImageJob } from '../utils/download';
import { arcadeAudio } from '../utils/arcadeAudio';

export const DownloadActions: React.FC = () => {
  const { jobs, isZipping, zipProgress, zipError, exportZip } = usePipelineStore();
  const [error, setError] = useState<string | null>(null);
  const ready = jobs.filter((j) => j.status === 'done' && j.result);
  const pending = jobs.some((j) => j.status === 'processing' || j.status === 'queued');
  const saved = ready.reduce(
    (total, j) => total + Math.max(0, j.originalSize - j.result!.finalSize),
    0,
  );
  if (!ready.length) return null;
  const handleDownload = async () => {
    setError(null);
    arcadeAudio.playVictory();
    if (ready.length > 1) {
      void exportZip();
      return;
    }
    try {
      await downloadImageJob(ready[0]!);
    } catch {
      setError('Could not start your download. Try again.');
    }
  };
  return (
    <section aria-label="Download your images" className="download-area">
      {(error || zipError) && (
        <p role="alert" className="mb-3 flex items-start gap-2 text-sm text-lossy-text text-pretty">
          <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
          {error || zipError}
        </p>
      )}
      <div className="download-content">
        <div className="download-summary">
          <p className="font-bold text-base tabular-nums">
            {ready.length} {ready.length === 1 ? 'image' : 'images'} ready
            <span className="text-muted font-normal"> · </span>
            <span className="text-savings-text">{formatBytes(saved)} saved</span>
          </p>
          <p className="mt-1 text-xs text-muted text-pretty">
            {ready.length > 1
              ? 'Your images download together in a ZIP file.'
              : 'Your download is ready. Your original stays untouched.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary download-button"
          onClick={handleDownload}
          disabled={isZipping}
        >
          <Download size={20} aria-hidden="true" />
          {isZipping
            ? `Preparing (${zipProgress}%)…`
            : pending
              ? 'Download ready images'
              : ready.length === 1
                ? 'Download image'
                : 'Download images'}
        </button>
      </div>
      {isZipping && (
        <div
          role="progressbar"
          aria-label="Preparing download"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={zipProgress}
          className="progress-track mt-3"
        >
          <div className="progress-fill" style={{ width: `${zipProgress}%` }} />
        </div>
      )}
    </section>
  );
};
