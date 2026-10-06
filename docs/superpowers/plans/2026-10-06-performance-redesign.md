# Performance redesign implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve source formats and bound image processing, previews, storage, and export memory.

**Architecture:** Inspect before decoding and resolve preserve-mode per job. Use native bitmap encoding for common lossy formats, direct PNG optimization, isolated codecs for advanced formats, and global admission before reading files.

**Tech Stack:** TypeScript, React, browser workers/Canvas, jSquash, OPFS, fflate.

**Spec:** `docs/architecture-performance-audit.md`

## Global constraints

- No implicit conversion, privacy bypass, or silent content flattening.
- Keep shared accessible controls and existing semantic design tokens.
- No new component library or runtime dependencies.
- Performance targets require production-browser measurements, not unit-test claims.

## Review focus

- Mixed batches and larger explicit conversions must keep the selected format.
- Lossless JPEG must retain compressed source pixels, not re-encode at quality 95.
- Overlapping submissions and unavailable OPFS must remain bounded.
- Preview cancellation must release resources and keep decode work off the UI thread.
- Export must apply backpressure and preserve results on failure.

## Task 1: Format and bounded codec pipeline

Files: pipeline types/plan/execute/search/qualityGate, codecs, SettingsPanel, pipeline tests.

- [x] Add failing preservation, conversion-fallback, bounded-scoring, and lossless-contract tests; run them.
- [x] Add `preserve` target; pass detected format to planning; route native JPEG/WebP and direct PNG before RGBA decode.
- [x] Bound scoring samples and retries; remove automatic lossless escalation; reject unmet lossless results.
- [x] Run pipeline tests and typecheck.

## Task 2: Scheduling and codec ownership

Files: global admission module, batchOrchestrator, WorkerPool, codec ownership/loader, tests.

- [x] Test shared admission and cancellation before reads.
- [x] Reserve estimated job memory globally before file reads; cap concurrent processing and recycle large worker heaps.
- [x] Bound GIF color structures and fix codec initialization/resource cleanup.
- [x] Run worker, batch, and codec tests.

## Task 3: Results, previews, and export

Files: storage/opfs, utils/output/download/zipExport/preview, preview worker, ResultRow/CompareSlider and tests.

- [x] Test quota rejection, Blob reads, preview cleanup, and archive contents.
- [x] Add bounded storage fallback and Blob/stream reads; stream ZIP to OPFS with capped fallback.
- [x] Generate bounded previews in a worker; remove full-source thumbnails and main-thread exotic decoding.
- [x] Run storage, export, and component tests.

## Task 4: Release verification

Files: performance benchmark, bundle budget script, readiness documentation.

- [x] Run typecheck, lint, all tests, production build and budget checks.
- [x] Run browser release checks and cold/warm 32 MP native benchmarks; record limits and measured evidence.
- [x] Review final changes and document remaining advanced-format limitations.

## Execution ledger

User authorized implementation and requested no further design questions. Execute inline in the local feature branch; no push or merge. The workspace sandbox prevents ordinary Git writes, so branch creation used the required escalation. Preserve existing untracked audit document.

Final evidence: 195 unit tests passed; typecheck, lint, production build and budgets passed. The full 24-case release browser run passed before the final PNG effort/admission changes. Final production-worker measurements: JPEG 2.1–4.8s; difficult PNG 6.6–14.5s with original retention (0% reduction). Large-PNG compression remains below the competitor target; see `docs/performance-redesign-verification.md`. No deployment, push or merge.
