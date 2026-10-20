// robots.txt and llms.txt interpretation. Pure functions over bounded text.
export const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'];

export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let collectingAgents = false;
  for (const rawLine of text.split(/\r?\n/).slice(0, 2000)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim().slice(0, 300);
    if (field === 'sitemap') { if (sitemaps.length < 10 && value) sitemaps.push(value); continue; }
    if (field === 'user-agent') {
      if (!collectingAgents) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      collectingAgents = true;
      continue;
    }
    collectingAgents = false;
    if (current && (field === 'allow' || field === 'disallow')) current.rules.push({ allow: field === 'allow', path: value });
  }
  return { groups, sitemaps };
}

function groupFor(groups, agent) {
  const name = agent.toLowerCase();
  const specific = groups.filter(group => group.agents.includes(name));
  if (specific.length) return specific.flatMap(group => group.rules);
  return groups.filter(group => group.agents.includes('*')).flatMap(group => group.rules);
}

function ruleMatches(rulePath, path) {
  if (!rulePath || (rulePath.match(/\*/g) ?? []).length > 5) return false;
  const anchored = rulePath.endsWith('$');
  const body = (anchored ? rulePath.slice(0, -1) : rulePath).split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
}

/** Google's rule: the longest matching path wins; allow wins a tie. Empty rules match nothing. */
export function isPathAllowed(rules, path) {
  let verdict = { allow: true, length: -1 };
  for (const rule of rules) {
    if (!ruleMatches(rule.path, path)) continue;
    const length = rule.path.length;
    if (length > verdict.length || (length === verdict.length && rule.allow)) verdict = { allow: rule.allow, length };
  }
  return verdict.allow;
}

function crawlerStatus(rules) {
  if (!isPathAllowed(rules, '/')) return 'blocked';
  const restricted = rules.some(rule => !rule.allow && rule.path && rule.path !== '/');
  return restricted ? 'partial' : 'allowed';
}

export function analyzeRobots({ status, text, path }) {
  if (status === 404 || status === 410) return { present: false, status, crawlers: {}, sitemaps: [], pageAllowedForGooglebot: true };
  if (status < 200 || status >= 300) return { present: false, status, error: true, crawlers: {}, sitemaps: [], pageAllowedForGooglebot: true };
  const { groups, sitemaps } = parseRobots(text);
  const crawlers = Object.fromEntries(AI_CRAWLERS.map(name => [name, crawlerStatus(groupFor(groups, name))]));
  const blocksEveryone = !isPathAllowed(groupFor(groups, '*'), '/');
  return { present: true, status, groups: groups.length, crawlers, sitemaps, blocksEveryone, pageAllowedForGooglebot: isPathAllowed(groupFor(groups, 'googlebot'), path) };
}

export function analyzeLlmsTxt({ status, contentType, text }) {
  if (status !== 200 || /html/i.test(contentType) || !text.trim()) return { present: false };
  const lines = text.split(/\r?\n/);
  const title = lines.find(line => /^#\s+\S/.test(line));
  return {
    present: true,
    bytes: text.length,
    title: title ? title.replace(/^#\s+/, '').trim().slice(0, 120) : '',
    sections: lines.filter(line => /^##\s+\S/.test(line)).length,
    links: (text.match(/\[[^\]]+\]\(https?:\/\/[^)\s]+\)/g) ?? []).length
  };
}
