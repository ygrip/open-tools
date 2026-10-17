<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Icon from './Icon.svelte';
  import { m } from '$lib/paraglide/messages.js';

  let artwork = $state<HTMLDivElement>();
  let visible = $state(false);
  let hidden = $state(false);
  let paused = $state(false);

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

<div class="hero-art surface" class:motion-running={visible && !hidden && !paused} bind:this={artwork}>
  <div class="art-caption"><span class="status-dot"></span> {m.hero_caption()}</div>
  <img src={`${base}/illustrations/clay-workbench-768.webp`} srcset={`${base}/illustrations/clay-workbench-448.webp 448w, ${base}/illustrations/clay-workbench-768.webp 768w`} sizes="(max-width: 760px) calc(100vw - 64px), 480px" width="768" height="768" fetchpriority="high" decoding="async" alt={m.hero_alt()} />
  <span class="hero-beam" aria-hidden="true"></span>
  <span class="hero-spark spark-one" aria-hidden="true"><Icon name="sparkles" size={23} /></span>
  <span class="hero-spark spark-two" aria-hidden="true"><Icon name="sparkles" size={17} /></span>
  <button class="motion-toggle icon-button" type="button" aria-label={paused ? m.hero_play() : m.hero_pause()} onclick={() => paused = !paused}>
    <Icon name={paused ? 'play' : 'pause'} size={18} />
  </button>
  <span class="art-sticker"><Icon name="heart" size={16} /> {m.hero_sticker()}</span>
</div>

<style>
  /* Original CSS treatment inspired by Libraries.dev's border-beam concept.
     No React runtime, canvas, shader, animation package, or per-frame JavaScript. */
  .hero-art img { animation: clay-float 7s ease-in-out infinite; animation-play-state: paused; }
  .hero-beam { position: absolute; inset: 0; padding: 3px; border-radius: inherit; pointer-events: none; mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); mask-composite: exclude; }
  .hero-beam::before { content: ''; position: absolute; inset: -65%; background: conic-gradient(transparent 0deg 260deg, #ffc06d 290deg, #fff9e9 315deg, #b9dfcb 335deg, transparent 355deg); animation: beam-orbit 14s linear infinite; animation-play-state: paused; }
  .hero-spark { position: absolute; color: #946019; pointer-events: none; animation: sparkle-bob 5s ease-in-out infinite; animation-play-state: paused; }
  .spark-one { left: 9%; top: 28%; }
  .spark-two { right: 11%; bottom: 22%; animation-delay: -2.5s; }
  .motion-running img, .motion-running .hero-beam::before, .motion-running .hero-spark { animation-play-state: running; }
  .motion-toggle { position: absolute; z-index: 2; right: 14px; top: 14px; background: #fff4df; color: #62442d; border-color: #e9cca7; }
  .motion-toggle:focus-visible { outline-color: #62442d; }
  .art-caption { max-width: calc(100% - 90px); }
  @keyframes clay-float { 0%, 100% { transform: translateY(0) scale(1.04) rotate(-.3deg); } 50% { transform: translateY(-4px) scale(1.04) rotate(.3deg); } }
  @keyframes beam-orbit { to { transform: rotate(360deg); } }
  @keyframes sparkle-bob { 0%, 100% { transform: translateY(0) rotate(-8deg); opacity: .55; } 50% { transform: translateY(-7px) rotate(8deg); opacity: .9; } }
  @media (prefers-reduced-motion: reduce) {
    .hero-art img, .hero-beam::before, .hero-spark { animation: none !important; transform: none; }
    .hero-beam, .motion-toggle { display: none; }
  }
</style>
