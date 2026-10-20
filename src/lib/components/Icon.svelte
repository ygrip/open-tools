<script lang="ts" module>
  export type IconName = 'arrow-left' | 'arrow-right' | 'search' | 'sun' | 'moon' | 'shield' | 'braces' | 'grid' | 'sparkles' | 'github' | 'check' | 'x' | 'toolbox' | 'external' | 'bolt' | 'heart' | 'filter' | 'lock' | 'play' | 'pause' | 'share' | 'link' | 'download' | 'sliders' | 'globe';
  export const iconPaths: Record<IconName, string> = {
    'arrow-left': 'M19 12H5m7-7-7 7 7 7',
    'arrow-right': 'M5 12h14m-7-7 7 7-7 7',
    search: 'M21 21l-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0',
    sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 1.4 1.4m10 10 1.4 1.4m0-12.8L17 7M7 17l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    moon: 'M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z',
    shield: 'M12 3 3.5 6v6c0 5 8.5 9 8.5 9s8.5-4 8.5-9V6L12 3Zm-4 9 2.5 2.5L16 9',
    braces: 'M8 3H6a2 2 0 0 0-2 2v4a3 3 0 0 1-2 3 3 3 0 0 1 2 3v4a2 2 0 0 0 2 2h2m8-18h2a2 2 0 0 1 2 2v4a3 3 0 0 0 2 3 3 3 0 0 0-2 3v4a2 2 0 0 1-2 2h-2',
    grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
    sparkles: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM4 2v4M2 4h4m14 14v4m-2-2h4',
    github: 'M9 19c-4.3 1.3-4.3-2.2-6-2.7m12 5v-3.5c0-1 .1-1.6-.5-2.2 3-.3 6.1-1.5 6.1-6.6a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.2-3.6S17.8 1.4 15 3.2a12.7 12.7 0 0 0-6 0C6.2 1.4 5 1.8 5 1.8a4.8 4.8 0 0 0-.2 3.6 5.2 5.2 0 0 0-1.4 3.6c0 5.1 3.1 6.3 6.1 6.6-.6.6-.5 1.2-.5 2.2v3.5',
    check: 'm5 12 4 4L19 6',
    x: 'm6 6 12 12M6 18 18 6',
    toolbox: 'M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 7h18v13H3V7Zm0 6h18m-12-2v4m6-4v4',
    external: 'M14 3h7v7m0-7L10 14m-1-9H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
    bolt: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',
    heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
    filter: 'M4 7h16M7 12h10m-7 5h4',
    lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3',
    play: 'm8 4 12 8-12 8V4Z',
    pause: 'M8 5v14M16 5v14',
    share: 'M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7',
    link: 'M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7',
    download: 'M12 3v12m0 0 4.5-4.5M12 15l-4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
    sliders: 'M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c-3 2.8-4.5 5.8-4.5 9s1.5 6.2 4.5 9m0-18c3 2.8 4.5 5.8 4.5 9s-1.5 6.2-4.5 9'
  };
</script>

<script lang="ts">
  let { name, size = 22, class: className = '' }: { name: IconName; size?: number; class?: string } = $props();
  const paths = iconPaths;
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class={className}><path d={paths[name]} /></svg>
