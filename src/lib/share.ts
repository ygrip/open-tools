import { base } from '$app/paths';
import { iconPaths, type IconName } from '$lib/components/Icon.svelte';

/*
 * Share cards redraw the site's claymorphism look on a canvas: cream canvas with
 * a dot grid, one chunky clay card with a hard offset "slab" shadow, pastel clay
 * icon tiles and pills. Every colour is read from the live CSS variables, so the
 * card follows the current light/dark theme.
 */
export interface SharePayload {
  title: string;
  description: string;
  eyebrow?: string;
  icon?: IconName;
  chips?: string[];
  icons?: IconName[];
  /** Clay artwork URLs: `art` replaces the main line icon, `arts` the mini tiles. */
  art?: string;
  arts?: (string | undefined)[];
  footnote: string;
  brandTagline: string;
  url: string;
}

const SIZE = 1080;
const CARD = { x: 56, y: 56, w: SIZE - 112, h: SIZE - 128, r: 72 };
const PAD = 72;
const FONT = '"Nunito Variable", Nunito, ui-rounded, "Avenir Next", system-ui, sans-serif';

interface Palette {
  bg: string; surface: string; text: string; muted: string; line: string;
  accent: string; accentStrong: string; onAccent: string;
  peach: string; mint: string; lavender: string; butter: string; highlight: string;
}

function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: get('--bg', '#f6f1e9'), surface: get('--surface', '#fffcf6'), text: get('--text', '#382f2b'),
    muted: get('--muted', '#71645c'), line: get('--line', '#e7dcd0'), accent: get('--accent', '#ef946b'),
    accentStrong: get('--accent-strong', '#ad4527'), onAccent: get('--on-accent', '#38251d'),
    peach: get('--peach', '#f9ddcb'), mint: get('--mint', '#dcebe1'), lavender: get('--lavender', '#eae3f3'),
    butter: get('--butter', '#f3e9c9'), highlight: get('--highlight', 'rgba(255,255,255,.9)')
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Chunky clay slab: hard offset shadow, soft drop shadow, fill, inner top-left highlight. */
function clay(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, w: number, h: number, r: number, fill: string, slab = 10) {
  ctx.save();
  roundRect(ctx, x, y + slab, w, h, r);
  ctx.fillStyle = p.line;
  ctx.fill();
  ctx.shadowColor = 'rgba(91,66,43,.22)';
  ctx.shadowBlur = slab * 3;
  ctx.shadowOffsetY = slab * 1.4;
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const sheen = ctx.createLinearGradient(x, y, x + w * 0.6, y + h * 0.6);
  sheen.addColorStop(0, p.highlight);
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  ctx.save();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(iconPaths[name]));
  ctx.restore();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  let i = 0;
  for (; i < words.length; i += 1) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(next).width <= maxW || !line) { line = next; continue; }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) { lines.push(line); i = words.length; }
  if (i < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1).trimEnd();
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function seeded(text: string) {
  let s = 2166136261;
  for (let i = 0; i < text.length; i += 1) s = Math.imul(s ^ text.charCodeAt(i), 16777619);
  return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); return ((s ^= s >>> 16) >>> 0) / 4294967296; };
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 2500);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

async function loadFonts() {
  if (!document.fonts?.load) return;
  await Promise.race([
    Promise.all([document.fonts.load(`900 80px ${FONT}`), document.fonts.load(`700 30px ${FONT}`)]).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]);
}

function pill(ctx: CanvasRenderingContext2D, p: Palette, text: string, x: number, y: number, fill: string, fontPx: number): number {
  ctx.font = `800 ${fontPx}px ${FONT}`;
  const w = ctx.measureText(text).width + fontPx * 1.7;
  const h = fontPx * 2.1;
  clay(ctx, p, x, y, w, h, h / 2, fill, 5);
  ctx.fillStyle = p.text;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + fontPx * 0.85, y + h / 2 + 1);
  return w;
}

export async function generateShareImage(payload: SharePayload): Promise<Blob | null> {
  const [logo, art, ...arts] = await Promise.all([
    loadImage(`${base}/brand/logo.svg`),
    payload.art ? loadImage(payload.art) : Promise.resolve(null),
    ...(payload.arts ?? []).slice(0, 3).map((src) => src ? loadImage(src) : Promise.resolve(null)),
    loadFonts()
  ]) as (HTMLImageElement | null)[];
  const p = readPalette();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Canvas + dot grid + soft pastel blobs.
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (const [x, y, r, c] of [[0.88, 0.06, 0.5, p.peach], [0.08, 0.95, 0.45, p.mint], [0.96, 0.9, 0.35, p.lavender]] as const) {
    const layer = document.createElement('canvas');
    layer.width = layer.height = SIZE;
    const lctx = layer.getContext('2d');
    if (!lctx) continue;
    lctx.fillStyle = c;
    lctx.fillRect(0, 0, SIZE, SIZE);
    lctx.globalCompositeOperation = 'destination-in';
    const mask = lctx.createRadialGradient(x * SIZE, y * SIZE, 0, x * SIZE, y * SIZE, r * SIZE);
    mask.addColorStop(0, '#000');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = mask;
    lctx.fillRect(0, 0, SIZE, SIZE);
    ctx.drawImage(layer, 0, 0);
  }
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = p.line;
  for (let y = 18; y < SIZE; y += 36) for (let x = 18; x < SIZE; x += 36) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;

  // Decorative clay blobs behind the card.
  const rnd = seeded(payload.title);
  const blobs = [p.peach, p.mint, p.lavender, p.butter];
  for (let i = 0; i < 4; i += 1) {
    const bx = i % 2 ? SIZE - 54 - rnd() * 18 : 54 + rnd() * 18;
    const by = i < 2 ? 70 + rnd() * 40 : SIZE - 160 - rnd() * 30;
    clay(ctx, p, bx - 34, by - 34, 68, 68, 30, blobs[i], 6);
  }

  const { x: cx, y: cy, w: cw, h: ch, r: cr } = CARD;
  clay(ctx, p, cx, cy, cw, ch, cr, p.surface, 18);
  const ix = cx + PAD;
  const iw = cw - PAD * 2;
  ctx.textBaseline = 'alphabetic';

  // Brand row.
  let y = cy + PAD;
  if (logo) ctx.drawImage(logo, ix, y - 4, 76, 76);
  ctx.fillStyle = p.text;
  ctx.font = `900 54px ${FONT}`;
  ctx.fillText('trick', ix + 92, y + 38);
  const trickW = ctx.measureText('trick').width;
  ctx.fillStyle = p.accentStrong;
  ctx.fillText('-it', ix + 92 + trickW, y + 38);
  ctx.fillStyle = p.muted;
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(payload.brandTagline, ix + 92, y + 70);

  // Icon tile(s).
  y += 130;
  const tile = 168;
  if (art) {
    // Clay art is already a lit tile; add only a soft contact shadow.
    ctx.save();
    ctx.shadowColor = 'rgba(67, 46, 32, 0.22)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 12;
    ctx.drawImage(art, ix - 8, y - 8, tile + 16, tile + 16);
    ctx.restore();
  } else {
    clay(ctx, p, ix, y, tile, tile, 56, p.peach, 12);
    drawIcon(ctx, payload.icon ?? 'toolbox', ix + tile / 2, y + tile / 2, 88, p.accentStrong);
  }
  const minis = (payload.icons ?? []).slice(0, 3);
  const minisFill = [p.mint, p.lavender, p.butter];
  minis.forEach((name, i) => {
    const mx = ix + tile + 36 + i * 100;
    const image = arts[i];
    if (image) {
      ctx.save();
      ctx.shadowColor = 'rgba(67, 46, 32, 0.2)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 7;
      ctx.drawImage(image, mx - 4, y + 76, 88, 88);
      ctx.restore();
      return;
    }
    clay(ctx, p, mx, y + 80, 80, 80, 28, minisFill[i % 3], 8);
    drawIcon(ctx, name, mx + 40, y + 120, 40, p.text);
  });
  if (payload.eyebrow) {
    ctx.fillStyle = p.muted;
    ctx.font = `900 26px ${FONT}`;
    ctx.textBaseline = 'alphabetic';
    if (!minis.length) ctx.fillText(payload.eyebrow.toUpperCase(), ix + tile + 36, y + 100);
  }

  // Title + description.
  y += tile + 92;
  ctx.fillStyle = p.text;
  ctx.font = `900 84px ${FONT}`;
  const titleLines = wrap(ctx, payload.title, iw, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, ix, y + i * 92));
  y += titleLines.length * 92 - 8;
  ctx.fillStyle = p.muted;
  ctx.font = `700 34px ${FONT}`;
  const descLines = wrap(ctx, payload.description, iw, 2);
  descLines.forEach((line, i) => ctx.fillText(line, ix, y + 22 + i * 48));
  y += 22 + descLines.length * 48;

  // Chips.
  const chipFills = [p.mint, p.lavender, p.butter, p.peach];
  let chipX = ix;
  const chipY = y + 18;
  // Chips sit above the footer rule; skip them when the copy leaves no room.
  const footerTop = cy + ch - PAD - 56 - 28;
  (payload.chips ?? []).slice(0, 4).forEach((chip, i) => {
    ctx.font = `800 28px ${FONT}`;
    const w = ctx.measureText(chip).width + 48;
    if (chipX + w > ix + iw || chipY + 28 * 2.1 + 5 > footerTop - 14) return;
    chipX += pill(ctx, p, chip, chipX, chipY, chipFills[i % 4], 28) + 18;
  });

  // Footer: privacy pill + host.
  const fy = cy + ch - PAD - 56;
  ctx.fillStyle = p.line;
  ctx.fillRect(ix, fy - 28, iw, 3);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = p.muted;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText(`♥  ${payload.footnote}`, ix, fy + 26);
  const host = new URL(payload.url).host;
  ctx.font = `900 28px ${FONT}`;
  ctx.fillStyle = p.accentStrong;
  ctx.textAlign = 'right';
  ctx.fillText(host, ix + iw, fy + 26);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export function canNativeShare(file: File): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare?.({ files: [file] });
}

export async function nativeShare(payload: SharePayload, text: string, blob: Blob | null): Promise<boolean> {
  if (!navigator.share) return false;
  const file = blob ? new File([blob], 'trick-it.png', { type: 'image/png' }) : null;
  try {
    if (file && canNativeShare(file)) await navigator.share({ title: payload.title, text, url: payload.url, files: [file] });
    else await navigator.share({ title: payload.title, text, url: payload.url });
    return true;
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return true;
    return false;
  }
}

export async function copyLink(url: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(url); return true; } catch { return false; }
}

export function downloadBlob(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
