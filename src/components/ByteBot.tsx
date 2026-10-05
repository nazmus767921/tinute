import React from 'react';

export type ByteBotMood = 'idle' | 'hungry' | 'crunching' | 'celebrating' | 'error';

interface ByteBotProps {
  mood?: ByteBotMood;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ByteBot: React.FC<ByteBotProps> = ({ mood = 'idle', size = 'md', className = '' }) => {
  const dimensions = {
    sm: { width: 36, height: 36 },
    md: { width: 72, height: 72 },
    lg: { width: 120, height: 120 },
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center select-none ${className}`}
      style={{ width: dimensions.width, height: dimensions.height }}
      role="img"
      aria-label={`ByteBot 3000 (${mood} state)`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm transition-transform duration-300 ease-out"
      >
        {/* Antenna */}
        <g className="origin-bottom transition-transform duration-300">
          <line
            x1="50"
            y1="22"
            x2="50"
            y2="10"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="text-muted/80"
          />
          <circle
            cx="50"
            cy="8"
            r={mood === 'hungry' || mood === 'crunching' ? 5.5 : 4}
            className={`transition-[fill,r] duration-300 ${
              mood === 'hungry'
                ? 'fill-arcade-pink motion-safe:animate-ping'
                : mood === 'crunching'
                  ? 'fill-arcade-yellow motion-safe:animate-pulse'
                  : mood === 'celebrating'
                    ? 'fill-savings'
                    : 'fill-arcade-cyan'
            }`}
          />
          <circle
            cx="50"
            cy="8"
            r={mood === 'hungry' ? 5.5 : 4}
            className={`${
              mood === 'hungry'
                ? 'fill-arcade-pink'
                : mood === 'crunching'
                  ? 'fill-arcade-yellow'
                  : mood === 'celebrating'
                    ? 'fill-savings'
                    : 'fill-arcade-cyan'
            }`}
          />
        </g>

        {/* Ear Bolts / Bolts on side */}
        <rect
          x="13"
          y="41"
          width="6"
          height="18"
          rx="3"
          fill="currentColor"
          stroke="var(--color-border)"
          strokeWidth="2"
          className="text-surface"
        />
        <rect
          x="81"
          y="41"
          width="6"
          height="18"
          rx="3"
          fill="currentColor"
          stroke="var(--color-border)"
          strokeWidth="2"
          className="text-surface"
        />

        {/* Robot CRT Head Casing - Comic Chunky Shape */}
        <rect
          x="17"
          y="21"
          width="66"
          height="58"
          rx="16"
          fill="currentColor"
          className="text-surface transition-colors duration-200"
        />
        <rect
          x="17"
          y="21"
          width="66"
          height="58"
          rx="16"
          stroke="var(--color-border)"
          strokeWidth="3.5"
          className="transition-colors duration-200"
        />

        {/* CRT Screen Display with Comic Inset */}
        <rect
          x="23"
          y="27"
          width="54"
          height="46"
          rx="11"
          className={`transition-colors duration-200 ${
            mood === 'celebrating'
              ? 'fill-[#0d2218] dark:fill-[#081a12]'
              : 'fill-[#12141c] dark:fill-[#08090d]'
          }`}
        />
        <rect
          x="23"
          y="27"
          width="54"
          height="46"
          rx="11"
          stroke="var(--color-border)"
          strokeWidth="2"
          className="opacity-70"
        />

        {/* Glossy cartoon screen glare */}
        <path
          d="M27 32 Q50 35 73 32"
          stroke="#ffffff"
          strokeOpacity="0.15"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Cute Comic Cheek Blush */}
        <ellipse
          cx="30"
          cy="56"
          rx="3.5"
          ry="2"
          className="fill-comic-pink/50 motion-safe:animate-pulse"
        />
        <ellipse
          cx="70"
          cy="56"
          rx="3.5"
          ry="2"
          className="fill-comic-pink/50 motion-safe:animate-pulse"
        />

        {/* Dynamic Expressions */}
        {mood === 'idle' && (
          <g>
            {/* Friendly big cartoon eyes */}
            <circle cx="38" cy="45" r="5.5" className="fill-comic-cyan" />
            <circle cx="62" cy="45" r="5.5" className="fill-comic-cyan" />
            {/* Double Catchlight for cute cartoon shine */}
            <circle cx="40" cy="43" r="2" fill="#ffffff" />
            <circle cx="36.5" cy="46.5" r="1" fill="#ffffff" />
            <circle cx="64" cy="43" r="2" fill="#ffffff" />
            <circle cx="60.5" cy="46.5" r="1" fill="#ffffff" />
            {/* Cute Pixel/Comic Smile */}
            <path
              d="M41 55 Q50 63 59 55"
              stroke="var(--color-comic-cyan)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}

        {mood === 'hungry' && (
          <g>
            {/* Wide sparkling hungry eyes */}
            <ellipse cx="37" cy="42" rx="6.5" ry="7.5" className="fill-comic-pink" />
            <ellipse cx="63" cy="42" rx="6.5" ry="7.5" className="fill-comic-pink" />
            <circle cx="39" cy="39" r="2.8" fill="#ffffff" />
            <circle cx="35" cy="44" r="1.4" fill="#ffffff" />
            <circle cx="65" cy="39" r="2.8" fill="#ffffff" />
            <circle cx="61" cy="44" r="1.4" fill="#ffffff" />
            {/* Big Open Chomping Mouth with Tongue */}
            <ellipse
              cx="50"
              cy="58"
              rx="10"
              ry="8"
              className="fill-comic-pink/30 stroke-comic-pink stroke-2"
            />
            <path d="M45 61 Q50 56 55 61" fill="var(--color-comic-pink)" opacity="0.8" />
            {/* Little pixel teeth */}
            <rect x="46" y="51" width="3" height="3" fill="#ffffff" rx="1" />
            <rect x="51" y="51" width="3" height="3" fill="#ffffff" rx="1" />
          </g>
        )}

        {mood === 'crunching' && (
          <g>
            {/* Squinting focused laser comic eyes */}
            <path
              d="M33 46 L43 42"
              stroke="var(--color-comic-yellow)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M67 46 L57 42"
              stroke="var(--color-comic-yellow)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Chomping Zigzag Mouth */}
            <path
              d="M38 58 L43 53 L48 58 L53 53 L58 58 L62 53"
              stroke="var(--color-comic-yellow)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Comic sparks */}
            <polygon
              points="28,34 30,37 33,37 31,39 32,42 29,40 27,42 28,39 25,37 28,37"
              className="fill-comic-yellow motion-safe:animate-ping"
            />
            <polygon
              points="72,34 74,37 77,37 75,39 76,42 73,40 71,42 72,39 69,37 72,37"
              className="fill-comic-yellow motion-safe:animate-ping"
            />
          </g>
        )}

        {mood === 'celebrating' && (
          <g>
            {/* 8-bit Cool Sunglasses */}
            <polygon
              points="30,40 47,40 45,50 32,50"
              fill="#000000"
              stroke="var(--color-savings)"
              strokeWidth="1.5"
            />
            <polygon
              points="53,40 70,40 68,50 55,50"
              fill="#000000"
              stroke="var(--color-savings)"
              strokeWidth="1.5"
            />
            <line x1="47" y1="44" x2="53" y2="44" stroke="var(--color-savings)" strokeWidth="2" />
            {/* Glint on sunglasses */}
            <line
              x1="33"
              y1="43"
              x2="38"
              y2="43"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="56"
              y1="43"
              x2="61"
              y2="43"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Confident grin */}
            <path
              d="M40 58 Q50 66 60 58"
              stroke="var(--color-savings)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            {/* Sparkle star */}
            <polygon
              points="72,32 74,35 77,35 75,37 76,40 73,38 71,40 72,37 69,35 72,35"
              fill="var(--color-savings)"
            />
          </g>
        )}

        {mood === 'error' && (
          <g>
            {/* X_X Spiral / Cross Eyes */}
            <line
              x1="35"
              y1="41"
              x2="43"
              y2="49"
              stroke="var(--color-lossy)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1="43"
              y1="41"
              x2="35"
              y2="49"
              stroke="var(--color-lossy)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1="57"
              y1="41"
              x2="65"
              y2="49"
              stroke="var(--color-lossy)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1="65"
              y1="41"
              x2="57"
              y2="49"
              stroke="var(--color-lossy)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Wobbly mouth */}
            <path
              d="M40 59 Q45 55 50 59 T60 59"
              stroke="var(--color-lossy)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
