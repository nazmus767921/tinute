import { describe, it, expect } from 'vitest';

/**
 * WCAG 2.1 relative luminance calculation
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function sRGBtoLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const max = Math.max(l1, l2);
  const min = Math.min(l1, l2);
  return (max + 0.05) / (min + 0.05);
}

describe('Design Tokens & WCAG AA Contrast Compliance', () => {
  const lightTokens = {
    canvas: '#FAFAF9',
    surface: '#FFFFFF',
    text: '#1C1917',
    muted: '#78716C',
    accent: '#4F46E5',
    accentContrast: '#FFFFFF',
    savingsText: '#15803D',
    lossyText: '#B45309',
  };

  const darkTokens = {
    canvas: '#0B0B0C',
    surface: '#151517',
    text: '#EDEDED',
    muted: '#8A8A93',
    accent: '#818CF8',
    accentContrast: '#0B0B0C',
    savingsText: '#4ADE80',
    lossyText: '#FBBF24',
  };

  it('Light Theme: Primary text meets WCAG AAA (≥ 7:1) on Canvas and Surface', () => {
    const onCanvas = getContrastRatio(lightTokens.text, lightTokens.canvas);
    const onSurface = getContrastRatio(lightTokens.text, lightTokens.surface);

    expect(onCanvas).toBeGreaterThanOrEqual(7.0);
    expect(onSurface).toBeGreaterThanOrEqual(7.0);
  });

  it('Light Theme: Muted text meets WCAG AA (≥ 4.5:1) on Canvas and Surface', () => {
    const onCanvas = getContrastRatio(lightTokens.muted, lightTokens.canvas);
    const onSurface = getContrastRatio(lightTokens.muted, lightTokens.surface);

    expect(onCanvas).toBeGreaterThanOrEqual(4.5);
    expect(onSurface).toBeGreaterThanOrEqual(4.5);
  });

  it('Light Theme: Accent meets WCAG AA (≥ 4.5:1) as text and has accessible contrast button text', () => {
    const onCanvas = getContrastRatio(lightTokens.accent, lightTokens.canvas);
    const onSurface = getContrastRatio(lightTokens.accent, lightTokens.surface);
    const textOnAccent = getContrastRatio(lightTokens.accentContrast, lightTokens.accent);

    expect(onCanvas).toBeGreaterThanOrEqual(4.5);
    expect(onSurface).toBeGreaterThanOrEqual(4.5);
    expect(textOnAccent).toBeGreaterThanOrEqual(4.5);
  });

  it('Dark Theme: Primary text meets WCAG AAA (≥ 7:1) on Canvas and Surface', () => {
    const onCanvas = getContrastRatio(darkTokens.text, darkTokens.canvas);
    const onSurface = getContrastRatio(darkTokens.text, darkTokens.surface);

    expect(onCanvas).toBeGreaterThanOrEqual(7.0);
    expect(onSurface).toBeGreaterThanOrEqual(7.0);
  });

  it('Dark Theme: Muted text meets WCAG AA (≥ 4.5:1) on Canvas and Surface', () => {
    const onCanvas = getContrastRatio(darkTokens.muted, darkTokens.canvas);
    const onSurface = getContrastRatio(darkTokens.muted, darkTokens.surface);

    expect(onCanvas).toBeGreaterThanOrEqual(4.5);
    expect(onSurface).toBeGreaterThanOrEqual(4.5);
  });

  it('Dark Theme: Accent meets WCAG AA (≥ 4.5:1) and has high-contrast dark button text', () => {
    const onCanvas = getContrastRatio(darkTokens.accent, darkTokens.canvas);
    const onSurface = getContrastRatio(darkTokens.accent, darkTokens.surface);
    const textOnAccent = getContrastRatio(darkTokens.accentContrast, darkTokens.accent);

    expect(onCanvas).toBeGreaterThanOrEqual(4.5);
    expect(onSurface).toBeGreaterThanOrEqual(4.5);
    expect(textOnAccent).toBeGreaterThanOrEqual(4.5);
  });

  it('Feedback states: Savings and Lossy text tokens meet WCAG AA (≥ 4.5:1)', () => {
    // Light mode
    expect(getContrastRatio(lightTokens.savingsText, lightTokens.canvas)).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(getContrastRatio(lightTokens.lossyText, lightTokens.canvas)).toBeGreaterThanOrEqual(4.5);

    // Dark mode
    expect(getContrastRatio(darkTokens.savingsText, darkTokens.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(darkTokens.lossyText, darkTokens.canvas)).toBeGreaterThanOrEqual(4.5);
  });
});
