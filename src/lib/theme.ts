export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'open-tools-theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/** The root attribute is the single source of truth after app.html initializes it. */
export function documentTheme(document: Document): Theme {
  const theme = document.documentElement.dataset.theme;
  if (isTheme(theme)) return theme;
  return document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** A denied storage write must not prevent the theme changing for this visit. */
export function applyTheme(document: Document, theme: Theme): boolean {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}
