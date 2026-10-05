import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, X, Award, CheckCircle2 } from '@/icons';
import { formatBytes } from '../utils/format';
import { arcadeAudio } from '../utils/arcadeAudio';

interface CompareControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onClose: () => void;
  qualityScore: number;
  isLossless: boolean;
  originalFormat: string;
  outputFormat: string;
  originalSize: number;
  finalSize: number;
  savingsPercentage: number;
}

export const CompareControls: React.FC<CompareControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onClose,
  qualityScore,
  isLossless,
  originalFormat,
  outputFormat,
  originalSize,
  finalSize,
  savingsPercentage,
}) => {
  const handleZoomIn = () => {
    arcadeAudio.playClick();
    onZoomIn();
  };

  const handleZoomOut = () => {
    arcadeAudio.playClick();
    onZoomOut();
  };

  const handleResetZoom = () => {
    arcadeAudio.playClick();
    onResetZoom();
  };

  const handleClose = () => {
    arcadeAudio.playZap();
    onClose();
  };

  return (
    <>
      {/* Top HUD: Quality Badge & Info */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-20 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Original Label */}
          <span className="px-3 py-1 rounded-xl bg-black/90 backdrop-blur-sm text-white text-xs border-2 border-white/20 shadow-comic-sm font-semibold">
            Original: {originalFormat.toUpperCase()} <span className="font-mono tabular-nums">({formatBytes(originalSize)})</span>
          </span>
        </div>

        {/* Quality Score Badge Pinned in Corner */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div
            title={isLossless ? 'Lossless verification' : 'SSIMULACRA2 Score'}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/90 backdrop-blur-sm text-white text-xs border-2 border-comic-cyan shadow-comic-sm font-semibold"
          >
            {isLossless ? (
              <>
                <CheckCircle2
                  className="w-3.5 h-3.5 text-savings"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                <span>Bit-Exact Lossless (100)</span>
              </>
            ) : (
              <>
                <Award
                  className="w-3.5 h-3.5 text-comic-cyan"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                <span className="font-mono tabular-nums">SSIMULACRA2: {qualityScore.toFixed(1)}/100</span>
              </>
            )}
          </div>

          {/* Optimized Label */}
          <span className="px-3 py-1 rounded-xl bg-black/90 backdrop-blur-sm text-white text-xs border-2 border-white/20 shadow-comic-sm font-semibold">
            Optimized: {outputFormat.toUpperCase()} <span className="font-mono tabular-nums">({formatBytes(finalSize)}, -{savingsPercentage}%)</span>
          </span>

          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close comparison view"
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-black/90 hover:bg-black text-white border-2 border-white/30 transition-[background-color,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-comic-sm"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Bottom Floating Toolbar: Zoom & Pan HUD */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-black/95 backdrop-blur-sm rounded-xl border-2 border-comic-cyan text-white z-20 shadow-comic text-xs font-semibold">
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out"
          disabled={zoom <= 0.5}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/15 disabled:opacity-40 transition-[background-color,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ZoomOut className="w-3.5 h-3.5" strokeWidth={2} />
        </button>

        <span className="font-mono text-xs tabular-nums px-1.5 w-12 text-center font-bold text-comic-cyan">
          {Math.round(zoom * 100)}%
        </span>

        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in"
          disabled={zoom >= 4}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/15 disabled:opacity-40 transition-[background-color,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ZoomIn className="w-3.5 h-3.5" strokeWidth={2} />
        </button>

        <div className="w-[1.5px] h-4 bg-white/20 mx-0.5" aria-hidden="true" />

        <button
          type="button"
          onClick={handleResetZoom}
          aria-label="Reset zoom to fit"
          className="pl-2 pr-2.5 py-0.5 rounded-lg hover:bg-white/15 text-xs font-bold transition-[background-color,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Maximize2 className="w-3 h-3 text-comic-cyan" strokeWidth={2} aria-hidden="true" />
          <span>Fit</span>
        </button>
      </div>
    </>
  );
};
