# Effortless Tinute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Native execution is recommended for this tightly connected UI change.

**Goal:** Deliver the approved automatic image workflow with honest visual progress, optional advanced controls, comic personality, and a deliberately designed phone experience.

**Architecture:** Retain React/Tailwind and the compression pipeline. The workspace owns task presentation and optional comparison; the store owns submissions and settings. Focused progress, download, and comparison components share behavior across mobile and desktop while adapting their composition.

**Tech Stack:** React 18, TypeScript, Tailwind, Zustand, Vitest/Testing Library, Playwright, existing Lucide exports.

**Spec:** `docs/superpowers/specs/2026-10-05-simple-image-flow-design.md`

## Global Constraints

- Keep local processing, supported formats, batch limits, individual and ZIP downloads, cancellation, comparison, and advanced options.
- Preserve all existing uncommitted engine, worker, benchmark, and test changes. Review the working-tree diff before editing shared files.
- No new UI framework, account, upload service, or dependency is needed.
- Recommended settings: auto format, visually lossless mode, quality 80, metadata removal enabled, original dimensions.
- Settings apply to newly submitted work; snapshot them at submission.
- Minimum phone touch target 44px; 16px inline phone margins; phone inputs at least 16px text.
- Every button uses exactly 0.96 press scale with reduced-motion accommodation; specify transition properties.
- Headings balance, body copy wraps prettily, metrics use tabular figures; all icons come through `src/icons.ts`.
- Measure AA contrast in both themes; verify 320px width and 200% zoom.
- Keep a visible progress bar; do not invent granular encoding progress or time estimates.
- Run pnpm typecheck, pnpm lint, pnpm test, pnpm build, and pnpm check:budget before completion.

## Review Focus

- Files added during another submission must be processed once, using their own settings, without an early idle state (Task 1).
- Oversized-only and mixed-error batches must settle with honest counts and visible recovery, rather than hanging or celebrating success (Tasks 1 and 3).
- Cancelling queued work must prevent later execution and late callbacks must not resurrect stopped jobs (Task 1).
- Long filenames, phone landscape, and zoomed text must not hide card actions or bottom content (Tasks 4 and 6).
- Preview/download failures must leave the user a visible recovery path, preserve output, and restore comparison focus (Tasks 4 and 5).

## File responsibilities

- `src/store/pipelineStore.ts`: recommended reset, submission lifecycle, deliberate comparison, visible ZIP errors.
- `src/store/batchOrchestrator.ts`: only orchestration changes required to settle rejected/cancelled work correctly.
- `src/components/PipelineWorkspace.tsx`: state hierarchy, settings disclosure, comparison mount.
- `src/components/Dropzone.tsx`: file selection and drag/drop; compact add-more variant.
- `src/components/BatchProgress.tsx` (new): accessible truthful batch progress.
- `src/components/SettingsPanel.tsx`: expert controls and explanations.
- `src/components/ResultsTable.tsx`: results summary, list, clearing guard.
- `src/components/ResultRow.tsx`: readable adaptive cards and optional details.
- `src/components/DownloadActions.tsx` (new): primary download action and export feedback.
- `src/utils/download.ts` (new): shared individual result download utility.
- `src/components/CompareSlider.tsx` and `CompareControls.tsx`: comparison dialog, range and zoom controls.
- `src/App.tsx`, `src/components/AudioToggle.tsx`, `ThemeToggle.tsx`, `ByteBot.tsx`, and styles: shell, safe utilities, retained character and motion compliance.
- Existing component/store tests plus new focused tests and `e2e/redesign.spec.ts`: behavior and rendered layout verification. Preserve `e2e/pipeline.spec.ts` working changes.

## Task 1: Reliable automatic submission state

**Files:** Modify `src/store/pipelineStore.ts`, `src/store/batchOrchestrator.ts`; create `src/store/__tests__/pipelineStore.test.ts`; extend `src/store/__tests__/batchOrchestrator.test.ts`.

**Interfaces:** Keep existing public actions. Add `resetSettings(): void` and `zipError: string | null`. Keep `selectedCompareJobId` null until `setSelectedCompareJobId(id)` is called. Each `addFiles(files: File[]): Promise<void>` dispatches only its own new jobs with a settings snapshot. Processing is derived from live queued/processing jobs, not one submission promise.

- [ ] Write failing tests with deferred mock worker results: add two submissions with different format/quality; assert each job is submitted once with its original settings and `isProcessing` remains true until all live jobs settle.
- [ ] Add assertions for reset: `expect(settings).toEqual({targetFormat:'auto',mode:'visually-lossless',stripMetadata:true,qualityTarget:80})`; completion leaves `selectedCompareJobId` null; ZIP rejection sets visible `zipError` and clears `isZipping`.
- [ ] Test cancellation before queue launch and after worker launch: stopped jobs stay cancelled, no cancelled queued job gets submitted. Test retry reuses the failed job identity and does not create an extra queued ghost. Test an oversized-only batch resolves with errors.
- [ ] Run `pnpm test src/store/__tests__/pipelineStore.test.ts src/store/__tests__/batchOrchestrator.test.ts`; confirm new assertions fail for the intended behavior.
- [ ] Implement these store and orchestrator changes without modifying encoder policy, worker internals, or compression defaults. Retry the existing job with the current settings snapshot; ignore stale completion callbacks for cancelled jobs. Ensure exhausted synchronous rejection paths resolve.
- [ ] Rerun the focused tests; expect all pass. Review only this task’s diff before continuing; commit task files when repository permissions and the chosen integration workflow allow it.

## Task 2: Focused upload and optional settings

**Files:** Modify `src/components/PipelineWorkspace.tsx`, `Dropzone.tsx`, `SettingsPanel.tsx`; update their three existing test files.

**Interfaces:** Keep `Dropzone({compact?: boolean})` for empty and add-more presentation. `SettingsPanel()` consumes store setters and Task 1 `resetSettings()`. Workspace owns a native Advanced settings disclosure and its persistent recommended/custom summary.

- [ ] Update tests to assert one Choose images primary button in the empty state, file selection calls `addFiles`, Enter/Space activate the native button, and drops still work.
- [ ] Add tests that technical controls are unavailable to the default tab order while collapsed, become operable after disclosure, preserve all target formats, update quality/mode/metadata/dimensions, and Reset to recommended restores Task 1 defaults. Assert Custom settings remains visible after closing the disclosure.
- [ ] Run `pnpm test src/components/__tests__/Dropzone.test.tsx src/components/__tests__/SettingsPanel.test.tsx src/components/__tests__/PipelineWorkspace.test.tsx`; confirm expected failures.
- [ ] Replace the technical sidebar and preset grid with the approved hierarchy and exact empty-state copy. Remove clickable-region keyboard emulation and nested upload interactions; retain drag events on a noninteractive surrounding surface and file choice on a native button.
- [ ] Implement settings explanations, native mode controls, 16px mobile input text, 44px targets, explicit focus styles, and “Applies to images you add next.” The settings section remains available when jobs exist.
- [ ] Rerun focused tests; expect all pass. Review and checkpoint the task diff.

## Task 3: Truthful progress and recovery presentation

**Files:** Create `src/components/BatchProgress.tsx`, `src/components/__tests__/BatchProgress.test.tsx`; modify `PipelineWorkspace.tsx` and its tests.

**Interfaces:** `BatchProgress({jobs, onStop}: {jobs: ImageJob[]; onStop: () => void})` derives settled count, pending count, and failure/cancel counts from job statuses. Workspace renders it while jobs are queued/processing. No simulated percentages.

- [ ] Add tests asserting a mixed batch of eight jobs with three settled shows “3 of 8 finished” and a determinate progress value of 37.5 (round only displayed percent). Errors/cancellations count as settled but are identified separately.
- [ ] Assert one unfinished image shows a named indeterminate progressbar with no `aria-valuenow`; a batch with zero settled jobs remains 0%; Stop processing calls `onStop`.
- [ ] Add workspace tests that a rejection is visible even with zero jobs, mixed errors do not show an all-success celebration, and completed output stays accessible while other jobs process.
- [ ] Run `pnpm test src/components/__tests__/BatchProgress.test.tsx src/components/__tests__/PipelineWorkspace.test.tsx`; confirm expected failures.
- [ ] Implement the progress track and clear status text using native/ARIA progress semantics. Use a static active cue under reduced motion; retain existing live announcements without duplicating high-frequency updates.
- [ ] Rerun focused tests; expect all pass. Review and checkpoint the task diff.

## Task 4: Adaptive results and effortless download

**Files:** Modify `ResultsTable.tsx`, `ResultRow.tsx` and existing results tests; create `DownloadActions.tsx`, `src/utils/download.ts`, `src/components/__tests__/DownloadActions.test.tsx`, `src/components/__tests__/ResultRow.test.tsx`.

**Interfaces:** `downloadImageJob(job: ImageJob): void` downloads completed output and throws for actionable failures. `DownloadActions()` consumes jobs, `exportZip()`, `isZipping`, `zipProgress`, and `zipError`. ResultRow retains its current callbacks; comparison remains explicit.

- [ ] Test one ready image downloads directly, multiple ready images call ZIP export, partial processing uses Download ready images, and duplicate ZIP actions are disabled. Assert real ZIP progress and export error/retry guidance are visible.
- [ ] Test result states: queued, processing, cancelled, error with Retry, smaller output, original-kept output, and important warning. Assert full filenames/error messages are present and technical metrics are exposed only via Details.
- [ ] Test that clear-results cancellation preserves jobs; only confirming removes output. Test individual download failure shows a visible error while Compare and retrying download remain usable.
- [ ] Run `pnpm test src/components/__tests__/ResultsTable.test.tsx src/components/__tests__/ResultRow.test.tsx src/components/__tests__/DownloadActions.test.tsx`; confirm expected failures.
- [ ] Implement phone cards with an identity area followed by separate labeled Download/Compare actions. Wider cards align actions beside content only when they fit. Wrap names and errors, use tabular sizes/savings, provide neutral inset image outlines and preview fallback.
- [ ] Implement the primary download area as a sticky section in normal flow on phones, with safe-area padding and short-viewport/zoom behavior that cannot obscure results. On desktop use the summary action zone. ZIP helper text explains packaging.
- [ ] Add guarded clearing using a native confirmation or accessible confirmation dialog. Share individual download code and preserve current extension rules and object-URL cleanup.
- [ ] Rerun focused tests; expect all pass. Review and checkpoint the task diff.

## Task 5: Focused, accessible mobile comparison

**Files:** Modify `CompareSlider.tsx`, `CompareControls.tsx`, `PipelineWorkspace.tsx`, existing `CompareSlider.test.tsx`.

**Interfaces:** Keep store selection and preview creation. Render a native modal `dialog` with a Close action, Escape dismissal, and focus restoration. A native labeled range input controls the 0–100 split. Retain 0.5–4 zoom with Fit reset; remove pointer-only panning or supply keyboard/button equivalents if retained.

- [ ] Add tests that comparison opens only after Compare, has a named dialog and Close action, restores focus after dismissal, and split changes via range/keyboard. Verify preview failure shows recovery and Close remains usable.
- [ ] Test Fit resets zoom/pan; verify object URLs are revoked on unmount and late preview resolution does not update closed views.
- [ ] Run `pnpm test src/components/__tests__/CompareSlider.test.tsx src/components/__tests__/PipelineWorkspace.test.tsx`; confirm expected failures.
- [ ] Implement full-screen phone comparison with safe-area header and bottom controls; desktop uses a centered bounded dialog. Replace crowded overlay badges with readable Original/Smaller labels and size information. Keep technical scores optional.
- [ ] Keep image area proportional to available viewport, native range control outside the image for accessible operation, and touch interaction limited to the dedicated handle so normal scrolling remains usable. Implement visible loading/failure states and focus-safe close behavior.
- [ ] Rerun focused tests; expect all pass. Review and checkpoint the task diff.

## Task 6: Shell, character, rendered verification, and completion

**Files:** Modify `src/App.tsx`, `src/styles/globals.css`, `src/styles/tokens.css`, utilities/mascot only as needed, `src/__tests__/App.test.tsx`; create `e2e/redesign.spec.ts`. Use `src/icons.ts` for any additional exports. Preserve existing theme-transition suppression.

**Interfaces:** App retains initialization and the live region, wraps technical diagnostics in a native disclosure, and renders the task-first workspace. No new routing or application subsystem.

- [ ] Update App tests for quiet privacy copy, optional diagnostics, accessible utilities, and retained live announcements. Run `pnpm test src/__tests__/App.test.tsx`; confirm intentional assertions fail before shell changes.
- [ ] Implement the compact header, quiet footer, centered desktop canvas, phone spacing, comic character, and semantic contrast corrections. Audit touched ByteBot/utility motion for reduced-motion compliance and correct all touched controls to exact 0.96 press scale with visible focus.
- [ ] Add Playwright behavior cases for upload → progress → download, optional settings, mixed failure, guarded clearing, and explicit comparison dismissal. Add rendered checks at widths 320, 390, 768, and 1440 for no horizontal page overflow, long-name card actions remaining in view, and the final result not covered by the download area.
- [ ] Include phone landscape and 200% zoom-equivalent coverage plus a manual actual browser zoom check. Verify light/dark themes, reduced motion, keyboard-only completion, dialog focus, and safe areas. Measure computed rendered contrast for normal text and control/icon pairs; record ratios.
- [ ] Inspect all affected transitions at 10% playback speed and confirm static state cues remain when motion is disabled. Fix verified issues before final validation.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, then `pnpm build` and `pnpm check:budget`; expect zero errors/warnings, all tests passing, and production bundle below the configured 150KB gzip budget. Run `pnpm exec playwright test e2e/redesign.spec.ts` against the configured preview.
- [ ] Review the final diff against the approved spec, including current unrelated changes. Complete the required code-review workflow using the selected execution method; report exact verification results and any limitations, without claiming uninspected visual states pass.

## Plan self-review

All spec sections map to Tasks 1–6. Submission isolation, stopped work, mixed outcomes, rejection visibility, ZIP errors, complete text access, dialog recovery, safe areas, reduced motion, contrast, and production budget each have explicit implementation and verification owners. No new encoder policy or dependencies are introduced. Repository integration/commits must preserve the user’s ongoing work and respect filesystem permissions.

## Execution checkpoint

Written spec approval has been received. Review this plan and select native execution (the primary agent implements the tasks in this session) or subagent-driven execution (separate implementer/reviewer contexts per task) before product-code implementation.

User steering, 2026-10-06: replace visible native selects, checkboxes, radio buttons, and sliders with local reusable custom primitives; use a playful segmented theme switcher, install no shadcn, and record the invariant in AGENTS.md. This supersedes the previous native theme select ruling.
