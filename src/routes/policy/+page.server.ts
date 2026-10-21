import type { PageServerLoad } from './$types';
import { legalCopy } from '$lib/server/legal-copy';

export const load: PageServerLoad = ({ url }) =>
  legalCopy('policy', /(?:^|\\/)id\\/policy\\/?$/.test(url.pathname) ? 'id' : 'en');
