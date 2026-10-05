<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    images?: string[];
    anchor?: HTMLElement | null;
    className?: string;
  }

  let { images = ['/icons/tool.svg', '/icons/time.svg'], anchor = null, className = '' }: Props = $props();

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  onMount(() => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarse = window.matchMedia('(pointer: coarse)');
    let frame = 0;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let loaded: HTMLImageElement[] = [];
    let current = 0;
    let nextSwap = performance.now() + 4200;

    const pointer = { x: -9999, y: -9999, active: false };

    function loadImage(src: string) {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
      });
    }

    function resize() {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function sample(image: HTMLImageElement, cols: number, rows: number) {
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = cols;
      sampleCanvas.height = rows;
      const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      if (!sampleCtx) return new Float32Array(cols * rows);

      const ratio = Math.min(cols / image.naturalWidth, rows / image.naturalHeight);
      const width = image.naturalWidth * ratio;
      const height = image.naturalHeight * ratio;
      const x = (cols - width) / 2;
      const y = (rows - height) / 2;

      sampleCtx.clearRect(0, 0, cols, rows);
      sampleCtx.drawImage(image, x, y, width, height);
      const pixels = sampleCtx.getImageData(0, 0, cols, rows).data;
      const tone = new Float32Array(cols * rows);

      for (let i = 0; i < tone.length; i += 1) {
        const p = i * 4;
        const alpha = pixels[p + 3] / 255;
        const lum = (pixels[p] + pixels[p + 1] + pixels[p + 2]) / (255 * 3);
        tone[i] = alpha * Math.max(0.15, 1 - lum * 0.35);
      }

      return tone;
    }

    function draw(now: number) {
      if (disposed) return;

      const rect = host.getBoundingClientRect();
      const slot = anchor?.getBoundingClientRect();
      const spacing = rect.width < 700 ? 8 : 7;
      const cols = Math.ceil(rect.width / spacing) + 1;
      const rows = Math.ceil(rect.height / spacing) + 1;
      const subjectCols = 34;
      const subjectRows = 34;

      const image = loaded[current];
      const tone = image ? sample(image, subjectCols, subjectRows) : new Float32Array(subjectCols * subjectRows);

      const cx = slot ? slot.left - rect.left + slot.width / 2 : rect.width * 0.74;
      const cy = slot ? slot.top - rect.top + slot.height / 2 : rect.height * 0.5;
      const subjectWidth = Math.min(slot?.width ?? rect.width * 0.34, 290);
      const subjectHeight = Math.min(slot?.height ?? rect.height * 0.7, 290);

      ctx.clearRect(0, 0, rect.width, rect.height);
      const accent = getComputedStyle(host).getPropertyValue('--amber').trim() || '#f59e0b';

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = col * spacing;
          const y = row * spacing;
          const u = (x - (cx - subjectWidth / 2)) / subjectWidth;
          const v = (y - (cy - subjectHeight / 2)) / subjectHeight;
          const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;

          let strength = 0.08;
          if (inside && image) {
            const sx = Math.min(subjectCols - 1, Math.max(0, Math.floor(u * subjectCols)));
            const sy = Math.min(subjectRows - 1, Math.max(0, Math.floor(v * subjectRows)));
            const radial = Math.hypot((u - 0.5) / 0.58, (v - 0.5) / 0.58);
            const feather = Math.max(0, Math.min(1, 1.12 - radial));
            strength = Math.max(strength, tone[sy * subjectCols + sx] * feather);
          }

          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          const push = pointer.active && distance < 90 ? (1 - distance / 90) : 0;
          const wobble = reducedMotion.matches ? 0 : Math.sin(now / 900 + col * 0.28 + row * 0.2) * 0.08;
          const radius = 0.65 + strength * 2.35 + push * 1.25 + wobble;

          ctx.globalAlpha = Math.min(0.95, 0.14 + strength * 0.82 + push * 0.25);
          ctx.fillStyle = accent;
          ctx.beginPath();
          ctx.arc(x + (push ? dx / Math.max(distance, 1) * 6 : 0), y + (push ? dy / Math.max(distance, 1) * 6 : 0), Math.max(0.45, radius), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;

      if (!reducedMotion.matches && loaded.length > 1 && now >= nextSwap) {
        current = (current + 1) % loaded.length;
        nextSwap = now + 4200;
      }

      if (!reducedMotion.matches) frame = requestAnimationFrame(draw);
    }

    function move(event: PointerEvent) {
      const rect = host.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = true;
    }

    function leave() {
      pointer.active = false;
    }

    Promise.all(images.map(loadImage))
      .then((result) => {
        if (disposed) return;
        loaded = result;
        resize();
        draw(performance.now());
      })
      .catch(() => {
        resize();
        draw(performance.now());
      });

    resizeObserver = new ResizeObserver(() => {
      resize();
      if (reducedMotion.matches) draw(performance.now());
    });
    resizeObserver.observe(host);

    if (!coarse.matches) {
      host.addEventListener('pointermove', move);
      host.addEventListener('pointerleave', leave);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
    };
  });
</script>

<div bind:this={host} class="dot-field {className}" aria-hidden="true">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .dot-field {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: auto;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
