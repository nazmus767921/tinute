# Tinute: effortless image compression

## Approved intent

Tinute primarily serves nontechnical people who want smaller images with little effort. Keep its funky comic character and useful advanced controls. The user approved an automatic add → compress → download flow, and explicitly requires a visible progress bar and mobile layouts designed like a native phone app rather than a compressed desktop dashboard.

Success means a first-time visitor can choose images and download the results without understanding formats, codecs, quality scores, or presets. Expert settings are discoverable without competing with the main task.

## Scope and boundaries

Redesign the application shell, upload experience, progress presentation, results, settings, comparison, diagnostics disclosure, and recovery copy. Retain local processing, supported formats, batch limits, individual downloads, ZIP downloads, cancellation, comparison, and advanced options. Use existing React, Tailwind, semantic tokens, Lucide exports, and stores. No new UI framework, account, upload service, or dependency is needed.

Existing uncommitted compression engine, worker, benchmark, and test changes belong to ongoing work and must be preserved. Store changes are limited to what the approved UX requires: recommended-settings reset, deliberate comparison selection, truthful progress derivation, and settings snapshots if needed for consistent batch behavior.

## Chosen approach and alternatives

Use one automatic flow with progressive disclosure. A wizard would introduce unnecessary steps. Separate simple and advanced modes would ask visitors to choose a mode before starting. Keep technical configuration behind Advanced settings within the same experience.

## Information hierarchy

1. A compact brand header: Tinute and optional sound/theme utilities.
2. The current task: choose images, follow progress, or download results.
3. Contextual secondary actions: add more, compare, retry, stop processing.
4. Advanced settings and technical details, explicitly disclosed.
5. A quiet privacy statement: Images stay on your device.

Remove the permanent settings sidebar, technical preset tiles, scoreboard terminology, repeated privacy badges, and visible diagnostics from the main path. Keep all useful capabilities reachable through clearly named controls.

## Empty state

Show “Smaller images. Big personality.” with a short explanation: “Choose your images. Tinute makes them smaller automatically.” ByteBot remains the visual anchor. Choose images is the sole primary action. Support drag and drop on the surrounding desktop surface without nested interactive regions; use a native button for choosing files.

Show a quiet recommended-settings summary and an Advanced settings disclosure before upload. Put file types and limits in secondary guidance; do not display a dense codec inventory as the main instruction. Keep accepted types unchanged.

## Processing state and visual progress

Replace the oversized empty upload stage with a compact processing summary and a visible progress track above results. Display “Making your images smaller” and “3 of 8 finished,” with separate failure information where needed. Count every settled job (done, error, cancelled) toward batch completion; distinguish “finished” from “successfully compressed.” Maintain persistent textual job states.

The engine reports job completion, not granular encoding percentages. Show an honest batch completion bar derived from settled jobs / total jobs. For a single unfinished job, show a labeled indeterminate bar rather than an invented percentage. For a batch at zero settled jobs, keep the 0% value honest and provide an active cue within the track. Never claim estimated time or fake progress. Reduced motion replaces movement with a static active cue while retaining the count and status. Use accessible progress semantics and existing live announcements without announcing every animation frame.

Stop processing is a secondary action. Already finished images remain downloadable. Add more images stays available, with settings applying only to newly submitted work. Snapshot settings at submission so tweaking controls cannot change work already queued. Preserve original files.

## Results and download

Results take over the main workspace as soon as jobs exist. Show a calm summary of ready images and total savings. Download images is the primary batch action; helper text explains that multiple images download together in a ZIP. For exactly one ready image, Download image downloads that image directly. During mixed processing, Download ready images clearly names the available subset. ZIP preparation has its own real progress indicator and disabled duplicate action.

Each result shows thumbnail, complete accessible filename, original → resulting file size, and a plain state such as “42% smaller,” “Already small — original kept,” “Waiting,” “Making smaller,” “Stopped,” or “Couldn’t process.” Use Download and Compare as explicit labeled actions. Expose format, quality score, and technical warnings under Details. Important warnings remain visible in plain language, with an icon and explanation rather than a cryptic badge or color alone.

Do not open comparison automatically when a job completes. Open it only when Compare is selected. Starting another batch or clearing results must not silently remove undownloaded output: use a confirmation describing the consequence before clearing. Preserve the current engine’s never-bigger behavior and represent it as a successful original-kept outcome.

## Advanced settings

Collapsed by default with a clear chevron and label. Expanded controls retain automatic/manual format, visually lossless/bit-exact modes, quality, metadata removal, and maximum dimensions. Explain unfamiliar terms near the control. Native selects, sliders, and checkboxes keep interaction predictable.

Include Reset to recommended: auto format, visually lossless mode, quality 80, metadata removal enabled, original dimensions. Keep these existing defaults rather than introducing unvalidated compression policy. Show a persistent Custom settings cue outside the disclosure when defaults change. Explain: “Applies to images you add next.” Do not imply that changing settings recompresses existing results.

## Phone layout

Design the narrow layout independently while sharing semantic content and components:

```text
Tinute                         utilities

Smaller images.
Big personality.
           ByteBot
Short explanation
[         Choose images           ]
Images stay on your device.
Advanced settings                 v
```

After adding images:

```text
Tinute                         utilities
Making your images smaller
[==========.......................]
3 of 8 finished       Stop processing

Your images              Add more
[thumb] full wrapping filename
        2.4 MB → 860 KB
        64% smaller
[ Download ]           [ Compare ]
Details                           v
... more cards ...

Bottom action area:
3 images ready · savings summary
[      Download ready images      ]
```

Use 16px inline margins, spacious vertical grouping, body and control text appropriate for phones, and at least 44px touch targets. Result cards have a thumbnail/identity area and a separate action row rather than wrapping a desktop toolbar into fragments. Full filenames and error messages wrap; no hover-only access. Inputs use at least 16px text to avoid iOS focus zoom.

The primary download action lives in a phone bottom action area with safe-area padding and reserved content clearance. It must never obscure the final card or browser controls. Prefer sticky positioning within normal layout over an overlapping fixed footer. At short viewports and 200% zoom, the action must remain reachable without a large sticky region consuming the screen. No horizontal scrolling for primary content. Header utilities remain compact and labeled for assistive technology, with no duplicate status badges.

Advanced settings expand as a full-width vertical section. Comparison opens as a focused full-screen dialog on phones with a clear Close action, focus containment, Escape support, and focus restored to the initiating Compare button. The image fits available space; comparison and zoom controls stay inside safe areas. Desktop uses a larger centered dialog with the same semantics. Include a native range control for before/after comparison so drag is not the only path. Do not require touch panning to inspect the image; any pan functionality retained needs equivalent directional controls and reset.

## Desktop and intermediate layouts

Use a centered workspace with a deliberate maximum width, generous breathing room, and the same reading order as mobile. Empty state stays focused rather than filling a grid of panels. Wide result cards can put actions alongside metadata when content fits. Intermediate widths retain stacked cards until there is enough room for identity, savings, and actions without squeezing. Breakpoints follow content fit; verify phone portrait, phone landscape, tablet, and wide desktop.

## Character, visual system, and motion

Keep ByteBot, warm paper/night surfaces, bold headings, comic borders and offset shadows, and selective cyan/pink/yellow accents. Reserve accent emphasis for primary action and meaningful state. Use semantic tokens and measure rendered contrast in both themes. Do not use pale accent colors as normal-size text without verification.

Keep interaction feedback short and interruptible: exact 0.96 press scale, specific transition properties, and reduced-motion accommodations. Use static completion text plus an optional restrained mascot celebration. Avoid perpetual bouncing and competing scanning effects across every card. Suppress transitions for the theme switch frame. Headings balance; body copy wraps prettily; metrics use tabular figures. All UI icons come through src/icons.ts. Preserve the established mascot identity rather than replacing it with generic decorative icons.

## Recovery and edge cases

- Unsupported or damaged files: readable inline error, filename, and an actionable next step; technical details remain optional.
- Partial failure: retain successful downloads, report failed count separately, offer Retry on failed cards. Never say all images succeeded when some failed.
- Cancellation: persistent Stopped label and a clear recovery action; finished downloads stay available.
- No savings: explain that the original is already small and remains available.
- Batch limit rejection: show the message even if no jobs were created; never hide errors behind a hasJobs condition.
- Preview failure: show a placeholder and an explanation without blocking downloads.
- ZIP failure: display a visible error with retry guidance, not only a live-region announcement.
- Long names, large batches, and resizing: preserve content and actions without horizontal clipping or automatic disruptive scrolling.

## Accessibility and verification

Every interaction must work by keyboard with an accessible name and explicit visible focus. Use native semantics where possible. Dialogs restore focus, comparison supports keyboard, progress has meaningful labels, and status is not conveyed through color or animation alone. Check measured AA contrast, reduced motion, 320px width, and 200% zoom.

Add or adapt meaningful behavior tests for automatic processing, recommended-settings reset, disclosure behavior, deliberate comparison, truthful progress, mixed outcomes, download choice, visible batch/ZIP errors, and guarded clearing. Retain existing pipeline coverage without rewriting unrelated engine work.

Before completion run pnpm typecheck, pnpm lint, pnpm test, pnpm build, and pnpm check:budget. Inspect empty, processing, completed, mixed error, cancelled, settings, comparison, and download states at 320px, 390px, 768px, and desktop widths, in both themes. Inspect keyboard navigation, 200% zoom, reduced motion, safe-area clearance, and transitions at 10% speed. Record actual outcomes and identify anything not verified.

## Design review checkpoint

The user has approved the overall direction and added progress/mobile requirements. This document makes those decisions concrete. Written-spec approval is required before creating the implementation plan; the plan then needs review and an execution-method selection under the brainstorming workflow.

User steering, 2026-10-06: replace visible native selects, checkboxes, radio buttons, and sliders with local reusable custom primitives; use a playful segmented theme switcher, install no shadcn, and record the invariant in AGENTS.md. This supersedes the previous native theme select ruling.
