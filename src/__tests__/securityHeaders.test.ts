import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SECURITY_HEADERS } from '../config/security';

describe('Security Headers Configuration (COOP, COEP & Strict CSP)', () => {
  it('configures Cross-Origin-Opener-Policy as same-origin', () => {
    expect(SECURITY_HEADERS['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });

  it('configures Cross-Origin-Embedder-Policy as require-corp', () => {
    expect(SECURITY_HEADERS['Cross-Origin-Embedder-Policy']).toBe('require-corp');
  });

  it('configures strict CSP disallowing external domains', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('public/_headers mirrors identical COOP/COEP and CSP policies for Cloudflare Pages', () => {
    const headersPath = path.resolve(process.cwd(), 'public/_headers');
    expect(fs.existsSync(headersPath)).toBe(true);

    const content = fs.readFileSync(headersPath, 'utf-8');
    expect(content).toContain('Cross-Origin-Opener-Policy: same-origin');
    expect(content).toContain('Cross-Origin-Embedder-Policy: require-corp');
    expect(content).toContain("default-src 'self'");
    expect(content).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(content).toContain('X-Frame-Options: DENY');
  });
});
