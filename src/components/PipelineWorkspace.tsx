import React, { useState } from 'react';
import { usePipelineStore, RECOMMENDED_SETTINGS } from '../store/pipelineStore';
import { SettingsPanel } from './SettingsPanel';
import { Dropzone } from './Dropzone';
import { BatchProgress } from './BatchProgress';
import { ResultsTable } from './ResultsTable';
import { CompareSlider } from './CompareSlider';
import { ErrorBoundary } from './ErrorBoundary';
import { ChevronDown, SlidersHorizontal, AlertCircle } from '@/icons';

export const PipelineWorkspace: React.FC = () => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { jobs, settings, batchError, selectedCompareJobId, cancelAll, setSelectedCompareJobId } =
    usePipelineStore();
  const hasJobs = jobs.length > 0;
  const pending = jobs.some((j) => j.status === 'processing' || j.status === 'queued');
  const custom =
    Object.entries(RECOMMENDED_SETTINGS).some(
      ([key, value]) => settings[key as keyof typeof settings] !== value,
    ) || settings.maxDimension !== undefined;
  return (
    <section aria-label="Image workspace" className="workspace">
      {hasJobs && <h1 className="sr-only">Make images smaller</h1>}
      {batchError && (
        <div role="alert" className="notice">
          <AlertCircle size={20} aria-hidden="true" />
          <p>{batchError}</p>
        </div>
      )}
      {!hasJobs && <Dropzone />}
      {pending && <BatchProgress jobs={jobs} onStop={cancelAll} />}
      {hasJobs && (
        <ErrorBoundary fallbackTitle="Could not show your images">
          <ResultsTable />
        </ErrorBoundary>
      )}
      <details className="advanced-disclosure" open={advancedOpen}>
        <summary
          className="disclosure-summary"
          onClick={(e) => {
            e.preventDefault();
            setAdvancedOpen((v) => !v);
          }}
        >
          <span className="flex items-center gap-2 font-semibold">
            <SlidersHorizontal size={18} aria-hidden="true" />
            Advanced settings
          </span>
          <span className="flex items-center gap-2">
            <span className={`settings-cue ${custom ? '' : 'hidden sm:inline'}`}>
              {custom ? 'Custom settings' : 'Recommended'}
            </span>
            <ChevronDown size={18} className="disclosure-chevron" aria-hidden="true" />
          </span>
        </summary>
        {advancedOpen && <SettingsPanel />}
      </details>
      {selectedCompareJobId && (
        <ErrorBoundary
          fallbackTitle="Could not open comparison"
          onReset={() => setSelectedCompareJobId(null)}
        >
          <CompareSlider />
        </ErrorBoundary>
      )}
    </section>
  );
};
