import type { PageServerLoad } from './$types';
import { legalCopy } from '$lib/server/legal-copy';

export const load: PageServerLoad = ({ url }) =>
  legalCopy('terms', /(?:^|\\/)id\\/terms\\/?$/.test(url.pathname) ? 'id' : 'en');
