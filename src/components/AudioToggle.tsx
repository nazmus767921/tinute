import React, { useState } from 'react';
import { Volume2, VolumeX } from '@/icons';
import { arcadeAudio } from '../utils/arcadeAudio';

export const AudioToggle: React.FC = () => {
  const [isMuted, setIsMuted] = useState(() => arcadeAudio.getMuted());

  const handleToggle = () => {
    const next = arcadeAudio.toggleMute();
    setIsMuted(next);
    if (!next) {
      arcadeAudio.playClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isMuted ? 'Unmute arcade sound effects' : 'Mute arcade sound effects'}
      title={isMuted ? 'Arcade SFX: Off' : 'Arcade SFX: On'}
      className="px-2.5 py-1.5 rounded-xl border-2 border-border bg-canvas hover:bg-surface text-muted hover:text-text transition-[color,background-color,border-color,transform,box-shadow] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none flex items-center gap-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-comic-sm"
    >
      {isMuted ? (
        <VolumeX className="w-4 h-4 text-muted" strokeWidth={2} aria-hidden="true" />
      ) : (
        <Volume2 className="w-4 h-4 text-comic-cyan" strokeWidth={2} aria-hidden="true" />
      )}
      <span className="hidden md:inline">{isMuted ? 'SFX Off' : 'SFX On'}</span>
    </button>
  );
};
