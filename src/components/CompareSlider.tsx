import { useShallow } from 'zustand/react/shallow';
import React, { useState, useRef, useEffect } from 'react';
import { usePipelineStore } from '../store/pipelineStore';
import { Slider } from './ui/controls';
import { CompareControls } from './CompareControls';
import { readJobBlob } from '../utils/output';
import { createPreviewUrl } from '../utils/preview';
import { formatBytes } from '../utils/format';
import { X, AlertCircle } from '@/icons';

export const CompareSlider: React.FC = () => {
  const { jobs, selectedCompareJobId, setSelectedCompareJobId } = usePipelineStore(
    useShallow((state) => ({
      jobs: state.jobs,
      selectedCompareJobId: state.selectedCompareJobId,
      setSelectedCompareJobId: state.setSelectedCompareJobId,
    })),
  );
  const job = jobs.find((j) => j.id === selectedCompareJobId && j.status === 'done' && j.result);
  const dialog = useRef<HTMLDialogElement>(null);
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [urls, setUrls] = useState<{ original: string; smaller: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const close = () => setSelectedCompareJobId(null);

  useEffect(() => {
    if (!job || !dialog.current) return;
    const trigger = document.activeElement as HTMLElement | null;
    const modal = dialog.current;
    modal.showModal();
    return () => {
      modal.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [job]);

  useEffect(() => {
    if (!job?.result) return;
    let disposed = false;
    const controller = new AbortController();
    const revokes: Array<() => void> = [];
    setUrls(null);
    setFailed(false);
    setZoom(1);
    setSplit(50);
    setPan({ x: 0, y: 0 });
    const load = async () => {
      try {
        const original = await createPreviewUrl(
          job.file,
          job.result!.originalFormat,
          1600,
          controller.signal,
        );
        if (disposed) {
          original.revoke();
          return;
        }
        revokes.push(original.revoke);
        const smaller = await createPreviewUrl(
          await readJobBlob(job),
          job.result!.outputFormat,
          1600,
          controller.signal,
        );
        if (disposed) {
          smaller.revoke();
          return;
        }
        revokes.push(smaller.revoke);
        setUrls({ original: original.url, smaller: smaller.url });
      } catch {
        if (!disposed) setFailed(true);
      }
    };
    void load();
    return () => {
      disposed = true;
      controller.abort();
      revokes.forEach((revoke) => revoke());
    };
  }, [job]);

  if (!job?.result) return null;
  const result = job.result;
  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="compare-heading"
      className="comparison-dialog"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }}
    >
      <div className="comparison-content">
        <header className="comparison-header">
          <div className="min-w-0">
            <h2 id="compare-heading" className="text-lg font-bold text-balance">
              Compare images
            </h2>
            <p className="mt-1 text-xs text-muted break-words [overflow-wrap:anywhere]">
              {job.name}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-quiet shrink-0 px-3"
            aria-label="Close comparison"
            onClick={close}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs sm:text-sm text-muted tabular-nums">
          <span>Original · {formatBytes(job.originalSize)}</span>
          <span>Smaller · {formatBytes(result.finalSize)}</span>
        </div>
        <div className="comparison-image">
          {failed ? (
            <p role="alert" className="m-5 flex max-w-sm items-start gap-2 text-sm text-pretty">
              <AlertCircle size={20} className="shrink-0" aria-hidden="true" />
              Could not load this preview. You can still download your image. Close comparison to
              return to your images.
            </p>
          ) : !urls ? (
            <p role="status" className="text-sm text-muted">
              Loading preview…
            </p>
          ) : (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <img
                  src={urls.smaller}
                  alt="Smaller image"
                  onError={() => setFailed(true)}
                  className="image-outline max-w-full max-h-full object-contain"
                  style={{ transform }}
                />
              </div>
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
              >
                <img
                  src={urls.original}
                  alt="Original image"
                  onError={() => setFailed(true)}
                  className="image-outline max-w-full max-h-full object-contain"
                  style={{ transform }}
                />
              </div>
              <div
                aria-hidden="true"
                className="comparison-divider"
                style={{ left: `${split}%` }}
              />
            </>
          )}
        </div>
        {urls && !failed && (
          <div className="comparison-toolbar">
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="font-semibold text-text">Image comparison</span>
              <span>Original ↔ Smaller</span>
            </div>
            <Slider
              label="Image comparison"
              value={split}
              valueText={`${split}% original image`}
              onValueChange={setSplit}
            />
            <CompareControls
              zoom={zoom}
              onZoomIn={() => setZoom((z) => Math.min(4, z + 0.5))}
              onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.5))}
              onResetZoom={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              onPan={(x, y) => setPan((p) => ({ x: p.x + x, y: p.y + y }))}
            />
            <details className="mt-2">
              <summary className="min-h-11 cursor-pointer text-xs text-muted flex items-center">
                Image details
              </summary>
              <p className="pb-2 text-xs text-muted tabular-nums text-pretty">
                {result.originalFormat.toUpperCase()} → {result.outputFormat.toUpperCase()} ·{' '}
                {result.isLosslessBitExact
                  ? 'Every detail preserved'
                  : result.qualityVerified === false
                    ? 'High-quality compression · compare before downloading'
                    : `Quality score: ${result.qualityScore.toFixed(1)} / 100`}
              </p>
            </details>
          </div>
        )}
      </div>
    </dialog>
  );
};
