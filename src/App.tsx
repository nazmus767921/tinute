import React, { useEffect } from 'react';
import { useThemeStore } from './store/theme';
import { usePipelineStore } from './store/pipelineStore';
import { ThemeToggle } from './components/ThemeToggle';
import { AudioToggle } from './components/AudioToggle';
import { SystemStatus } from './components/SystemStatus';
import { PipelineWorkspace } from './components/PipelineWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ByteBot } from './components/ByteBot';
import { ChevronDown } from './icons';
import { Agentation } from 'agentation';

export const App: React.FC = () => {
  const initTheme = useThemeStore((s) => s.initTheme);
  const statusAnnouncement = usePipelineStore((s) => s.statusAnnouncement);
  useEffect(() => initTheme(), [initTheme]);
  return (
    <>
      <div className="app-shell min-h-screen text-text font-sans selection:bg-comic-yellow/40">
        <a href="#workspace" className="skip-link">
          Skip to images
        </a>
        <header className="app-header">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="brand-bot hidden min-[400px]:block" aria-hidden="true">
                <ByteBot size="sm" />
              </div>
              <span className="text-xl font-bold tracking-[-0.05em]">
                Tinute<span className="text-comic-pink">.</span>
              </span>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <AudioToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main id="workspace" className="mx-auto w-full max-w-[920px] px-4 py-6 sm:px-6 sm:py-10">
          <ErrorBoundary fallbackTitle="Could not open your workspace">
            <PipelineWorkspace />
          </ErrorBoundary>
          <div
            id="accessibility-announcer"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {statusAnnouncement}
          </div>
        </main>
        <footer className="mx-auto w-full max-w-[920px] px-4 pb-6 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted">
            <p className="text-pretty">
              Made for smaller files and bigger ideas. Free. Private. Yours.
            </p>
            <details className="technical-disclosure">
              <summary className="flex min-h-11 items-center gap-1.5 cursor-pointer list-none">
                Technical details
                <ChevronDown size={14} className="disclosure-chevron" aria-hidden="true" />
              </summary>
              <ErrorBoundary fallbackTitle="Could not show technical details">
                <SystemStatus />
              </ErrorBoundary>
            </details>
          </div>
        </footer>
      </div>
      {process.env.NODE_ENV === 'development' && <Agentation endpoint="http://localhost:5173" />}
    </>
  );
};
export default App;
