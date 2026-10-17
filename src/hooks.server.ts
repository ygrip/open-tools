import type { Handle, HandleServerError } from '@sveltejs/kit';
import { reportUnexpectedError } from '$lib/errors';

export const handleError: HandleServerError = ({ error, status }) => reportUnexpectedError(error, status, 'server');

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  if (response.status < 400) return response;
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};
