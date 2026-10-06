import React, { useRef, useState } from 'react';
import { UploadCloud, ShieldCheck, ImageIcon } from '@/icons';
import { usePipelineStore } from '../store/pipelineStore';
import { ByteBot } from './ByteBot';
import { arcadeAudio } from '../utils/arcadeAudio';

export const Dropzone: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pet, setPet] = useState(false);
  const addFiles = usePipelineStore((s) => s.addFiles);
  const label = compact ? 'Add more images' : 'Choose images';
  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    arcadeAudio.playInsertCoin();
    void addFiles(Array.from(files));
  };
  return (
    <section
      aria-label="Add images"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={
        compact
          ? `add-more ${dragging ? 'ring-2 ring-accent' : ''}`
          : `upload-stage ${dragging ? 'ring-2 ring-accent bg-accent/5' : ''}`
      }
    >
      <input
        ref={input}
        type="file"
        multiple
        aria-label={label}
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/avif,image/jxl,image/gif,image/heic,image/heif,image/tiff,image/bmp,image/svg+xml,.jpg,.jpeg,.png,.webp,.avif,.jxl,.gif,.heic,.heif,.tiff,.tif,.bmp,.svg"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {!compact && (
        <>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-border bg-comic-yellow px-3 py-1 text-xs font-bold text-comic-ink shadow-comic-sm">
            <ImageIcon size={14} strokeWidth={2} aria-hidden="true" /> LITTLE FILES. BIG
            POSSIBILITIES.
          </div>
          <h1 className="mt-6 text-[clamp(1.75rem,9vw,2.5rem)] leading-[1.08] font-bold tracking-[-0.05em] text-balance sm:text-6xl">
            Smaller images.
            <br />
            <span className="hero-personality">Big personality.</span>
          </h1>
          <p className="mt-5 max-w-sm text-base text-muted text-pretty leading-relaxed sm:max-w-md sm:text-lg">
            Choose your images. Tinute makes them smaller automatically.
          </p>
          <div className="mascot-stage" aria-hidden="true">
            <div className="mascot-orbit" />
            <div
              className="mascot-sticker transition-[transform,box-shadow] duration-200 ease-out hover:-rotate-3 hover:scale-105 active:scale-[0.96] cursor-pointer motion-reduce:transform-none select-none"
              onClick={(e) => {
                e.stopPropagation();
                arcadeAudio.playClick();
                setPet(true);
                window.setTimeout(() => setPet(false), 1600);
              }}
              title="Click ByteBot!"
            >
              <ByteBot size="lg" mood={dragging ? 'hungry' : pet ? 'wink' : 'idle'} />
            </div>
            <span className="mascot-caption">
              {dragging ? 'Drop them here!' : pet ? 'Beep boop! Ready!' : 'Big pixels. Tiny bites.'}
            </span>
          </div>
        </>
      )}
      <button
        type="button"
        className={compact ? 'btn btn-secondary' : 'btn btn-primary upload-button'}
        onClick={() => {
          arcadeAudio.playClick();
          input.current?.click();
        }}
      >
        <UploadCloud size={20} strokeWidth={2} aria-hidden="true" /> {label}
      </button>
      {!compact && (
        <>
          <p className="mt-3 text-sm text-muted text-pretty">
            <span className="hidden sm:inline">or drop them here · </span>Up to 100 images · 50 MB
            each · 100 MB total
          </p>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted text-pretty">
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" /> Images stay on your
            device.
          </p>
          <p className="mt-2 text-xs text-muted text-pretty">
            Photos, screenshots, and more. No sign-up needed.
          </p>
        </>
      )}
    </section>
  );
};
