// Heuristic technology detection from public signals only (headers, markup, asset URLs).
// A match is evidence, not proof: sites can hide or fake every signal used here.
// kind: 'url' (asset URLs), 'html' (markup), 'header' (name:value), 'meta' (meta name:value)
const SIGNATURES = [
  { name: 'WordPress', category: 'cms', rules: [['url', /\/wp-(?:content|includes)\//i], ['meta', /^generator:\s*wordpress/i], ['header', /^link:.*wp-json/i]] },
  { name: 'Shopify', category: 'cms', rules: [['url', /cdn\.shopify\.com|\.myshopify\.com/i], ['header', /^x-shopid:|^x-shopify-stage:/i]] },
  { name: 'Wix', category: 'cms', rules: [['url', /static\.wixstatic\.com|parastorage\.com/i], ['meta', /^generator:\s*wix/i]] },
  { name: 'Squarespace', category: 'cms', rules: [['url', /static1\.squarespace\.com|sqspcdn\.com/i], ['meta', /^generator:\s*squarespace/i]] },
  { name: 'Webflow', category: 'cms', rules: [['html', /data-wf-(?:page|site)=/i], ['meta', /^generator:\s*webflow/i]] },
  { name: 'Drupal', category: 'cms', rules: [['meta', /^generator:\s*drupal/i], ['header', /^x-generator:\s*drupal/i], ['url', /\/sites\/default\/files\//i]] },
  { name: 'Joomla', category: 'cms', rules: [['meta', /^generator:\s*joomla/i], ['url', /\/media\/jui\//i]] },
  { name: 'Ghost', category: 'cms', rules: [['meta', /^generator:\s*ghost/i]] },
  { name: 'Blogger', category: 'cms', rules: [['meta', /^generator:\s*blogger/i], ['url', /blogger\.com\/static/i]] },
  { name: 'Hugo', category: 'generator', rules: [['meta', /^generator:\s*hugo/i]] },
  { name: 'Jekyll', category: 'generator', rules: [['meta', /^generator:\s*jekyll/i]] },
  { name: 'Astro', category: 'generator', rules: [['meta', /^generator:\s*astro/i], ['url', /\/_astro\//i]] },
  { name: 'Gatsby', category: 'framework', rules: [['meta', /^generator:\s*gatsby/i], ['html', /id="___gatsby"/i]] },
  { name: 'Next.js', category: 'framework', rules: [['url', /\/_next\/static\//i], ['html', /id="__next"|__NEXT_DATA__/i], ['header', /^x-powered-by:\s*next\.js/i]] },
  { name: 'Nuxt', category: 'framework', rules: [['url', /\/_nuxt\//i], ['html', /id="__nuxt"|window\.__NUXT__/i]] },
  { name: 'SvelteKit', category: 'framework', rules: [['url', /\/_app\/immutable\//i], ['html', /data-sveltekit-/i]] },
  { name: 'Remix', category: 'framework', rules: [['html', /window\.__remixContext/i]] },
  { name: 'Angular', category: 'framework', rules: [['html', /\bng-version=/i]] },
  { name: 'React', category: 'library', rules: [['html', /data-reactroot|data-react-helmet/i], ['url', /react(?:-dom)?(?:\.production)?(?:\.min)?\.js|\/react@/i]] },
  { name: 'Vue.js', category: 'library', rules: [['html', /\bdata-v-[0-9a-f]{6,8}\b|data-server-rendered/i], ['url', /vue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js|\/vue@/i]] },
  { name: 'jQuery', category: 'library', rules: [['url', /jquery(?:[-.]\d[\w.]*)?(?:\.min)?\.js|\/jquery@/i]] },
  { name: 'Alpine.js', category: 'library', rules: [['url', /alpinejs|\/alpine(?:\.min)?\.js/i], ['html', /\sx-data=/i]] },
  { name: 'htmx', category: 'library', rules: [['url', /htmx(?:\.min)?\.js/i], ['html', /\shx-(?:get|post|trigger)=/i]] },
  { name: 'Bootstrap', category: 'ui', rules: [['url', /bootstrap(?:\.bundle)?(?:\.min)?\.(?:js|css)|\/bootstrap@/i]] },
  { name: 'Tailwind CSS', category: 'ui', rules: [['url', /tailwind/i]] },
  { name: 'Font Awesome', category: 'ui', rules: [['url', /font-?awesome|fontawesome/i]] },
  { name: 'Cloudflare', category: 'cdn', rules: [['header', /^server:\s*cloudflare/i], ['header', /^cf-ray:/i]] },
  { name: 'Vercel', category: 'hosting', rules: [['header', /^server:\s*vercel/i], ['header', /^x-vercel-id:/i]] },
  { name: 'Netlify', category: 'hosting', rules: [['header', /^server:\s*netlify/i], ['header', /^x-nf-request-id:/i]] },
  { name: 'GitHub Pages', category: 'hosting', rules: [['header', /^server:\s*github\.com/i]] },
  { name: 'Fastly', category: 'cdn', rules: [['header', /^x-served-by:.*cache-/i], ['header', /^via:.*varnish/i]] },
  { name: 'Akamai', category: 'cdn', rules: [['header', /^server:\s*akamai/i], ['header', /^x-akamai-/i]] },
  { name: 'Amazon CloudFront', category: 'cdn', rules: [['header', /^x-amz-cf-id:|^via:.*cloudfront/i]] },
  { name: 'nginx', category: 'server', rules: [['header', /^server:\s*nginx/i]] },
  { name: 'Apache', category: 'server', rules: [['header', /^server:\s*apache/i]] },
  { name: 'PHP', category: 'language', rules: [['header', /^x-powered-by:.*php/i]] },
  { name: 'ASP.NET', category: 'language', rules: [['header', /^x-powered-by:\s*asp\.net|^x-aspnet-version:/i]] },
  { name: 'Express', category: 'framework', rules: [['header', /^x-powered-by:\s*express/i]] }
];

// WordPress plugins/themes are identifiable from their asset paths; Yoast & Rank Math sign their markup.
const WORDPRESS_PLUGIN_NAMES = { 'wordpress-seo': 'Yoast SEO', 'seo-by-rank-math': 'Rank Math SEO', 'all-in-one-seo-pack': 'All in One SEO', 'woocommerce': 'WooCommerce', 'elementor': 'Elementor', 'contact-form-7': 'Contact Form 7', 'wp-rocket': 'WP Rocket', 'jetpack': 'Jetpack', 'litespeed-cache': 'LiteSpeed Cache', 'wpforms-lite': 'WPForms', 'advanced-custom-fields': 'Advanced Custom Fields', 'revslider': 'Slider Revolution', 'wp-super-cache': 'WP Super Cache', 'w3-total-cache': 'W3 Total Cache' };

function pluginMatches(urls, html) {
  const found = new Map();
  for (const url of urls) {
    const plugin = /\/wp-content\/plugins\/([a-z0-9_-]{2,60})\//i.exec(url)?.[1]?.toLowerCase();
    if (plugin && !found.has(plugin)) found.set(plugin, { name: WORDPRESS_PLUGIN_NAMES[plugin] ?? plugin, category: 'wordpress-plugin', evidence: `/wp-content/plugins/${plugin}/` });
    const theme = /\/wp-content\/themes\/([a-z0-9_-]{2,60})\//i.exec(url)?.[1]?.toLowerCase();
    if (theme && !found.has(`theme:${theme}`)) found.set(`theme:${theme}`, { name: theme, category: 'wordpress-theme', evidence: `/wp-content/themes/${theme}/` });
  }
  if (/optimized with the Yoast SEO/i.test(html) && !found.has('wordpress-seo')) found.set('wordpress-seo', { name: 'Yoast SEO', category: 'wordpress-plugin', evidence: 'HTML comment' });
  if (/Rank Math SEO/i.test(html) && !found.has('seo-by-rank-math')) found.set('seo-by-rank-math', { name: 'Rank Math SEO', category: 'wordpress-plugin', evidence: 'HTML comment' });
  return [...found.values()];
}

function evidenceFor(kind, pattern, haystacks) {
  const pool = haystacks[kind] ?? [];
  const hit = pool.find(entry => pattern.test(entry));
  if (hit === undefined) return '';
  return kind === 'html' ? 'markup' : hit.slice(0, 120);
}

/** @param {{headers: Record<string,string>, meta: Record<string,string>, urls: string[], html: string}} signals */
export function detectTechnology({ headers = {}, meta = {}, urls = [], html = '' }) {
  const haystacks = {
    url: urls,
    html: [html],
    header: Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
    meta: Object.entries(meta).map(([name, value]) => `${name}: ${value}`)
  };
  const found = [];
  for (const signature of SIGNATURES) {
    for (const [kind, pattern] of signature.rules) {
      const evidence = evidenceFor(kind, pattern, haystacks);
      if (!evidence) continue;
      found.push({ name: signature.name, category: signature.category, evidence });
      break;
    }
  }
  const wordpress = found.some(item => item.name === 'WordPress');
  if (wordpress) found.push(...pluginMatches(urls, html));
  return found.slice(0, 60);
}
