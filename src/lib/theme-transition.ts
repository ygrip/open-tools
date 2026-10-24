let activeTransition: ViewTransition | undefined;

/** Reveal the new theme from its control; state never depends on animation support. */
export async function revealTheme(button: HTMLElement, update: () => Promise<void>): Promise<void> {
  activeTransition?.skipTransition();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reducedMotion) {
    await update();
    return;
  }

  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(update);
  activeTransition = transition;
  try {
    await transition.ready;
    const animation = document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 450, easing: 'ease-out', pseudoElement: '::view-transition-new(root)' }
    );
    await animation.finished;
  } catch (error) {
    // Replaced transitions may be skipped by the browser or another theme control.
    if (!(error instanceof DOMException && error.name === 'AbortError')) {
      console.error('Theme reveal animation failed', error);
    }
  } finally {
    await transition.updateCallbackDone;
    if (activeTransition === transition) activeTransition = undefined;
  }
}
