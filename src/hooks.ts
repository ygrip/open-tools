import type { Reroute } from '@sveltejs/kit';
import { deLocalizeUrl } from '$lib/paraglide/runtime.js';

// Keep the original static routes (including /[tool]) while providing /id/ URLs.
export const reroute: Reroute = ({ url }) => deLocalizeUrl(url).pathname;
