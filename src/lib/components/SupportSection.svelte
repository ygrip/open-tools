<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Icon from './Icon.svelte';

  const options = [
    { id: 'trakteer', href: 'https://trakteer.id/yunaz_gilang', tone: 'peach', title: m.support_trakteer, note: m.support_trakteer_note },
    { id: 'kofi', href: 'https://ko-fi.com/ygrip', tone: 'mint', title: m.support_kofi, note: m.support_kofi_note },
    { id: 'patreon', href: 'https://www.patreon.com/c/ygrip', tone: 'lavender', title: m.support_patreon, note: m.support_patreon_note }
  ];
</script>

<section class="support-section surface" id="support" aria-labelledby="support-title">
  <div class="support-copy">
    <span class="eyebrow">{m.support_eyebrow()}</span>
    <h2 id="support-title">{m.support_title()}</h2>
    <p>{m.support_body()}</p>
    <a class="support-maker" href="https://readynaz.com" target="_blank" rel="noopener"><Icon name="external" size={16} /> {m.support_maker()}</a>
  </div>
  <div class="support-options">
    <ul>
      {#each options as option (option.id)}
        <li>
          <a class={`support-option ${option.tone}`} href={option.href} target="_blank" rel="noopener noreferrer">
            <span class="support-icon"><Icon name="heart" size={20} /></span>
            <span class="support-text"><strong>{option.title()}</strong><small>{option.note()}</small></span>
            <Icon name="external" size={16} />
          </a>
        </li>
      {/each}
    </ul>
    <p class="support-thanks">{m.support_thanks()}</p>
  </div>
</section>
