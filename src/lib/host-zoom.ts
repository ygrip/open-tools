/** Block accidental trackpad zoom while preserving keyboard and mobile magnification. */
export function containHostZoom(document: Document): () => void {
  const preventWheelZoom = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  };
  document.addEventListener('wheel', preventWheelZoom, { passive: false });
  return () => {
    document.removeEventListener('wheel', preventWheelZoom);
  };
}
