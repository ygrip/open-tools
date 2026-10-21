import type { PageServerLoad } from './$types';
import { legalCopy } from '$lib/server/legal-copy';

export const load: PageServerLoad = ({ url }) =>
  legalCopy('terms', url.pathname.endsWith('/id/terms/') || url.pathname.endsWith('/id/terms') ? 'id' : 'en');
