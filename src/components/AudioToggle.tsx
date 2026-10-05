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
      className="btn btn-quiet min-w-11 px-3"
      aria-pressed={!isMuted}
    >
      {isMuted ? (
        <VolumeX className="w-4 h-4 text-muted" strokeWidth={2} aria-hidden="true" />
      ) : (
        <Volume2 className="w-4 h-4 text-comic-cyan" strokeWidth={2} aria-hidden="true" />
      )}
    </button>
  );
};
