import type { PageServerLoad } from './$types';
import { legalCopy } from '$lib/server/legal-copy';

export const load: PageServerLoad = ({ url }) =>
  legalCopy('policy', url.pathname.endsWith('/id/policy/') || url.pathname.endsWith('/id/policy') ? 'id' : 'en');
