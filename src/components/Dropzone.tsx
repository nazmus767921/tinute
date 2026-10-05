import React, { useRef, useState } from 'react';
import { UploadCloud, Zap, CheckCircle2 } from '@/icons';
import { usePipelineStore } from '../store/pipelineStore';
import { ByteBot, type ByteBotMood } from './ByteBot';
import { arcadeAudio } from '../utils/arcadeAudio';

interface DropzoneProps {
  compact?: boolean;
}

export const Dropzone: React.FC<DropzoneProps> = ({ compact = false }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { addFiles, isProcessing, jobs, cancelAll } = usePipelineStore();

  const totalJobs = jobs.length;
  const hasJobs = totalJobs > 0;
  const completedJobs = jobs.filter((j) => j.status === 'done').length;
  const failedJobs = jobs.filter((j) => j.status === 'error').length;
  const inFlightJobs = jobs.filter((j) => j.status === 'processing');
  const activeJob = inFlightJobs[0];
  const progressPercent = totalJobs > 0 ? Math.round(((completedJobs + failedJobs) / totalJobs) * 100) : 0;
  const allCompleted = totalJobs > 0 && completedJobs + failedJobs === totalJobs;

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    arcadeAudio.playInsertCoin();
    const files = Array.from(fileList);
    void addFiles(files);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      arcadeAudio.playClick();
      fileInputRef.current?.click();
    }
  };

  const acceptedTypes =
    'image/jpeg,image/png,image/webp,image/avif,image/jxl,image/gif,image/heic,image/heif,image/tiff,image/bmp,image/svg+xml,.jpg,.jpeg,.png,.webp,.avif,.jxl,.gif,.heic,.heif,.tiff,.tif,.bmp,.svg';

  // Determine ByteBot Mood & Speech Bubble Text (Human-friendly, emoji-free)
  let mood: ByteBotMood = 'idle';
  let speechText = 'Drop your images here to compress them in seconds!';

  if (isDragging) {
    mood = 'hungry';
    speechText = 'Release to drop your images!';
  } else if (isProcessing) {
    mood = 'crunching';
    speechText = `Optimizing ${activeJob?.name ?? 'images'}...`;
  } else if (allCompleted) {
    mood = 'celebrating';
    speechText = 'All done! Your compressed images are ready.';
  } else if (failedJobs > 0) {
    mood = 'error';
    speechText = 'Some images could not be processed. Check details below.';
  }

  if (compact) {
    return (
      <div
        tabIndex={0}
        role="region"
        aria-label="Add more images"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => {
          arcadeAudio.playClick();
          fileInputRef.current?.click();
        }}
        onKeyDown={onKeyDown}
        className={`border-2 border-dashed rounded-card p-3.5 bg-surface/95 backdrop-blur-sm flex items-center justify-between gap-3 text-xs transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          isDragging
            ? 'border-accent bg-accent/10 shadow-comic'
            : 'border-border/80 hover:border-comic-cyan hover:shadow-comic-sm'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={onFileChange}
          className="hidden"
          aria-label="Add more images"
        />
        <div className="flex items-center gap-3 text-muted group-hover:text-text transition-colors duration-150">
          <ByteBot size="sm" mood={mood} />
          <div>
            <span className="font-semibold text-text text-pretty">
              Drop more images here, or click to add
            </span>
            <span className="text-xs text-muted block sm:inline sm:ml-2">
              (ByteBot is hungry for more snacks!)
            </span>
          </div>
        </div>
        <span className="font-mono text-[11px] px-2.5 py-1 rounded-[6px] bg-canvas border-2 border-border text-muted tabular-nums font-semibold shadow-comic-sm">
          Max 50MB
        </span>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Image dropzone"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => {
        arcadeAudio.playClick();
        fileInputRef.current?.click();
      }}
      onKeyDown={onKeyDown}
      className={`relative overflow-hidden border-[2.5px] border-dashed rounded-comic p-6 sm:p-10 bg-surface/95 backdrop-blur-md flex flex-col items-center justify-center text-center transition-[border-color,background-color,transform,box-shadow] duration-150 ease-out cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent h-full min-h-[380px] w-full flex-1 ${
        isDragging
          ? 'border-accent bg-accent/5 scale-[1.005] shadow-comic-lg'
          : isProcessing
            ? 'border-comic-cyan/80 bg-comic-cyan/[0.04] shadow-comic'
            : 'border-border/80 hover:border-comic-cyan hover:shadow-comic'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={onFileChange}
        className="hidden"
        aria-label="File upload input"
      />

      {/* Corner Badges */}
      <div className="absolute top-3.5 left-3.5 text-[11px] font-bold text-comic-cyan uppercase tracking-wider pointer-events-none select-none flex items-center gap-1">
        <span>Image Dropzone</span>
      </div>
      <div className="absolute top-3.5 right-3.5 text-[11px] font-bold text-comic-pink uppercase tracking-wider pointer-events-none select-none">
        {isProcessing ? 'Optimizing' : '100% Private'}
      </div>
      <div className="absolute bottom-3 left-3.5 text-[10px] text-muted/70 font-semibold tracking-wider uppercase pointer-events-none select-none hidden sm:block">
        Private & Secure
      </div>
      <div className="absolute bottom-3 right-3.5 text-[10px] text-muted/70 font-semibold tracking-wider uppercase pointer-events-none select-none hidden sm:block">
        Runs In Browser
      </div>

      {/* Comic Speech Bubble */}
      <div className="relative mb-2 transition-transform duration-200">
        <div
          className={`px-4 py-1.5 rounded-2xl text-xs font-bold border-2 transition-colors duration-200 flex items-center gap-1.5 shadow-comic-sm ${
            isDragging
              ? 'bg-comic-pink text-white border-border animate-pulse'
              : isProcessing
                ? 'bg-comic-yellow text-stone-900 border-border'
                : 'bg-surface text-text border-border'
          }`}
        >
          <span>{speechText}</span>
        </div>
        {/* Comic speech bubble tail */}
        <div
          className={`w-3 h-3 rotate-45 mx-auto -mt-1.5 border-r-2 border-b-2 border-border ${
            isDragging
              ? 'bg-comic-pink'
              : isProcessing
                ? 'bg-comic-yellow'
                : 'bg-surface'
          }`}
        />
      </div>

      {/* Center Mascot with Processing Laser Aura */}
      <div
        className={`mb-3 transform transition-transform duration-200 ${
          isProcessing ? 'scale-105 animate-pulse' : 'group-hover:scale-105'
        }`}
      >
        <ByteBot size="lg" mood={mood} />
      </div>

      {/* Live Batch Progress Reactor Bar (When processing) */}
      {isProcessing && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md my-3 p-3.5 rounded-2xl bg-canvas border-2 border-border shadow-comic flex flex-col gap-2 cursor-default"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-comic-cyan font-bold flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-comic-yellow animate-bounce" />
              <span>
                CRUNCHING: {completedJobs} OF {totalJobs} DONE
              </span>
            </span>
            <span className="font-mono font-bold tabular-nums text-text">{progressPercent}%</span>
          </div>

          {/* Animated Candy Progress Track */}
          <div className="w-full h-3.5 bg-surface rounded-full overflow-hidden border-2 border-border p-0.5">
            <div
              className="h-full bg-gradient-to-r from-comic-cyan via-comic-pink to-comic-yellow rounded-full transition-all duration-300 ease-out shadow-sm"
              style={{ width: `${Math.max(6, progressPercent)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted gap-2">
            <span className="truncate text-left text-text/80 font-medium" title={activeJob?.name}>
              {activeJob ? `Optimizing: ${activeJob.name}` : 'Finalizing stream...'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                arcadeAudio.playZap();
                cancelAll();
              }}
              className="text-lossy hover:text-lossy/80 font-bold uppercase transition-colors shrink-0 active:scale-95"
            >
              Abort
            </button>
          </div>
        </div>
      )}

      {/* Celebratory Completion Badge */}
      {!isProcessing && allCompleted && (
        <div className="w-full max-w-md my-2 p-2.5 rounded-2xl bg-savings/15 border-2 border-border shadow-comic text-center">
          <span className="text-savings-text font-bold text-xs flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-savings" />
            <span>ALL {totalJobs} IMAGES CRUNCHED TO PERFECTION!</span>
          </span>
        </div>
      )}

      {/* Dynamic Heading */}
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text mb-2 text-balance">
        {isDragging
          ? 'Release to feed ByteBot!'
          : isProcessing
            ? `Crunching ${activeJob?.name ?? 'images'}...`
            : allCompleted
              ? 'Feed ByteBot more image snacks!'
              : 'Drop images here to convert & optimize'}
      </h2>

      <p className="text-xs text-muted max-w-md mb-5 leading-relaxed text-pretty">
        Supports JPEG, PNG, WebP, AVIF, JXL, GIF, HEIC, TIFF, BMP, and SVG. Fast, private, and runs
        entirely in your browser.
      </p>

      {/* 3D Tactile Comic Push Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            arcadeAudio.playClick();
            fileInputRef.current?.click();
          }}
          aria-label={hasJobs ? 'Browse files to add more images' : 'Browse files'}
          className="min-h-[48px] pl-5 pr-6 py-2.5 bg-accent hover:bg-accent-hover text-accent-contrast rounded-xl text-xs font-bold uppercase tracking-wider border-2 border-border shadow-comic transition-[background-color,transform,box-shadow] duration-150 ease-out active:translate-x-[2px] active:translate-y-[2px] active:shadow-none active:scale-[0.98] motion-reduce:transform-none flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <UploadCloud className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
          <span>{hasJobs ? 'Add More Images' : 'Browse Files'}</span>
        </button>
      </div>

      <span className="text-[10px] text-muted/80 mt-3 font-semibold tracking-wider uppercase select-none">
        PRESS SPACEBAR OR ENTER TO BROWSE
      </span>
    </div>
  );
};
