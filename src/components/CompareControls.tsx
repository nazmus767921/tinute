import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, ArrowLeftRight, ChevronDown } from '@/icons';

interface CompareControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onPan: (x: number, y: number) => void;
}
export const CompareControls: React.FC<CompareControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onPan,
}) => (
  <div>
    <div className="flex items-center justify-center gap-2 flex-wrap">
      <button
        type="button"
        className="btn btn-quiet px-3"
        aria-label="Zoom out"
        disabled={zoom <= 0.5}
        onClick={onZoomOut}
      >
        <ZoomOut size={18} aria-hidden="true" />
      </button>
      <span className="w-14 text-center text-sm tabular-nums font-semibold">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className="btn btn-quiet px-3"
        aria-label="Zoom in"
        disabled={zoom >= 4}
        onClick={onZoomIn}
      >
        <ZoomIn size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        aria-label="Reset zoom to fit"
        onClick={onResetZoom}
      >
        <Maximize2 size={16} aria-hidden="true" />
        Fit
      </button>
    </div>
    {zoom > 1 && (
      <div
        className="mt-2 flex items-center justify-center gap-2 flex-wrap"
        aria-label="Move image"
      >
        <button
          type="button"
          className="btn btn-quiet px-3"
          aria-label="Move image left"
          onClick={() => onPan(-40, 0)}
        >
          <ArrowLeftRight size={18} aria-hidden="true" />
          <span className="sr-only">Left</span>
        </button>
        <button
          type="button"
          className="btn btn-quiet px-3"
          aria-label="Move image up"
          onClick={() => onPan(0, -40)}
        >
          <ChevronDown className="rotate-180" size={18} aria-hidden="true" />
          <span className="sr-only">Up</span>
        </button>
        <button
          type="button"
          className="btn btn-quiet px-3"
          aria-label="Move image down"
          onClick={() => onPan(0, 40)}
        >
          <ChevronDown size={18} aria-hidden="true" />
          <span className="sr-only">Down</span>
        </button>
        <button
          type="button"
          className="btn btn-quiet px-3"
          aria-label="Move image right"
          onClick={() => onPan(40, 0)}
        >
          <ArrowLeftRight size={18} aria-hidden="true" />
          <span className="sr-only">Right</span>
        </button>
      </div>
    )}
  </div>
);
