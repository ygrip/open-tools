import type { HandleClientError } from '@sveltejs/kit';
import { reportUnexpectedError } from '$lib/errors';

export const handleError: HandleClientError = ({ error, status }) => reportUnexpectedError(error, status, 'client');
