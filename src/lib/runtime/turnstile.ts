export type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }
let loading: Promise<TurnstileApi> | undefined;
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    const timer = setTimeout(() => { script.remove(); reject(new Error('verification')); },15_000);
    script.onload = () => { clearTimeout(timer); if(window.turnstile) resolve(window.turnstile); else {script.remove();reject(new Error('verification'));} };
    script.onerror = () => {clearTimeout(timer);script.remove();reject(new Error('verification'));};
    document.head.append(script);
  });
  void loading.catch(() => { loading = undefined; });
  return loading;
}
