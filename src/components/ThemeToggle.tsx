import React, { useRef } from 'react';
import { Sun, Moon, Laptop } from '@/icons';
import { useThemeStore, type ThemePreference } from '../store/theme';

export const ThemeToggle: React.FC = () => {
  const { preference, setPreference } = useThemeStore();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const options: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
    {
      value: 'light',
      label: 'Light',
      icon: <Sun className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />,
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: <Moon className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />,
    },
    {
      value: 'system',
      label: 'System',
      icon: <Laptop className="w-3.5 h-3.5" strokeWidth={1.75} aria-hidden="true" />,
    },
  ];

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex = currentIndex;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % options.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + options.length) % options.length;
    } else {
      return;
    }

    const nextOption = options[nextIndex];
    if (nextOption) {
      setPreference(nextOption.value);
      buttonsRef.current[nextIndex]?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Theme selection"
      className="inline-flex items-center p-1 rounded-xl border-2 border-border bg-canvas shadow-comic-sm"
    >
      {options.map((opt, idx) => {
        const isSelected = preference === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonsRef.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => setPreference(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`flex items-center gap-1.5 pl-2 pr-2.5 py-1 text-xs font-bold rounded-lg transition-[color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isSelected
                ? 'bg-accent text-accent-contrast shadow-sm'
                : 'text-muted hover:text-text'
            }`}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
