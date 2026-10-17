import type { Handle, HandleServerError } from '@sveltejs/kit';
import { reportUnexpectedError } from '$lib/errors';
import { paraglideMiddleware } from '$lib/paraglide/server.js';
import { getTextDirection } from '$lib/paraglide/runtime.js';

export const handleError: HandleServerError = ({ error, status }) => reportUnexpectedError(error, status, 'server');

export const handle: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, async ({ request, locale }) => {
    const response = await resolve({ ...event, request }, {
      transformPageChunk: ({ html }) =>
        html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale))
    });
    if (response.status < 400) return response;
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  });
