# AGENTS.md — UI/UX Design & Interface Engineering Guidelines

This document provides mandatory directives for all AI agents, engineers, and contributors modifying, building, or reviewing user interfaces and experiences in the **Tinute** codebase.

Whenever any agent touches HTML, CSS, Tailwind classes, React components, typography, layout, animations, icons, or design tokens, the agent **MUST** strictly adhere to the skills and design engineering principles established in `.agents/skills/`.

---

## 1. Core Mandate: Skills-Driven Interface Design

Tinute is an instrument-grade, high-performance in-browser application. The user interface must feel exceptionally tactile, responsive, accessible, and optically balanced.

All interface decisions are governed by the domain skills located in `.agents/skills/`:

- **`make-interfaces-feel-better`**: Tactile interaction, micro-interactions, surfaces, and animation polish.
- **`better-interface`**: Cross-discipline review orchestration.
- **`better-accessibility`**: Accessibility standards, APG keyboard patterns, hit targets, WCAG compliance.
- **`better-layout`**: Spatial hierarchy, grouping with space, adaptive viewports, container queries.
- **`better-writing`**: Clear, direct, verb-first UX copy and error handling.
- **`better-typography`**: Text wrapping (`balance`/`pretty`), tabular figures, font smoothing.
- **`better-colors`**: Semantic token architecture, measured contrast pairs, ramp discipline.
- **`better-ui`**: Optical alignment, concentric border radii, layered shadows, scale on press.

---

## 2. Order of Precedence for Reviews & Implementation

When designing or reviewing UI components, always proceed in this foundational order so polish never masks functional or structural failures:

1. **Accessibility (`better-accessibility`)**: Keyboard operability, ARIA semantics, visible focus, live regions.
2. **Layout & Structure (`better-layout`)**: Grouping with whitespace (intra-group < inter-group), logical alignment.
3. **Copy & Content (`better-writing`)**: Plain language, verb-first buttons, direct and calm guidance.
4. **Typography (`better-typography`)**: `text-balance` for headings, `text-pretty` for body, `tabular-nums` for metrics.
5. **Color & Contrast (`better-colors`)**: Measured contrast (never guessed), semantic tokens only.
6. **UI Polish & Motion (`make-interfaces-feel-better` & `better-ui`)**: Concentric radii, optical centering, scale on press, interruptible transitions.

---

## 3. Strict Escalation Triggers (Zero-Tolerance Blockers)

If any of the following conditions exist or are introduced, it is considered a **CRITICAL BLOCKER** (`HIGH` severity) that must be resolved immediately before completion:

1. **No accessible name**: Any interactive control (`<button>`, `<a>`, `<select>`, `<input>`) lacking an accessible name or label.
2. **No visible focus indicator**: Keyboard-reachable control missing an explicit, visible `:focus-visible` indicator.
3. **Mouse-only path**: Any user interaction reachable by pointer that cannot be operated via keyboard.
4. **Ignores reduced motion**: Motion or transforms that execute without `motion-reduce:transform-none` or `@media (prefers-reduced-motion: reduce)` accommodation.
5. **Viewport clipping**: Critical content or controls clipped, overlapped, or unreachable at 320px width or 200% zoom.
6. **Failed contrast ratio**: Text or icons with rendered contrast failing WCAG AA (≥ 4.5:1 for normal text, ≥ 3:1 for large text/graphical controls).
7. **Color-only state**: Conveying status or validation through color alone without a redundant icon, label, or text.
8. **Destructive action without guard**: Irreversible actions without confirmation, undo, or distinct visual warning.
9. **Truncated text with no access**: Text truncated with ellipsis where the full content is unreachable.
10. **State by animation only**: Animated state changes without a persistent static cue (icon, label, or color) remaining after the animation.

---

## 4. Design Engineering Rules of Thumb

### A. Concentric Border Radius

```
outerRadius = innerRadius + padding
```

- Never use the same border radius on nested elements when padding is small (< 24px).
- Example: If a container has `p-0.5` (2px) and `rounded-control` (8px), the inner button **must** be `rounded-[6px]` (8px - 2px = 6px). Nested equal radii look pinched and amateur.

### B. Optical Over Geometric Alignment

- **Buttons with Icon + Text**: Use 2px less padding on the icon side to counterbalance the icon's visual weight:
  - Icon on left: `pl-3 pr-3.5` (or `pl-2 pr-2.5`) instead of symmetric `px-3.5`.
  - Icon on right: `pl-3.5 pr-3`.
- **Badges with Icons**: Balance the icon side with `pl-1.5 pr-2`.
- **Play triangles & asymmetric glyphs**: Optically adjust 1–2px toward the heavy side.

### C. Scale on Press (Tactile Feedback)

- All interactive buttons must provide tactile feedback using `active:scale-[0.96]`:
  ```tsx
  className =
    'transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transform-none';
  ```
- **Rule**: Always use exactly `0.96`. Never use values smaller than `0.95` (which feel cartoonish).
- Disable via a `static` prop or condition when motion would distract.

### D. Specific Transitions Only (Never `transition: all`)

- **Prohibited**: `transition: all`, `transition-all`.
- **Required**: Specify only the exact properties being animated, e.g.:
  - `transition-[color,background-color,border-color,box-shadow,transform]`
  - `transition-transform duration-150 ease-out`
  - `transition-[border-color,background-color] duration-150 ease-out`

### E. Theme Switch Transition Suppression

- When toggling dark/light mode, the entire document must suppress transitions during the switch frame to prevent jarring color smearing across the page.
- Inject a temporary style sheet `*,*::before,*::after{transition:none !important}`, force a reflow, and remove on the next animation frame.

### F. Tabular Figures for Numbers

- Any dynamically updating metric, file size, processing percentage, timer, or counter **MUST** use `tabular-nums` (or `font-mono` configured with `tnum` and `zero`):
  ```tsx
  <span className="font-mono tabular-nums">{fileSize}</span>
  ```

### G. Text Wrapping

- Headings and titles: use `text-wrap: balance` (`text-balance` in Tailwind) to prevent dangling words on lines.
- Body, descriptions, error text: use `text-wrap: pretty` (`text-pretty` in Tailwind) to eliminate typographical orphans.

### H. Hit Targets (WCAG 2.5.8 + Ergonomics)

- Interactive buttons and icons must maintain at least a **40×40px** hit target in desktop dense UI, and **44×44px** in touch/mobile contexts.
- For compact icon buttons (e.g. 24×24px or 28×28px), extend the hit area invisibly using a pseudo-element:
  ```tsx
  className = "relative after:absolute after:inset-[-6px] after:content-['']";
  ```
- Ensure adjacent pseudo-elements never collide or overlap.

### I. Icons: Centralized Export & Hygiene Rule

- **Mandatory Centralized Import**: All icons used across the project **MUST** be exported from `src/icons.ts` (using Lucide React) and imported from `@/icons` (or `../icons`). **Never import directly from `lucide-react`** in any component or page.
- **Zero Emojis & Zero Custom Icons**: Do not use emojis (e.g. ⚡, 🔥, ✨, 🍕) or custom inline SVGs for UI iconography. Always use Lucide React icons exported through `src/icons.ts`.
- **No AI-Slop / Default Icons**: Avoid generic AI-cliché icons (e.g. `Sparkles` as a fallback or decorative filler) when semantic domain icons (`Settings2`, `SlidersHorizontal`, `CheckCircle2`, `Zap`, `Shield`) exist.
- Lucide React icons must match adjacent text optical weight:
  - 12–14px Regular (400) text: `strokeWidth={1.75}`
  - 14–16px Medium/Semibold (500–600) text: `strokeWidth={2}`
- Icons must use `currentColor` and obtain states via CSS color/opacity.
- Purely decorative icons must have `aria-hidden="true"`.
- Icon-only interactive buttons must have a descriptive `aria-label`.

### J. Image Outlines

- Outlines on images must be neutral and inset:
  - Light mode: pure black `oklch(0 0 0 / 0.1)` (`outline-black/10`)
  - Dark mode: pure white `oklch(1 0 0 / 0.1)` (`outline-white/10`)
  - Inset: `-outline-offset-1`
  - Never use tinted palette neutrals (zinc, slate) as image outlines.

### K. Shared Custom Controls (Invariant)

- All visible selects, checkboxes, radio buttons, and sliders **MUST** use the reusable custom primitives in `src/components/ui/controls.tsx`. Never introduce native `<select>`, `<input type="checkbox">`, `<input type="radio">`, or `<input type="range">` in application UI.
- Build and maintain these components locally; do not install shadcn or another component library to replace them. Theme choices use the shared segmented radio group.
- Preserve accessible names, explicit focus, APG keyboard behavior, persistent selected states, and 44px touch targets. Custom styling never excuses reduced accessibility.
- Semantic buttons and native file inputs remain appropriate. Hidden form inputs may exist inside a primitive for form submission, but must not create duplicate interactive controls.

---

## 5. Pre-Completion Verification Checklist

Before claiming any UI task is complete, run the following verification steps:

1. `pnpm typecheck` — 0 TypeScript errors.
2. `pnpm lint` — 0 ESLint warnings or errors.
3. `pnpm test` — 100% test pass rate.
4. `pnpm build && pnpm check:budget` — Verify production bundle adheres to budget limits (< 150 KB gzipped).
5. Visual Inspection at 10% speed — Check transitions, hover states, active press scales, focus outlines, and dark/light switching.
