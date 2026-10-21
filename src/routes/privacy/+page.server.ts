import type { PageServerLoad } from './$types';
import { legalCopy } from '$lib/server/legal-copy';

export const load: PageServerLoad = ({ url }) =>
  legalCopy('privacy', url.pathname.endsWith('/id/privacy/') || url.pathname.endsWith('/id/privacy') ? 'id' : 'en');
