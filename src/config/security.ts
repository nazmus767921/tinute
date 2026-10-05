/**
 * Security headers configuration for Tinute:
 * - Cross-Origin-Opener-Policy (COOP): same-origin
 * - Cross-Origin-Embedder-Policy (COEP): require-corp
 * - Content-Security-Policy (CSP): strict sandbox disallowing remote assets, enabling WebAssembly
 */

export const CSP_DIRECTIVES_PRODUCTION = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export const CSP_DIRECTIVES_DEV = [
  "default-src 'self'",
  // Vite HMR and @vitejs/plugin-react preamble require inline module execution during dev
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' blob: ws: wss:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export function getSecurityHeaders(isDev: boolean = false) {
  return {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Content-Security-Policy': isDev ? CSP_DIRECTIVES_DEV : CSP_DIRECTIVES_PRODUCTION,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  };
}

export const SECURITY_HEADERS = getSecurityHeaders(false);
