import type { Reroute } from '@sveltejs/kit';
import { stripLanguagePrefix } from '$lib/languages.js';

/** Resolve every supported language prefix to the same SvelteKit route. */
export const reroute: Reroute = ({ url }) => stripLanguagePrefix(url.pathname);
