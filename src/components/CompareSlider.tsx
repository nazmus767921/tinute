import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePipelineStore } from '../store/pipelineStore';
import { CompareControls } from './CompareControls';
import { createPreviewUrl } from '../utils/preview';
import { ArrowLeftRight } from '@/icons';

export const CompareSlider: React.FC = () => {
  const { jobs, selectedCompareJobId, setSelectedCompareJobId } = usePipelineStore();
  const selectedJob = jobs.find(
    (j) => j.id === selectedCompareJobId && j.status === 'done' && j.result,
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPos, setSplitPos] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const [origUrl, setOrigUrl] = useState<string | null>(null);
  const [optUrl, setOptUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedJob?.result) return;
    let cancelled = false;
    let revokes: Array<() => void> = [];

    const loadUrls = async () => {
      const origBuf =
        typeof selectedJob.file.arrayBuffer === 'function'
          ? await selectedJob.file.arrayBuffer()
          : await new Response(selectedJob.file).arrayBuffer();
      const orig = await createPreviewUrl(origBuf, selectedJob.result!.originalFormat);
      const opt = await createPreviewUrl(
        selectedJob.result!.outputBuffer,
        selectedJob.result!.outputFormat,
      );

      if (!cancelled) {
        setOrigUrl(orig.url);
        setOptUrl(opt.url);
        revokes = [orig.revoke, opt.revoke];
      } else {
        orig.revoke();
        opt.revoke();
      }
    };

    void loadUrls();
    return () => {
      cancelled = true;
      revokes.forEach((r) => r());
    };
  }, [selectedJob]);

  const updateSplitFromPointer = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setSplitPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).dataset.handle) {
      setIsDraggingSlider(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } else {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      containerRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingSlider) updateSplitFromPointer(e.clientX);
    else if (isPanning)
      setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setSplitPos((p) => Math.max(0, p - 1));
    else if (e.key === 'ArrowRight') setSplitPos((p) => Math.min(100, p + 1));
    else if (e.key === 'PageDown') setSplitPos((p) => Math.max(0, p - 10));
    else if (e.key === 'PageUp') setSplitPos((p) => Math.min(100, p + 10));
    else if (e.key === 'Home') setSplitPos(0);
    else if (e.key === 'End') setSplitPos(100);
    else if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedCompareJobId(null);
    }
  };

  if (!selectedJob?.result || !origUrl || !optUrl) return null;
  const res = selectedJob.result;

  return (
    <section
      aria-label="Before and After Comparison"
      className="w-full rounded-comic overflow-hidden border-2 border-border bg-[#3f3f46] shadow-comic relative select-none"
    >
      <CompareControls
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(4, Number((z + 0.5).toFixed(1))))}
        onZoomOut={() => setZoom((z) => Math.max(0.5, Number((z - 0.5).toFixed(1))))}
        onResetZoom={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        onClose={() => setSelectedCompareJobId(null)}
        qualityScore={res.qualityScore}
        isLossless={res.isLosslessBitExact}
        originalFormat={res.originalFormat}
        outputFormat={res.outputFormat}
        originalSize={selectedJob.originalSize}
        finalSize={res.finalSize}
        savingsPercentage={res.savingsPercentage}
      />

      <div
        ref={containerRef}
        role="slider"
        tabIndex={0}
        aria-label="Image comparison slider"
        aria-valuenow={Math.round(splitPos)}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          setIsDraggingSlider(false);
          setIsPanning(false);
        }}
        className="relative w-full h-[380px] sm:h-[480px] overflow-hidden cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/* Layer 1: Optimized Image (Bottom) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src={optUrl}
            alt="Optimized"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        </div>

        {/* Layer 2: Original Image (Top, split clipped) */}
        <div
          style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <img
            src={origUrl}
            alt="Original"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        </div>

        {/* Split Divider Line & Handle */}
        <div
          data-handle="true"
          style={{ left: `${splitPos}%` }}
          className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] cursor-ew-resize z-10 -ml-[2px]"
        >
          <div
            data-handle="true"
            className="absolute top-1/2 -translate-y-1/2 -left-4 w-8 h-8 rounded-full bg-white text-stone-900 border-2 border-stone-900 shadow-comic-sm flex items-center justify-center text-xs font-bold select-none cursor-ew-resize hover:scale-110 active:scale-95 transition-transform duration-100"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-stone-900" strokeWidth={2.5} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
};
