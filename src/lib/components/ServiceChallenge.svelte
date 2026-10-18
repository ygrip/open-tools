<script lang="ts">
  import { onMount } from 'svelte';
  import { loadTurnstile, type TurnstileApi } from '$lib/runtime/turnstile';
  import { runtimeStrings } from '$lib/runtime/strings';
  let { endpoint, version, sha256, locale, onToken }: { endpoint: string; version: string; sha256: string; locale: string; onToken: (token: string) => void } = $props();
  const text = $derived(runtimeStrings(locale));
  let container: HTMLDivElement;
  let failed = $state(false);
  let stale = $state(false);
  let ready = $state(false);
  let api: TurnstileApi | undefined;
  let widget: string | undefined;
  let disposed = false;
  let controller: AbortController;
  async function initialize() {
    onToken('');failed=false;ready=false;stale=false;
    if(widget !== undefined){api?.remove(widget);widget=undefined;}
    controller?.abort();controller=new AbortController();
    const signal=controller.signal;
    const timeout=setTimeout(()=>controller.abort(),15_000);
    try {
      const response=await fetch(`${endpoint}/config?version=${encodeURIComponent(version)}&sha256=${sha256}`, {signal,credentials:'omit',redirect:'error',cache:'no-store'});
      if(response.status === 409) stale=true;
      if(!response.ok) throw new Error('verification');
      const config=await response.json();
      if(config.turnstile !== true || typeof config.sitekey !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(config.sitekey) || typeof config.action !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(config.action)) throw new Error('verification');
      api=await loadTurnstile();
      if(disposed || signal.aborted) return;
      if(widget !== undefined) api.remove(widget);
      widget=api.render(container, {sitekey:config.sitekey,action:config.action,language:locale === 'id' ? 'id' : 'en',theme:document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',size:container.clientWidth<300?'compact':'normal',
        callback:(token:string)=>{if(!disposed && !signal.aborted){ready=true;failed=false;onToken(token);}},
        'expired-callback':()=>{if(!disposed){ready=false;onToken('');}},
        'error-callback':()=>{if(!disposed){ready=false;failed=true;onToken('');}},
        'timeout-callback':()=>{if(!disposed){ready=false;failed=true;onToken('');}}
      });
    } catch { if(!disposed) failed=true; }
    finally {clearTimeout(timeout);}
  }
  onMount(()=>{void initialize();return ()=>{disposed=true;controller?.abort();onToken('');if(widget !== undefined)api?.remove(widget);};});
</script>
<div class="service-challenge">
  <p role="status">{stale ? text.errors['stale-release'] : failed ? text.verificationFailed : ready ? text.verificationReady : text.verificationHelp}</p>
  <div bind:this={container} class="widget"></div>
  {#if failed && !stale}<button type="button" class="clay-button small" onclick={()=>void initialize()}>{text.verificationRetry}</button>{/if}
</div>
<style>
  .service-challenge { margin-top:16px; min-width:0; }
  .widget { display:flex; justify-content:center; margin-block:12px; min-width:0; }
  p { color:var(--text-secondary); font-size:14px; }
</style>
