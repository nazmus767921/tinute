import React from 'react';

export type ByteBotMood = 'idle' | 'hungry' | 'crunching' | 'celebrating' | 'wink' | 'error';

export interface ByteBotProps {
  mood?: ByteBotMood;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

export const ByteBot: React.FC<ByteBotProps> = ({
  mood = 'idle',
  size = 'md',
  animated = true,
  className = '',
}) => {
  const dimensions = {
    sm: { width: 36, height: 36 },
    md: { width: 72, height: 72 },
    lg: { width: 120, height: 120 },
  }[size];

  const antennaColor =
    mood === 'hungry'
      ? '#f43f5e'
      : mood === 'crunching'
        ? '#eab308'
        : mood === 'celebrating' || mood === 'wink'
          ? '#facc15'
          : '#00e5ff';

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
        className={`w-full h-full drop-shadow-sm transition-transform duration-300 ease-out ${
          animated ? 'bytebot-alive' : ''
        }`}
      >
        {/* Antenna */}
        <g
          className={`origin-bottom transition-transform duration-300 ${
            animated && mood === 'idle'
              ? 'bytebot-idle-antenna'
              : animated && mood === 'wink'
                ? 'bytebot-wink-antenna'
                : ''
          }`}
        >
          <line
            x1="50"
            y1="22"
            x2="50"
            y2="10"
            stroke="#18181b"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle
            cx="50"
            cy="8"
            r={mood === 'hungry' || mood === 'crunching' ? 5.5 : 4}
            fill={antennaColor}
            className={`transition-[fill,r] duration-300 ${
              mood === 'hungry'
                ? 'motion-safe:animate-ping'
                : mood === 'crunching'
                  ? 'motion-safe:animate-pulse'
                  : ''
            }`}
          />
          <circle cx="50" cy="8" r={mood === 'hungry' ? 5.5 : 4} fill={antennaColor} />
          <circle cx="48.5" cy="6.8" r="1.2" fill="#ffffff" />
        </g>

        {/* Ear Bolts / Bolts on side */}
        <rect
          x="13"
          y="41"
          width="6"
          height="18"
          rx="3"
          fill="#f1f5f9"
          stroke="#18181b"
          strokeWidth="2"
          className={animated && mood === 'idle' ? 'bytebot-idle-ear-l' : ''}
        />
        <rect
          x="81"
          y="41"
          width="6"
          height="18"
          rx="3"
          fill="#f1f5f9"
          stroke="#18181b"
          strokeWidth="2"
          className={animated && mood === 'idle' ? 'bytebot-idle-ear-r' : ''}
        />

        {/* Robot Head Body Group */}
        <g
          className={`bytebot-head-group ${
            animated && mood === 'idle'
              ? 'bytebot-idle-nod'
              : animated && mood === 'hungry'
                ? 'bytebot-hungry-wobble'
                : animated && mood === 'crunching'
                  ? 'bytebot-crunch-vibe'
                  : animated && mood === 'celebrating'
                    ? 'bytebot-celebrate-bounce'
                    : animated && mood === 'wink'
                      ? 'bytebot-wink-head'
                      : animated && mood === 'error'
                        ? 'bytebot-error-tilt'
                        : ''
          }`}
        >
          {/* Robot CRT Head Casing - Canonical White Pop */}
          <rect
            x="17"
            y="21"
            width="66"
            height="58"
            rx="16"
            fill="#ffffff"
            stroke="#18181b"
            strokeWidth="3.5"
          />

          {/* CRT Screen Display with Comic Inset */}
          <rect
            x="23"
            y="27"
            width="54"
            height="46"
            rx="11"
            fill={mood === 'celebrating' ? '#0d2218' : '#12141c'}
            stroke="#18181b"
            strokeWidth="2"
            strokeOpacity="0.7"
          />

          {/* Glossy cartoon screen glare */}
          <path
            d="M27 32 Q50 35 73 32"
            stroke="#ffffff"
            strokeOpacity="0.2"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Cute Comic Cheek Blush */}
          <ellipse
            cx="30"
            cy="56"
            rx="3.5"
            ry="2"
            fill="#f43f5e"
            opacity="0.6"
            className="motion-safe:animate-pulse"
          />
          <ellipse
            cx="70"
            cy="56"
            rx="3.5"
            ry="2"
            fill="#f43f5e"
            opacity="0.6"
            className="motion-safe:animate-pulse"
          />

          {/* Dynamic Expressions */}
          {mood === 'idle' && (
            <g className="bytebot-idle-face">
              {/* Cute Expressive Eyebrows */}
              <g className={animated ? 'bytebot-anim-eyebrows' : 'opacity-0'}>
                <path
                  d="M33 37 Q38 33 43 36"
                  stroke="#18181b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M57 36 Q62 33 67 37"
                  stroke="#18181b"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Expression Layer 1: Round Looking Eyes (Default with organic gaze & blink) */}
              <g className={animated ? 'bytebot-anim-eyes-round' : ''}>
                <g className={animated ? 'bytebot-idle-eyes-look' : ''}>
                  {/* Left eye blinking group */}
                  <g className={animated ? 'bytebot-idle-blink bytebot-eye-left' : ''}>
                    <circle cx="38" cy="45" r="5.5" fill="#00e5ff" />
                    <circle cx="40" cy="43" r="2" fill="#ffffff" />
                    <circle cx="36.5" cy="46.5" r="1" fill="#ffffff" />
                  </g>
                  {/* Right eye */}
                  <g className={animated ? 'bytebot-idle-blink bytebot-eye-right' : ''}>
                    <circle cx="62" cy="45" r="5.5" fill="#00e5ff" />
                    <circle cx="64" cy="43" r="2" fill="#ffffff" />
                    <circle cx="60.5" cy="46.5" r="1" fill="#ffffff" />
                  </g>
                </g>
              </g>

              {/* Expression Layer 2: Playful Wink (reserved for wink or interactive moments) */}
              <g className={animated ? 'bytebot-anim-eye-wink' : 'opacity-0'}>
                <path
                  d="M56 45 Q62 49 68 45"
                  stroke="#00e5ff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Pop Twinkle Star */}
                <polygon
                  points="74,37 75.5,40 78.5,40 76,42 77,45 74.5,43 72,45 73,42 70.5,40 73.5,40"
                  fill="#facc15"
                  stroke="#18181b"
                  strokeWidth="0.8"
                  className={animated ? 'bytebot-anim-wink-sparkle' : ''}
                />
              </g>

              {/* Expression Layer 3: Joyful Anime Crescent Eyes (^ ^) for hover perks */}
              <g className={animated ? 'bytebot-anim-eyes-happy' : 'opacity-0'}>
                <path
                  d="M32 46 Q38 38 44 46"
                  stroke="#00e5ff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M56 46 Q62 38 68 46"
                  stroke="#00e5ff"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Mouth 1: Resting Calm Smile (always steady at idle) */}
              <path
                d="M41 55 Q50 63 59 55"
                stroke="#00e5ff"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                className={animated ? 'bytebot-anim-mouth-smile bytebot-idle-smile' : ''}
              />

              {/* Mouth 2: Curious "O" Mouth */}
              <circle
                cx="50"
                cy="57"
                r="3.5"
                fill="#00e5ff"
                fillOpacity="0.3"
                stroke="#00e5ff"
                strokeWidth="2.5"
                className={animated ? 'bytebot-anim-mouth-o' : 'opacity-0'}
              />

              {/* Mouth 3: Beaming Open Happy Smile (:D) with cute tooth & tongue for hover */}
              <g className={animated ? 'bytebot-anim-mouth-open' : 'opacity-0'}>
                <path
                  d="M42 54 Q50 65 58 54 Z"
                  fill="#00e5ff"
                  fillOpacity="0.35"
                  stroke="#00e5ff"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                <rect x="48.5" y="53" width="3" height="2.5" fill="#ffffff" rx="1" />
                <path d="M46 59 Q50 56 54 59" fill="#f43f5e" />
              </g>

              {/* Mouth 4: Cheeky Side Smirk */}
              <path
                d="M43 57 Q51 64 59 54"
                stroke="#00e5ff"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                className={animated ? 'bytebot-anim-mouth-smirk' : 'opacity-0'}
              />
            </g>
          )}

          {mood === 'wink' && (
            <g className={animated ? 'bytebot-wink-face' : ''}>
              {/* Left eye: wide round sparkler */}
              <circle cx="38" cy="45" r="5.5" fill="#00e5ff" />
              <circle cx="40" cy="43" r="2" fill="#ffffff" />
              <circle cx="36.5" cy="46.5" r="1" fill="#ffffff" />

              {/* Right eye: playful wink arc */}
              <path
                d="M56 45 Q62 49 68 45"
                stroke="#00e5ff"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Twinkling star sparkle */}
              <polygon
                points="74,37 75.5,40 78.5,40 76,42 77,45 74.5,43 72,45 73,42 70.5,40 73.5,40"
                fill="#facc15"
                stroke="#18181b"
                strokeWidth="0.8"
                className={animated ? 'bytebot-anim-wink-sparkle' : ''}
              />

              {/* Cheeky wink smirk */}
              <path
                d="M42 56 Q51 64 60 54"
                stroke="#00e5ff"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          )}

          {mood === 'hungry' && (
            <g className={animated ? 'bytebot-hungry-face' : ''}>
              {/* Eager raised eyebrows */}
              <path
                d="M32 34 Q37 30 42 33"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M58 33 Q63 30 68 34"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Wide sparkling hungry eyes */}
              <ellipse cx="37" cy="43" rx="6.5" ry="7" fill="#f43f5e" />
              <ellipse cx="63" cy="43" rx="6.5" ry="7" fill="#f43f5e" />
              <circle cx="39" cy="40" r="2.8" fill="#ffffff" />
              <circle cx="35" cy="45" r="1.4" fill="#ffffff" />
              <circle cx="65" cy="40" r="2.8" fill="#ffffff" />
              <circle cx="61" cy="45" r="1.4" fill="#ffffff" />
              {/* Big Open Chomping Mouth with Tongue */}
              <g className={animated ? 'bytebot-hungry-mouth' : ''}>
                <ellipse
                  cx="50"
                  cy="58"
                  rx="10"
                  ry="8"
                  fill="#f43f5e"
                  fillOpacity="0.3"
                  stroke="#f43f5e"
                  strokeWidth="2"
                />
                <path d="M45 61 Q50 56 55 61" fill="#f43f5e" opacity="0.8" />
                {/* Little pixel teeth */}
                <rect x="46" y="51" width="3" height="3" fill="#ffffff" rx="1" />
                <rect x="51" y="51" width="3" height="3" fill="#ffffff" rx="1" />
              </g>
            </g>
          )}

          {mood === 'crunching' && (
            <g className={animated ? 'bytebot-crunch-face' : ''}>
              {/* Focused laser comic squint eyes */}
              <path d="M33 46 L43 42" stroke="#eab308" strokeWidth="4" strokeLinecap="round" />
              <path d="M67 46 L57 42" stroke="#eab308" strokeWidth="4" strokeLinecap="round" />
              {/* Chomping Zigzag Mouth */}
              <path
                d="M38 58 L43 53 L48 58 L53 53 L58 58 L62 53"
                stroke="#eab308"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className={animated ? 'bytebot-crunch-mouth' : ''}
              />
              {/* Comic sparks */}
              <polygon
                points="28,34 30,37 33,37 31,39 32,42 29,40 27,42 28,39 25,37 28,37"
                fill="#eab308"
                className="motion-safe:animate-ping"
              />
              <polygon
                points="72,34 74,37 77,37 75,39 76,42 73,40 71,42 72,39 69,37 72,37"
                fill="#eab308"
                className="motion-safe:animate-ping"
              />
            </g>
          )}

          {mood === 'celebrating' && (
            <g className={animated ? 'bytebot-celebrate-face' : ''}>
              {/* Joyful crescent anime eyes (^ ^) */}
              <path
                d="M32 46 Q38 37 44 46"
                stroke="#00e5ff"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M56 46 Q62 37 68 46"
                stroke="#00e5ff"
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Beaming wide open smile (:D) */}
              <g>
                <path
                  d="M41 53 Q50 66 59 53 Z"
                  fill="#00e5ff"
                  fillOpacity="0.35"
                  stroke="#00e5ff"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <rect x="48.5" y="52" width="3" height="2.5" fill="#ffffff" rx="1" />
                <path d="M45 59 Q50 56 55 59" fill="#f43f5e" />
              </g>
              {/* Celebratory golden star sparkles */}
              <polygon
                points="27,33 28.5,36 31.5,36 29,38 30,41 27.5,39 25,41 26,38 23.5,36 26.5,36"
                fill="#facc15"
                className="motion-safe:animate-pulse"
              />
              <polygon
                points="73,33 74.5,36 77.5,36 75,38 76,41 73.5,39 71,41 72,38 69.5,36 72.5,36"
                fill="#facc15"
                className="motion-safe:animate-pulse"
              />
            </g>
          )}

          {mood === 'error' && (
            <g className={animated ? 'bytebot-error-face' : ''}>
              {/* X_X Spiral / Cross Eyes */}
              <line
                x1="35"
                y1="41"
                x2="43"
                y2="49"
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="43"
                y1="41"
                x2="35"
                y2="49"
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="57"
                y1="41"
                x2="65"
                y2="49"
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <line
                x1="65"
                y1="41"
                x2="57"
                y2="49"
                stroke="#ef4444"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Wobbly mouth */}
              <path
                d="M40 59 Q45 55 50 59 T60 59"
                stroke="#ef4444"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};
