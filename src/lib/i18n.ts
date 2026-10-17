import { base } from '$app/paths';
import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';

// Only localize navigation paths. Static assets and bundle URLs stay at /.
export const localizedPath = (pathname: string) => `${base}${localizeHref(pathname, { locale: getLocale() })}`;
