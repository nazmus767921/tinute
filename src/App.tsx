import React, { useEffect } from 'react';
import { useThemeStore } from './store/theme';
import { usePipelineStore } from './store/pipelineStore';
import { ThemeToggle } from './components/ThemeToggle';
import { AudioToggle } from './components/AudioToggle';
import { PipelineWorkspace } from './components/PipelineWorkspace';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ByteBot } from './components/ByteBot';
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
            <a
              href="/"
              className="flex items-center gap-2.5 rounded-xl transition-transform duration-150 active:scale-[0.96] motion-reduce:transform-none"
              aria-label="Tinute home"
            >
              <div className="brand-bot" aria-hidden="true">
                <ByteBot size="sm" />
              </div>
              <span className="text-xl font-bold tracking-[-0.05em]">
                Tinute<span className="text-comic-pink">.</span>
              </span>
            </a>
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
        <footer className="mx-auto w-full max-w-[920px] px-4 pb-8 pt-4 text-xs text-muted sm:px-6">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-t border-border-subtle pt-4">
            <p className="text-pretty">
              Made for smaller files and bigger ideas. Free. Private. Yours.
            </p>
            <p className="text-pretty">
              <span className="tabular-nums">© {new Date().getFullYear()}</span>{' '}
              <a
                href="https://bohuvuj.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-text underline decoration-muted/40 underline-offset-2 transition-colors duration-150 ease-out hover:text-comic-pink hover:decoration-comic-pink/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-comic-pink/50 rounded-[2px]"
              >
                Bohuvuj
              </a>
              . A product of Bohuvuj. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
      {process.env.NODE_ENV === 'development' && <Agentation endpoint="http://localhost:5173" />}
    </>
  );
};
export default App;
