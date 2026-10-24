/** Keep browser magnification on the host fixed; tools implement their own zoom. */
export function containHostZoom(document: Document): () => void {
  const preventWheelZoom = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  };
  const preventKeyZoom = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '0'].includes(event.key)) event.preventDefault();
  };
  const preventPinchZoom = (event: TouchEvent) => {
    if (event.touches.length > 1) event.preventDefault();
  };
  const preventGestureZoom = (event: Event) => event.preventDefault();
  document.addEventListener('wheel', preventWheelZoom, { passive: false });
  document.addEventListener('keydown', preventKeyZoom);
  document.addEventListener('touchstart', preventPinchZoom, { passive: false });
  document.addEventListener('touchmove', preventPinchZoom, { passive: false });
  document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
  document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
  return () => {
    document.removeEventListener('wheel', preventWheelZoom);
    document.removeEventListener('keydown', preventKeyZoom);
    document.removeEventListener('touchstart', preventPinchZoom);
    document.removeEventListener('touchmove', preventPinchZoom);
    document.removeEventListener('gesturestart', preventGestureZoom);
    document.removeEventListener('gesturechange', preventGestureZoom);
  };
}
