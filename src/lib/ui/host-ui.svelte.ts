/**
 * Centralized host UI: toasts and centred popups shared by the host and by tools
 * (via `trickIt.ui`). Rendered once by `HostUi.svelte` in the root layout.
 */
export type ToastTone = 'info' | 'success' | 'error';
export type Toast = { id: number; message: string; tone: ToastTone; source?: { id: string; name: string } };
export type DialogOptions = {
  kind: 'info' | 'confirm';
  title: string;
  message?: string;
  items?: string[];
  ordered?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  /** Popups requested by a tool are attributed to it so they cannot pass as host prompts. */
  source?: { id: string; name: string; icon?: string };
};
type ActiveDialog = DialogOptions & { id: number; resolve: (value: boolean) => void };

const MAX_TOASTS = 3;
let sequence = 0;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const hostUi = $state<{ toasts: Toast[]; dialog: ActiveDialog | null }>({ toasts: [], dialog: null });

export function dismissToast(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  hostUi.toasts = hostUi.toasts.filter((toast) => toast.id !== id);
}

export function showToast(message: string, tone: ToastTone = 'info', source?: Toast['source'], duration = 4000) {
  const toast: Toast = { id: ++sequence, message, tone, source };
  hostUi.toasts = [...hostUi.toasts, toast];
  while (hostUi.toasts.length > MAX_TOASTS) dismissToast(hostUi.toasts[0].id);
  timers.set(toast.id, setTimeout(() => dismissToast(toast.id), Math.max(1500, Math.min(10000, duration))));
  return toast.id;
}

/** Resolves true when confirmed (or acknowledged), false when cancelled. One popup at a time. */
export function openDialog(options: DialogOptions): Promise<boolean> {
  if (hostUi.dialog) return Promise.reject(new Error('busy'));
  return new Promise((resolve) => { hostUi.dialog = { ...options, id: ++sequence, resolve }; });
}

export function closeDialog(value: boolean) {
  const dialog = hostUi.dialog;
  if (!dialog) return;
  hostUi.dialog = null;
  dialog.resolve(value);
}
