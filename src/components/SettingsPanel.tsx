import React, { useRef } from 'react';
import { Settings2, SlidersHorizontal } from '@/icons';
import { usePipelineStore } from '../store/pipelineStore';
import type { TargetFormat, OptimizationMode } from '../pipeline/types';
import { arcadeAudio } from '../utils/arcadeAudio';

export const SettingsPanel: React.FC = () => {
  const {
    settings,
    setTargetFormat,
    setMode,
    setQualityTarget,
    setStripMetadata,
    setMaxDimension,
  } = usePipelineStore();

  const modeButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const modes: Array<{ value: OptimizationMode; label: string }> = [
    { value: 'visually-lossless', label: 'Visually Lossless' },
    { value: 'lossless', label: 'Bit-Exact Lossless' },
  ];

  const handleModeKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % modes.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + modes.length) % modes.length;
    } else {
      return;
    }

    const nextMode = modes[nextIndex];
    if (nextMode) {
      arcadeAudio.playClick();
      setMode(nextMode.value);
      modeButtonsRef.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="p-4 bg-surface/95 backdrop-blur-sm rounded-comic border-2 border-border shadow-comic flex flex-col gap-4 text-xs">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b-2 border-border/40 pb-2.5">
        <div className="flex items-center gap-2 text-comic-cyan text-xs font-bold uppercase tracking-wider select-none">
          <Settings2 className="w-4 h-4 text-comic-cyan" strokeWidth={2} aria-hidden="true" />
          <span>Compression Settings</span>
        </div>
        <span className="text-[10px] text-muted uppercase font-bold tracking-wider">Format & Quality</span>
      </div>

      <div className="flex flex-col gap-3.5">
        {/* Target Format */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="target-format-select"
            className="text-muted flex items-center gap-1.5 font-bold text-xs"
          >
            <SlidersHorizontal
              className="w-3.5 h-3.5 text-comic-cyan"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>Target Format:</span>
          </label>
          <select
            id="target-format-select"
            aria-label="Target format"
            value={settings.targetFormat}
            onChange={(e) => {
              arcadeAudio.playClick();
              setTargetFormat(e.target.value as TargetFormat);
            }}
            className="w-full bg-canvas border-2 border-border text-text rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-[border-color,background-color,box-shadow] duration-150 ease-out hover:border-comic-cyan shadow-comic-sm"
          >
            <option value="auto">Auto (Content-Aware)</option>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
            <option value="avif">AVIF</option>
            <option value="jxl">JPEG XL (JXL)</option>
            <option value="gif">GIF</option>
            <option value="tiff">TIFF</option>
            <option value="bmp">BMP</option>
          </select>
        </div>

        {/* Mode Selector */}
        <div className="flex flex-col gap-1.5">
          <span id="mode-selector-label" className="font-bold text-muted text-xs">
            Compression Mode:
          </span>
          <div
            role="radiogroup"
            aria-labelledby="mode-selector-label"
            className="grid grid-cols-2 rounded-xl border-2 border-border p-1 bg-canvas shadow-comic-sm gap-1"
          >
            {modes.map((m, idx) => {
              const isSelected = settings.mode === m.value;
              return (
                <button
                  key={m.value}
                  ref={(el) => {
                    modeButtonsRef.current[idx] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => {
                    arcadeAudio.playClick();
                    setMode(m.value);
                  }}
                  onKeyDown={(e) => handleModeKeyDown(e, idx)}
                  className={`w-full py-1.5 px-2 text-xs rounded-[8px] font-bold text-center transition-[color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    isSelected
                      ? 'bg-accent text-accent-contrast shadow-sm'
                      : 'text-muted hover:text-text hover:bg-surface/50'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Quality Slider */}
        {settings.mode === 'visually-lossless' && (
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-canvas border-2 border-border shadow-comic-sm">
            <div className="flex items-center justify-between">
              <label htmlFor="quality-slider" className="font-bold text-xs text-muted">
                Quality Target:
              </label>
              <span className="font-mono text-xs text-text tabular-nums font-bold px-2 py-0.5 rounded-lg bg-surface border-2 border-border shadow-comic-sm">
                {settings.qualityTarget ?? 80}%
              </span>
            </div>
            <input
              id="quality-slider"
              type="range"
              min="50"
              max="95"
              step="1"
              value={settings.qualityTarget ?? 80}
              onChange={(e) => setQualityTarget(Number(e.target.value))}
              aria-label="Quality score target"
              className="w-full accent-accent cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            <div className="flex items-center justify-between text-[10px] text-muted font-medium">
              <span>50 (Smaller File)</span>
              <span>95 (Max Quality)</span>
            </div>
          </div>
        )}

        {/* Max Dimension Resize */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="max-dim-select" className="font-bold text-xs text-muted">
            Max Dimension:
          </label>
          <select
            id="max-dim-select"
            aria-label="Max dimension resize"
            value={settings.maxDimension ?? 'none'}
            onChange={(e) => {
              arcadeAudio.playClick();
              const val = e.target.value;
              setMaxDimension(val === 'none' ? undefined : Number(val));
            }}
            className="w-full bg-canvas border-2 border-border text-text rounded-xl px-3 py-2 text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-[border-color,background-color,box-shadow] duration-150 ease-out hover:border-comic-cyan shadow-comic-sm"
          >
            <option value="none">Original Size (No resize)</option>
            <option value="3840">3840px (4K Ultra HD)</option>
            <option value="2560">2560px (2K QHD)</option>
            <option value="1920">1920px (1080p Full HD)</option>
            <option value="1280">1280px (720p HD)</option>
          </select>
        </div>

        {/* Metadata Toggle */}
        <label className="flex items-center justify-between p-2.5 rounded-xl bg-canvas border-2 border-border shadow-comic-sm cursor-pointer text-text hover:border-comic-cyan transition-[border-color,background-color] duration-150 select-none group">
          <div className="flex flex-col">
            <span className="font-bold text-xs group-hover:text-comic-cyan transition-colors">Strip GPS & EXIF</span>
            <span className="text-[10px] text-muted">Removes camera & location metadata</span>
          </div>
          <input
            type="checkbox"
            checked={settings.stripMetadata}
            onChange={(e) => {
              arcadeAudio.playClick();
              setStripMetadata(e.target.checked);
            }}
            aria-label="Strip GPS & EXIF"
            className="w-4 h-4 rounded border-2 border-border text-accent focus-visible:ring-2 focus-visible:ring-accent accent-accent cursor-pointer relative after:absolute after:inset-[-6px]"
          />
        </label>
      </div>
    </div>
  );
};
