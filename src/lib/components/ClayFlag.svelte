<script lang="ts">
  // Drawn as a lightweight, scalable flag rather than a platform-dependent emoji.
  // Individual SVG IDs prevent a flag in the header from affecting its mobile copy.
  let { locale, size = 28 }: { locale: 'en' | 'id'; size?: number } = $props();
  const id = $props.id();
  const shape = 'M2.5 4.5C10.7 1.5 17.8 6.4 25.6 4.6C30.4 3.5 34.6 3.4 37.5 4.4V23.8C29.4 21.8 22.2 26.2 14.6 24.3C9.4 23 5.7 23.1 2.5 24.5Z';
</script>

<svg class="clay-flag" width={size} height={Math.round(size * 0.7)} viewBox="0 0 40 28" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id={id + '-clip'}><path d={shape} /></clipPath>
    <linearGradient id={id + '-fold'} x1="0%" y1="0%" x2="100%" y2="7%">
      <stop offset="0" stop-color="#fff" stop-opacity=".34" />
      <stop offset=".21" stop-color="#fff" stop-opacity=".04" />
      <stop offset=".44" stop-color="#101a30" stop-opacity=".17" />
      <stop offset=".64" stop-color="#fff" stop-opacity=".24" />
      <stop offset=".85" stop-color="#0a192f" stop-opacity=".14" />
      <stop offset="1" stop-color="#fff" stop-opacity=".15" />
    </linearGradient>
    <linearGradient id={id + '-shine'} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0" stop-color="#fff" stop-opacity=".36" />
      <stop offset=".42" stop-color="#fff" stop-opacity="0" />
      <stop offset="1" stop-color="#080d19" stop-opacity=".13" />
    </linearGradient>
  </defs>
  <g clip-path={'url(#' + id + '-clip)'}>
    {#if locale === 'id'}
      <rect x="0" y="0" width="40" height="28" fill="#fbfaf6" />
      <path d="M0 0H40V14H0Z" fill="#de2538" />
    {:else}
      <rect x="0" y="0" width="40" height="28" fill="#24477f" />
      <!-- The diagonals and crosses are clipped into the same soft waving silhouette. -->
      <path d="M-6-4 0-7 46 30 40 34ZM40-7 46-4 0 34-6 30Z" fill="#f7f5ee" />
      <path d="M-6-4-3-6 46 32 43 35ZM43-6 46-4-3 32-6 30Z" fill="#cc3142" />
      <path d="M15 0H25V28H15ZM0 9H40V19H0Z" fill="#faf8f1" />
      <path d="M17.5 0H22.5V28H17.5ZM0 11.5H40V16.5H0Z" fill="#d6273e" />
    {/if}
    <rect x="0" y="0" width="40" height="28" fill={'url(#' + id + '-fold)'} />
    <rect x="0" y="0" width="40" height="28" fill={'url(#' + id + '-shine)'} />
  </g>
  <path d={shape} fill="none" stroke="#fff" stroke-opacity=".6" stroke-width=".85" />
</svg>

<style>
  .clay-flag {
    display: block;
    flex: 0 0 auto;
    overflow: visible;
    filter: drop-shadow(0 1.5px 1px rgb(45 35 38 / .24));
    transform: rotate(-2deg);
  }
  @media (forced-colors: active) { .clay-flag { filter: none; } }
</style>
