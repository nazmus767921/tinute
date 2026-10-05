import React from 'react';
import { usePipelineStore } from '../store/pipelineStore';
import { SettingsPanel } from './SettingsPanel';
import { Dropzone } from './Dropzone';
import { ResultsTable } from './ResultsTable';
import { CompareSlider } from './CompareSlider';
import { ErrorBoundary } from './ErrorBoundary';
import { Zap, Shield, ImageIcon, Layers } from '@/icons';
import { arcadeAudio } from '../utils/arcadeAudio';

export const PipelineWorkspace: React.FC = () => {
  const {
    jobs,
    selectedCompareJobId,
    setSelectedCompareJobId,
    setTargetFormat,
    setMode,
    setQualityTarget,
    setMaxDimension,
  } = usePipelineStore();

  const hasJobs = jobs.length > 0;
  const hasSelectedCompare = Boolean(
    selectedCompareJobId && jobs.some((j) => j.id === selectedCompareJobId && j.status === 'done'),
  );

  const applyPreset = (preset: 'webturbo' | 'avif' | 'lossless' | 'social') => {
    arcadeAudio.playClick();
    if (preset === 'webturbo') {
      setTargetFormat('webp');
      setMode('visually-lossless');
      setQualityTarget(80);
      setMaxDimension(undefined);
    } else if (preset === 'avif') {
      setTargetFormat('avif');
      setMode('visually-lossless');
      setQualityTarget(75);
      setMaxDimension(undefined);
    } else if (preset === 'lossless') {
      setTargetFormat('auto');
      setMode('lossless');
      setMaxDimension(undefined);
    } else if (preset === 'social') {
      setTargetFormat('webp');
      setMode('visually-lossless');
      setQualityTarget(85);
      setMaxDimension(1920);
    }
  };

  return (
    <section aria-labelledby="pipeline-workspace-heading" className="w-full">
      <h2 id="pipeline-workspace-heading" className="sr-only">
        Image Optimization Workspace
      </h2>

      {/* Studio Deck Layout with Stretched Heights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Main Stage: Dropzone (8 cols) */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <ErrorBoundary fallbackTitle="Dropzone Error">
            <Dropzone compact={false} />
          </ErrorBoundary>
        </div>

        {/* Right Rack: Tuning Deck & Arcade Presets (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
          {/* Global Settings Panel */}
          <ErrorBoundary fallbackTitle="Settings Error">
            <SettingsPanel />
          </ErrorBoundary>

          {/* Quick Presets */}
          <div className="p-4 bg-surface/95 backdrop-blur-sm rounded-comic border-2 border-border shadow-comic flex flex-col gap-3.5 flex-1">
            <div className="flex items-center justify-between border-b-2 border-border/40 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-comic-cyan flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-comic-cyan" strokeWidth={2} aria-hidden="true" />
                <span>Quick Presets</span>
              </span>
              <span className="text-[10px] text-muted uppercase font-bold tracking-wider">1-Click Apply</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => applyPreset('webturbo')}
                className="p-3 rounded-xl bg-canvas hover:bg-surface border-2 border-border hover:border-comic-yellow text-left shadow-comic-sm transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none active:scale-[0.96] motion-reduce:transform-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-text group-hover:text-comic-yellow">
                  <Zap className="w-3.5 h-3.5 text-comic-yellow" strokeWidth={2.2} aria-hidden="true" />
                  <span>Web Turbo</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  WebP @ 80Q, EXIF stripped
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('avif')}
                className="p-3 rounded-xl bg-canvas hover:bg-surface border-2 border-border hover:border-comic-pink text-left shadow-comic-sm transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none active:scale-[0.96] motion-reduce:transform-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-text group-hover:text-comic-pink">
                  <Layers className="w-3.5 h-3.5 text-comic-pink" strokeWidth={2.2} aria-hidden="true" />
                  <span>Ultra AVIF</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  AVIF @ 75Q, max ratio
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('lossless')}
                className="p-3 rounded-xl bg-canvas hover:bg-surface border-2 border-border hover:border-savings text-left shadow-comic-sm transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none active:scale-[0.96] motion-reduce:transform-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-text group-hover:text-savings">
                  <Shield className="w-3.5 h-3.5 text-savings" strokeWidth={2.2} aria-hidden="true" />
                  <span>Bit-Exact</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  Lossless hash verified
                </p>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('social')}
                className="p-3 rounded-xl bg-canvas hover:bg-surface border-2 border-border hover:border-comic-cyan text-left shadow-comic-sm transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-none active:scale-[0.96] motion-reduce:transform-none group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-text group-hover:text-comic-cyan">
                  <ImageIcon className="w-3.5 h-3.5 text-comic-cyan" strokeWidth={2.2} aria-hidden="true" />
                  <span>Social 1080p</span>
                </div>
                <p className="text-[11px] text-muted mt-1 leading-snug">
                  1920px clamp, WebP 85Q
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Before / After Comparison Slider (When an optimized image is selected) */}
      {hasSelectedCompare && (
        <div className="mt-6">
          <ErrorBoundary
            fallbackTitle="Image Comparison Error"
            onReset={() => setSelectedCompareJobId(null)}
          >
            <CompareSlider />
          </ErrorBoundary>
        </div>
      )}

      {/* High-Score Results Queue */}
      {hasJobs && (
        <div className="mt-6">
          <ErrorBoundary fallbackTitle="Results Queue Error">
            <ResultsTable />
          </ErrorBoundary>
        </div>
      )}
    </section>
  );
};
