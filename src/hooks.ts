import type { Reroute } from '@sveltejs/kit';

/**
 * SvelteKit resolves language-prefixed URLs to the existing prerendered pages.
 * Keep route stripping explicit: the Paraglide runtime handles the active
 * language, but its URL de-localizer returns a URL object intended for its own
 * routing pipeline rather than a SvelteKit route identifier.
 */
export const reroute: Reroute = ({ url }) => {
  if (url.pathname === '/id') return '/';
  if (url.pathname.startsWith('/id/')) return url.pathname.slice(3) || '/';
  return url.pathname;
};
