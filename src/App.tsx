import React, { useEffect } from "react";
import { useThemeStore } from "./store/theme";
import { usePipelineStore } from "./store/pipelineStore";
import { ThemeToggle } from "./components/ThemeToggle";
import { AudioToggle } from "./components/AudioToggle";
import { SystemStatus } from "./components/SystemStatus";
import { PipelineWorkspace } from "./components/PipelineWorkspace";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ByteBot } from "./components/ByteBot";
import { ShieldCheck } from "./icons";
import { Agentation } from "agentation";

export const App: React.FC = () => {
  const { initTheme } = useThemeStore();
  const statusAnnouncement = usePipelineStore(
    (state) => state.statusAnnouncement,
  );

  useEffect(() => {
    const cleanup = initTheme();
    return cleanup;
  }, [initTheme]);

  return (
    <>
      <div className="min-h-screen bg-canvas text-text flex flex-col font-sans relative selection:bg-comic-pink/30 selection:text-text">
        {/* Header: Neo-Pop Comic Deck */}
        <header className="border-b-2 border-border bg-surface/95 backdrop-blur-md px-4 py-3 sm:px-6 sticky top-0 z-30 shadow-comic-sm">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            {/* Brand Identity */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-canvas border-2 border-border flex items-center justify-center text-text shadow-comic-sm shrink-0 overflow-hidden group">
                <ByteBot
                  size="sm"
                  mood="idle"
                  className="group-hover:scale-110 transition-transform duration-200"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-text leading-none text-balance flex items-center gap-2">
                    <span>Tinute</span>
                  </h1>
                </div>
                <p className="text-xs text-muted mt-1 leading-none text-pretty flex items-center gap-1.5 font-medium">
                  <span>Bake tiny images in minutes with Tinutes</span>
                </p>
              </div>
            </div>
            {/* Quick Actions & Utilities */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-text px-3 py-1.5 rounded-xl bg-canvas border-2 border-border shadow-comic-sm">
                <ShieldCheck
                  className="w-4 h-4 text-savings"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
                <span>Private & Secure</span>
              </div>
              <AudioToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>
        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
          {/* Pipeline Workspace (Dropzone, Settings, Results Queue, Compare Slider) */}
          <ErrorBoundary fallbackTitle="Application Workspace Error">
            <PipelineWorkspace />
          </ErrorBoundary>
          {/* Diagnostics & Environment Panel (Repositioned below active work area) */}
          <ErrorBoundary fallbackTitle="Diagnostics Panel Error">
            <SystemStatus />
          </ErrorBoundary>
          {/* ARIA Live Region for batch and job status announcements */}
          <div
            id="accessibility-announcer"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {statusAnnouncement}
          </div>
        </main>
        {/* Production-Ready Footer */}
        <footer className="border-t-2 border-border bg-surface px-4 py-3 sm:px-6 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-2 font-medium">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <span className="font-bold text-text">Tinute</span>
              <span>•</span>
              <span>100% In-Browser</span>
              <span>•</span>
              <span>Photos Never Leave Your Device</span>
              <span>•</span>
              <span>Free & Secure</span>
            </div>
            <div className="text-pretty text-center sm:text-right text-xs">
              All compression happens privately on your device.
            </div>
          </div>
        </footer>
      </div>
      {process.env.NODE_ENV === "development" && (
        <Agentation endpoint="http://localhost:5173" />
      )}
    </>
  );
};

export default App;
