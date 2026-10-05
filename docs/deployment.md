# Netlify release runbook

Tinute is a static browser app. No application backend, API keys, or file-upload service is needed.

## Build and test

Use Node 22 and pnpm 12.4.1:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps chromium firefox webkit
pnpm format:check
pnpm verify:release
```

`verify:release` runs types, lint, unit tests, production build, initial JavaScript budget, then real production browser workflows. The WebKit project uses an iPhone viewport; physical device testing is still required for release sign-off.

## Configure Netlify

Connect the repository and select the release branch. The committed `netlify.toml` selects `pnpm build && pnpm check:budget` and `dist`. Enable Deploy Previews and require a passing CI run before merging release changes. The CI workflow accepts both `main` and `master`.

`public/_headers` is copied to `dist/_headers` and sets CSP, COOP, COEP, MIME sniffing protection and framing restrictions. Netlify must serve these response headers. Hashed assets are immutable; stable WASM URLs and HTML revalidate between releases. Do not enable injected analytics or third-party scripts without reviewing CSP and the local-only privacy promise.

References: [Netlify build configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/) and [custom headers](https://docs.netlify.com/manage/routing/headers/).

## Check the actual deploy

Before promoting a Deploy Preview, run:

```sh
TINUTE_BASE_URL=https://your-preview.netlify.app pnpm test:release
```

This tests headers, isolation, actual workers/WASM, privacy removal, compare, corrupt-file recovery and ZIP/individual downloads against that origin. Configure an uptime check for the public URL and run this suite after every deploy. A live URL is intentionally not hard-coded in the repository.

On physical iOS Safari and Android Chrome, check file selection, background/foreground behavior, a representative large photo, cancellation, ZIP extraction, text zoom, safe areas, VoiceOver/TalkBack, and downloading to the Files/Downloads app. Use representative JPEG/PNG/WebP/HEIC photos, including rotated and wide-gamut inputs.

## Rollback

If the post-deploy smoke check fails, republish the last known-good Netlify deploy from the Deploys screen. Verify the restored origin with the same smoke suite. Fix and test on a new Deploy Preview before republishing.

## Privacy and limits

Files are processed locally. Results are placed in origin-private storage when safe shared browser locks are available; otherwise they stay in memory. A live tab holds a storage lease. The next visit without another live processing tab removes abandoned output. Clearing finished images removes their stored results; original files remain untouched. Reloading does not resume a batch.

The workspace allows 100 images, 50 MB per input and 100 MB total input. Decoder pixel guards and a per-output size limit bound additional allocations. Mobile processing uses one worker. Animation is rejected rather than flattened. Choosing metadata removal can require a larger re-encoded output; the UI reports that explicitly. Turning it off permits original metadata but does not guarantee that every encoder preserves it.

Collect operational errors without filenames, image bytes, EXIF, or location data. Choose a support/feedback channel before public promotion. Keep dependency review, license notices, and physical-device accessibility/performance sign-off in the release checklist.
