<script lang="ts">
  import { base } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { localizedPath } from '$lib/i18n';
  import Icon from './Icon.svelte';
</script>

<footer class="site-footer surface">
  <div class="footer-blobs" aria-hidden="true"><span></span><span></span><span></span></div>
  <div class="footer-top">
    <div class="footer-about">
      <a class="brand footer-brand" href={localizedPath('/')}><img src={`${base}/brand/logo.svg`} alt="" width="40" height="40" /><strong>trick<span class="brand-accent">-it</span></strong></a>
      <p>{m.footer_tagline()}</p>
    </div>
    <nav class="footer-col" aria-label={m.footer_explore()}>
      <h2>{m.footer_explore()}</h2>
      <ul>
        <li><a href={`${localizedPath('/')}#tools`}><Icon name="grid" size={17} /> {m.nav_toolbox()}</a></li>
        <li><a href={`${localizedPath('/')}#how-it-works`}><Icon name="sparkles" size={17} /> {m.nav_how()}</a></li>
        <li><a href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer" aria-label={m.brand_github()}><Icon name="github" size={17} /> {m.footer_open_source()}</a></li>
      </ul>
    </nav>
    <nav class="footer-col" aria-label={m.nav_legal()}>
      <h2>{m.footer_legal()}</h2>
      <ul>
        <li><a href={localizedPath('/privacy/')}><Icon name="lock" size={17} /> {m.footer_privacy()}</a></li>
        <li><a href={localizedPath('/terms/')}><Icon name="shield" size={17} /> {m.footer_terms()}</a></li>
        <li><a href={localizedPath('/policy/')}><Icon name="toolbox" size={17} /> {m.footer_policy()}</a></li>
      </ul>
    </nav>
  </div>
</footer>
