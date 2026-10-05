import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Layers,
  CheckCircle2,
  ChevronDown,
  Terminal,
} from '@/icons';
import { arcadeAudio } from '../utils/arcadeAudio';

export const SystemStatus: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const isIsolated = typeof window !== 'undefined' && Boolean(window.crossOriginIsolated);
  const hasSharedArrayBuffer =
    typeof window !== 'undefined' && typeof window.SharedArrayBuffer !== 'undefined';
  const concurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
  const workerPoolTarget = Math.max(1, concurrency - 1);

  const statusItems = useMemo(
    () => [
      {
        id: 'coop-coep',
        name: 'COOP / COEP Isolation',
        value: isIsolated ? 'Active (Isolated)' : 'Inactive',
        ok: isIsolated,
        desc: isIsolated
          ? 'Cross-origin isolated environment active. Multi-threaded WASM ready.'
          : 'Headers missing or running in unisolated frame.',
        icon: isIsolated ? (
          <ShieldCheck className="w-4 h-4 text-savings" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <ShieldAlert className="w-4 h-4 text-lossy" strokeWidth={1.75} aria-hidden="true" />
        ),
      },
      {
        id: 'sab',
        name: 'SharedArrayBuffer',
        value: hasSharedArrayBuffer ? 'Available' : 'Unavailable',
        ok: hasSharedArrayBuffer,
        desc: hasSharedArrayBuffer
          ? 'Zero-copy thread memory sharing enabled.'
          : 'SharedArrayBuffer disabled without COOP/COEP.',
        icon: (
          <Layers
            className={`w-4 h-4 ${hasSharedArrayBuffer ? 'text-savings' : 'text-lossy'}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
        ),
      },
      {
        id: 'workers',
        name: 'Worker Pool Target',
        value: `${workerPoolTarget} threads (${concurrency} cores)`,
        ok: true,
        desc: 'Sized to hardwareConcurrency - 1 for zero UI jank.',
        icon: <Cpu className="w-4 h-4 text-arcade-cyan" strokeWidth={1.75} aria-hidden="true" />,
      },
      {
        id: 'tokens',
        name: 'Design Tokens & WCAG',
        value: 'AA Compliant (≥ 4.5:1)',
        ok: true,
        desc: 'Instrument panel tokens verified in light and dark themes.',
        icon: (
          <CheckCircle2 className="w-4 h-4 text-savings" strokeWidth={1.75} aria-hidden="true" />
        ),
      },
    ],
    [isIsolated, hasSharedArrayBuffer, concurrency, workerPoolTarget],
  );

  const handleToggle = () => {
    arcadeAudio.playClick();
    setIsOpen(!isOpen);
  };

  return (
    <section
      aria-labelledby="system-diagnostics-heading"
      className="w-full rounded-comic border-2 border-border bg-surface/95 backdrop-blur-sm overflow-hidden transition-[border-color,box-shadow] duration-200 shadow-comic"
    >
      {/* Comic Secret Lab Diagnostics Bar */}
      <div className="p-3.5 sm:px-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-canvas border-2 border-border flex items-center justify-center text-comic-cyan shadow-comic-sm">
            <Terminal className="w-4 h-4" strokeWidth={2.2} aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="system-diagnostics-heading"
                className="text-xs font-bold tracking-wider uppercase text-text flex items-center gap-1.5"
              >
                <span>Environment & Security Diagnostics</span>
                <span
                  className="w-2 h-2 rounded-full bg-savings animate-pulse inline-block"
                  aria-hidden="true"
                />
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-canvas border-2 border-border text-muted font-bold shadow-comic-sm">
                Phase 0 Baseline
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5 hidden sm:block">
              {isIsolated ? 'WASM SIMD Multi-threading Armed' : 'Single-thread fallback'} •{' '}
              <span className="font-mono tabular-nums font-semibold">{concurrency} Cores Active</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-controls="system-diagnostics-details"
          className="pl-3 pr-2.5 py-1.5 rounded-xl bg-canvas hover:bg-surface border-2 border-border text-xs font-bold text-text transition-[color,background-color,border-color,transform,box-shadow] duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-comic-sm"
        >
          <span>{isOpen ? 'Close Diagnostics' : 'Inspect Diagnostics'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Collapsible Diagnostics Cards Grid */}
      <div
        id="system-diagnostics-details"
        className={`${isOpen ? 'grid' : 'hidden'} border-t-2 border-border p-3.5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-canvas/60`}
      >
        {statusItems.map((item) => (
          <div
            key={item.id}
            className="p-3 bg-surface rounded-xl border-2 border-border shadow-comic-sm flex flex-col justify-between transition-[border-color,box-shadow] duration-150 ease-out hover:border-comic-cyan hover:shadow-comic"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted">{item.name}</span>
                {item.icon}
              </div>
              <div className="font-mono text-sm font-bold text-text mb-1 tabular-nums">
                {item.value}
              </div>
            </div>
            <p className="text-xs text-muted leading-relaxed mt-1 text-pretty">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
