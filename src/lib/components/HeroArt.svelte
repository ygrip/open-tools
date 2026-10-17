<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Icon from './Icon.svelte';
  import { m } from '$lib/paraglide/messages.js';

  let artwork = $state<HTMLDivElement>();
  let visible = $state(false);
  let hidden = $state(false);

  onMount(() => {
    const updateVisibility = () => { hidden = document.hidden; };
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    if (observer && artwork) observer.observe(artwork);
    else visible = true;
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  });
</script>

<div class="hero-art surface" class:motion-running={visible && !hidden} bind:this={artwork}>
  <div class="art-caption"><span class="status-dot"></span> {m.hero_caption()}</div>
  <img src={`${base}/illustrations/clay-workbench-768.webp`} srcset={`${base}/illustrations/clay-workbench-448.webp 448w, ${base}/illustrations/clay-workbench-768.webp 768w`} sizes="(max-width: 760px) calc(100vw - 64px), 480px" width="768" height="768" fetchpriority="high" decoding="async" alt={m.hero_alt()} />
  <span class="hero-beam" aria-hidden="true"></span>
  <span class="hero-spark spark-one" aria-hidden="true"><Icon name="sparkles" size={23} /></span>
  <span class="hero-spark spark-two" aria-hidden="true"><Icon name="sparkles" size={17} /></span>
  <span class="hero-spark spark-three" aria-hidden="true"><Icon name="sparkles" size={14} /></span>
  <span class="hero-bubble bubble-one" aria-hidden="true"></span>
  <span class="hero-bubble bubble-two" aria-hidden="true"></span>
  <span class="hero-bubble bubble-three" aria-hidden="true"></span>
  <span class="hero-heart heart-one" aria-hidden="true"><Icon name="heart" size={18} /></span>
  <span class="hero-heart heart-two" aria-hidden="true"><Icon name="heart" size={14} /></span>
  <span class="art-sticker"><Icon name="heart" size={16} /> {m.hero_sticker()}</span>
</div>

<style>
  /* Cute, CSS-only motion: squishy bob, twinkling sparkles, rising bubbles and hearts.
     Runs only while visible; no per-frame JavaScript, no controls needed. */
  .hero-art img { transform-origin: 50% 90%; animation: clay-bob 4.2s cubic-bezier(.45, 0, .25, 1) infinite; animation-play-state: paused; }
  .hero-art:hover img { animation-duration: 2.4s; }
  .hero-beam { position: absolute; inset: 0; padding: 3px; border-radius: inherit; pointer-events: none; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; }
  .hero-beam::before { content: ''; position: absolute; inset: -65%; background: conic-gradient(transparent 0deg 260deg, #ffc06d 290deg, #fff9e9 315deg, #b9dfcb 335deg, transparent 355deg); animation: beam-orbit 14s linear infinite; animation-play-state: paused; }
  .hero-spark, .hero-heart, .hero-bubble { position: absolute; pointer-events: none; animation-play-state: paused; }
  .hero-spark { color: #946019; animation: twinkle 2.6s ease-in-out infinite; }
  .spark-one { left: 9%; top: 28%; }
  .spark-two { right: 11%; bottom: 22%; animation-delay: -1.3s; }
  .spark-three { right: 24%; top: 17%; animation-delay: -.7s; }
  .hero-heart { color: #d8664f; bottom: 20%; opacity: 0; animation: heart-rise 4.8s ease-in infinite; }
  .heart-one { left: 22%; }
  .heart-two { left: 70%; animation-delay: -2.4s; animation-duration: 5.6s; }
  .hero-bubble { border-radius: 50%; background: radial-gradient(circle at 32% 28%, #fffaf0, #ffd9a8 70%); box-shadow: 0 3px 0 #e9cca7; opacity: .85; animation: bubble-float 5s ease-in-out infinite; }
  .bubble-one { width: 20px; height: 20px; left: 6%; bottom: 36%; }
  .bubble-two { width: 13px; height: 13px; right: 8%; top: 40%; background: radial-gradient(circle at 32% 28%, #f4fff8, #b9dfcb 70%); animation-delay: -1.8s; }
  .bubble-three { width: 16px; height: 16px; right: 20%; bottom: 10%; background: radial-gradient(circle at 32% 28%, #fbf6ff, #cdbfe6 70%); animation-delay: -3.2s; }
  .art-sticker { animation: sticker-wiggle 3.4s ease-in-out infinite; animation-play-state: paused; transform-origin: 80% 80%; }
  .motion-running img, .motion-running .hero-spark, .motion-running .hero-heart, .motion-running .hero-bubble, .motion-running .art-sticker { animation-play-state: running; }
  /* Masked conic beam repaints every frame: spin it only while the card is hovered or focused. */
  .motion-running:hover .hero-beam::before, .motion-running:focus-within .hero-beam::before { animation-play-state: running; }
  @keyframes clay-bob {
    0%, 100% { transform: translateY(0) scale(1.04, 1.04) rotate(-.4deg); }
    30% { transform: translateY(-9px) scale(1.035, 1.055) rotate(.5deg); }
    55% { transform: translateY(1px) scale(1.06, 1.025) rotate(.2deg); }
    75% { transform: translateY(-3px) scale(1.04, 1.045) rotate(-.3deg); }
  }
  @keyframes beam-orbit { to { transform: rotate(360deg); } }
  @keyframes twinkle { 0%, 100% { transform: scale(.7) rotate(-12deg); opacity: .35; } 50% { transform: scale(1.15) rotate(12deg); opacity: 1; } }
  @keyframes heart-rise { 0% { transform: translateY(0) scale(.5); opacity: 0; } 15% { opacity: .9; } 100% { transform: translateY(-120px) translateX(10px) scale(1.1); opacity: 0; } }
  @keyframes bubble-float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-14px) scale(1.12, .94); } }
  @keyframes sticker-wiggle { 0%, 100% { transform: rotate(-3deg); } 8% { transform: rotate(3deg) scale(1.06); } 16% { transform: rotate(-4deg); } 24% { transform: rotate(-3deg) scale(1); } }
  @media (prefers-reduced-motion: reduce) {
    .hero-art img, .hero-beam::before, .hero-spark, .hero-heart, .hero-bubble, .art-sticker { animation: none !important; }
    .hero-beam, .hero-heart { display: none; }
  }
</style>
