import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from '@/icons';

export interface ControlOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}
interface OptionsProps<T extends string> {
  label: string;
  value: T;
  options: ControlOption<T>[];
  onValueChange: (value: T) => void;
}

/** Focus stays on the combobox; active-descendant exposes the highlighted option. */
export function Select<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: OptionsProps<T>) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [active, setActive] = useState(selected);
  const search = useRef({ text: '', time: 0 });
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  useEffect(() => {
    if (open)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open, id]);
  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onValueChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      ref={root}
      className="custom-select"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <span id={`${id}-label`} className="field-label">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className="custom-select-trigger"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open ? `${id}-option-${active}` : undefined}
        onClick={() => {
          setActive(selected);
          setOpen(!open);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
            return;
          }
          if (e.key === 'Tab') {
            const option = options[active];
            if (open && option) onValueChange(option.value);
            setOpen(false);
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (open) commit(active);
            else {
              setActive(selected);
              setOpen(true);
            }
          } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            setOpen(true);
            setActive(
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? options.length - 1
                  : !open
                    ? selected
                    : (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length,
            );
          } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const now = Date.now();
            search.current.text =
              (now - search.current.time > 700 ? '' : search.current.text) + e.key.toLowerCase();
            search.current.time = now;
            const match = options.findIndex((option) =>
              option.label.toLowerCase().startsWith(search.current.text),
            );
            if (match >= 0) {
              setActive(match);
              setOpen(true);
            }
          }
        }}
      >
        <span className="min-w-0 text-left text-pretty">
          {options[selected]?.label ?? 'Choose an option'}
        </span>
        <ChevronDown size={18} aria-hidden="true" className="shrink-0" />
      </button>
      {open && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="custom-select-list"
        >
          {options.map((option, index) => (
            <div
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={value === option.value}
              className="custom-select-option"
              data-active={active === index}
              onPointerMove={() => setActive(index)}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => commit(index)}
            >
              <span>{option.label}</span>
              {value === option.value && (
                <Check size={18} aria-hidden="true" className="shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Checkbox({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-describedby={description ? `${id}-description` : undefined}
      className="custom-choice"
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="custom-checkbox" aria-hidden="true">
        {checked && <Check size={16} />}
      </span>
      <span>
        <span id={`${id}-label`} className="font-semibold">
          {label}
        </span>
        {description && (
          <span id={`${id}-description`} className="block text-sm text-muted text-pretty">
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onValueChange,
  segmented = false,
}: OptionsProps<T> & { segmented?: boolean }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={segmented ? 'custom-segmented' : 'custom-radio-group'}
    >
      {!segmented && <p className="field-label">{label}</p>}
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          aria-label={segmented ? option.label : undefined}
          title={segmented ? option.label : undefined}
          tabIndex={value === option.value ? 0 : -1}
          className={segmented ? 'custom-segment' : 'custom-choice'}
          onClick={() => onValueChange(option.value)}
          onKeyDown={(e) => {
            if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(e.key))
              return;
            e.preventDefault();
            const next =
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? options.length - 1
                  : (index +
                      (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) +
                      options.length) %
                    options.length;
            const option = options[next];
            if (option) onValueChange(option.value);
            refs.current[next]?.focus();
          }}
        >
          {segmented ? (
            option.icon
          ) : (
            <>
              <span aria-hidden="true" className="custom-radio-dot">
                {value === option.value && <span />}
              </span>
              <span>
                <span className="font-semibold">{option.label}</span>
                {option.description && (
                  <span className="block text-sm text-muted text-pretty">{option.description}</span>
                )}
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  valueText,
}: {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  valueText?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const percent = ((value - min) / (max - min)) * 100;
  const update = (next: number) =>
    onValueChange(
      Math.min(
        max,
        Math.max(min, Number((min + Math.round((next - min) / step) * step).toFixed(6))),
      ),
    );
  const fromPointer = (x: number) => {
    const bounds = track.current?.getBoundingClientRect();
    if (bounds?.width) update(min + ((x - bounds.left) / bounds.width) * (max - min));
  };
  return (
    <div
      className="custom-slider"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      aria-orientation="horizontal"
      onKeyDown={(e) => {
        const changes: Record<string, number> = {
          ArrowRight: step,
          ArrowUp: step,
          ArrowLeft: -step,
          ArrowDown: -step,
          PageUp: step * 10,
          PageDown: -step * 10,
        };
        if (e.key === 'Home' || e.key === 'End' || e.key in changes) {
          e.preventDefault();
          update(e.key === 'Home' ? min : e.key === 'End' ? max : value + (changes[e.key] ?? 0));
        }
      }}
      onPointerDown={(e) => {
        if (!e.isPrimary || e.button !== 0) return;
        e.currentTarget.focus();
        drag.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        fromPointer(e.clientX);
      }}
      onPointerMove={(e) => {
        if (drag.current === e.pointerId) fromPointer(e.clientX);
      }}
      onPointerUp={(e) => {
        if (drag.current === e.pointerId) {
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
    >
      <div ref={track} className="custom-slider-track" aria-hidden="true">
        <div className="custom-slider-fill" style={{ width: `${percent}%` }} />
        <div className="custom-slider-thumb" style={{ left: `${percent}%` }} />
      </div>
    </div>
  );
}
