import { isTheme, type Theme } from '../theme';

// The policy precedes tool markup and cannot be relaxed by a later meta tag.
// Opaque-origin sandboxing is also mandatory: never add allow-same-origin.
export const bundlePolicy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src data:; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";

export const themeMessageType = 'open-tools:theme';

/** Host-owned defaults are available even before a bundle's own styles are parsed. */
const themeStyles = `
:root {
  color-scheme: light !important;
  --ot-bg: #fff8f0 !important;
  --ot-surface: #fffdf9 !important;
  --ot-text: #392f2c !important;
  --ot-muted: #71615a !important;
  --ot-border: #e7d8cc !important;
  --ot-accent: #f7a174 !important;
  --ot-on-accent: #42291e !important;
  --ot-shadow: rgba(62, 36, 20, 0.12) !important;
  --ot-highlight: rgba(255, 255, 255, 0.92) !important;
}
:root[data-theme="dark"] {
  color-scheme: dark !important;
  --ot-bg: #242127 !important;
  --ot-surface: #312c34 !important;
  --ot-text: #fff5eb !important;
  --ot-muted: #cbbab3 !important;
  --ot-border: #514650 !important;
  --ot-accent: #ffb18b !important;
  --ot-on-accent: #3e251d !important;
  --ot-shadow: rgba(0, 0, 0, 0.35) !important;
  --ot-highlight: rgba(255, 255, 255, 0.075) !important;
}
html, body { background-color: var(--ot-bg) !important; color: var(--ot-text) !important; }
`;

// This runs before bundle scripts. Opaque frames have a "null" origin, so source
// identity—not event.origin—is the boundary. No reply or user data leaves the frame.
const themeBootstrap = `
(() => {
  addEventListener('message', (event) => {
    if (event.source !== parent) return;
    const message = event.data;
    if (!message || typeof message !== 'object' ||
        message.type !== '${themeMessageType}' || message.version !== 1 ||
        (message.theme !== 'light' && message.theme !== 'dark')) return;
    document.documentElement.dataset.theme = message.theme;
    document.documentElement.style.colorScheme = message.theme;
  });
})();
`;

export function sandboxDocument(html: string, initialTheme: Theme = 'light'): string {
  // Keep interpolation restricted to the enum even if called from untyped code.
  const theme = isTheme(initialTheme) ? initialTheme : 'light';
  return `<!doctype html><html lang="en" data-theme="${theme}" style="color-scheme:${theme}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${bundlePolicy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${themeStyles}</style><script>${themeBootstrap}</script></head><body>${html}</body></html>`;
}
