import React from 'react';
import { usePipelineStore } from '../store/pipelineStore';
import type { TargetFormat } from '../pipeline/types';
import { RotateCw } from '@/icons';
import { Select, Checkbox, RadioGroup, Slider } from './ui/controls';

export const SettingsPanel: React.FC = () => {
  const {
    settings,
    setTargetFormat,
    setMode,
    setQualityTarget,
    setStripMetadata,
    setMaxDimension,
    resetSettings,
  } = usePipelineStore();
  return (
    <div className="settings-panel">
      <p className="text-sm text-muted text-pretty">
        You’re in control. The recommended settings work well for most images.
      </p>
      <p className="mt-1 text-sm font-medium text-pretty">Applies to images you add next.</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <Select
            label="Output format"
            value={settings.targetFormat}
            onValueChange={setTargetFormat}
            options={[
              { value: 'auto' as TargetFormat, label: 'Automatic (recommended)' },
              ...['jpeg', 'png', 'webp', 'avif', 'jxl', 'gif', 'tiff', 'bmp'].map((format) => ({
                value: format as TargetFormat,
                label: format === 'jxl' ? 'JPEG XL' : format.toUpperCase(),
              })),
            ]}
          />
          <p className="field-help">Automatic chooses a suitable format for each image.</p>
        </div>
        <div>
          <Select
            label="Image dimensions"
            value={String(settings.maxDimension ?? 'none')}
            onValueChange={(value) => setMaxDimension(value === 'none' ? undefined : Number(value))}
            options={[
              { value: 'none', label: 'Keep original dimensions' },
              ...[1280, 1920, 2560, 3840].map((size) => ({
                value: String(size),
                label: `Up to ${size} px`,
              })),
            ]}
          />
          <p className="field-help">Limits the longest side. Smaller images stay unchanged.</p>
        </div>
        <RadioGroup
          label="Compression style"
          value={settings.mode}
          onValueChange={setMode}
          options={[
            {
              value: 'visually-lossless',
              label: 'Smaller file, same look',
              description: 'Visually lossless · recommended',
            },
            {
              value: 'lossless',
              label: 'Keep every detail',
              description: 'Bit-exact lossless · may save less space',
            },
          ]}
        />
        {settings.mode === 'visually-lossless' && (
          <div>
            <div className="field-label flex justify-between gap-3">
              Quality <span className="tabular-nums">{settings.qualityTarget ?? 80}</span>
            </div>
            <Slider
              label="Quality"
              min={1}
              value={settings.qualityTarget ?? 80}
              onValueChange={setQualityTarget}
            />
            <p className="field-help">
              Higher values favor detail. Lower values favor smaller files.
            </p>
          </div>
        )}
      </div>
      <div className="mt-5">
        <Checkbox
          label="Remove location and camera details"
          description="Removes private metadata, even if the result needs a larger file."
          checked={settings.stripMetadata}
          onCheckedChange={setStripMetadata}
        />
      </div>
      <button type="button" className="btn btn-secondary mt-5" onClick={resetSettings}>
        <RotateCw size={16} aria-hidden="true" /> Reset to recommended
      </button>
    </div>
  );
};
