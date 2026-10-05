# Production readiness audit

Scope: source and local verification inspected on 2026-10-06. This is not a deployed-site or cross-browser certification.

## Release blockers

1. **Make privacy behavior match the option.** `src/pipeline/guard.ts` returns untouched input when encoding is not smaller. `src/pipeline/finalize.ts` reports GPS/EXIF removed from the requested setting, rather than inspecting output. Metadata can survive the original-kept path. Define whether privacy takes precedence over the never-bigger policy, implement it, and inspect output bytes in regression fixtures. Metadata retention when the option is disabled also needs explicit semantics.
2. **Verify the deployed production build.** Headers are configured in `src/config/security.ts` and `public/_headers`, but the actual host must apply them. Test HTTPS, CSP, COOP/COEP, `crossOriginIsolated`, workers, WASM fetch/compile, caching, and direct navigation on the deployed origin. Current Playwright configuration runs the Vite development server.
3. **Run browser tests in CI.** `.github/workflows/ci.yml` runs formatting, lint, types, unit tests, build and budget, but no Playwright job. Current Playwright project covers Chromium only. Add Firefox/WebKit and test real iOS Safari/Android Chrome for upload, processing, cancellation, compare, individual downloads, and ZIP export. Confirm CI branch filters match the release branch.

## Before a public launch

4. **Exercise memory and storage limits.** Batch scheduling is bounded and decode guards exist. However, spilling output to OPFS leaves `result.outputBuffer` in store, and ZIP export materializes buffers. Profile repeated large batches on low-memory phones. Test storage quota failures/private browsing and remove orphaned disk output after reloads. Decide how to release buffers without breaking preview/download.
5. **Finish accessibility validation.** Custom controls have automated keyboard tests and narrow viewport checks. Validate VoiceOver/NVDA, forced colors, actual browser zoom, focus order, and error/progress announcements with real assistive technology.
6. **Establish release operations.** Document deployment and rollback, add a production smoke check and uptime alert, audit dependencies/licenses, and collect errors without uploading filenames, images, or metadata. Provide clear supported-format/animation behavior, limits, local-storage/privacy details, and a feedback route.

A beta should follow the first three items. The remaining checks establish confidence for a broad launch, especially on mobile. Accounts, billing, and a backend are not prerequisites for the current local image-compression product.
