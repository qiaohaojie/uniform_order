// decisions-lib.mjs — shared logic for the sharded decision log.
//
// Used by split-decisions.mjs (one-shot migration) and reindex-decisions.mjs
// (rebuild INDEX.md from shards). The routing rule here is the JS twin of the
// route_stage() function in log-decision.sh — keep the two in sync.

/**
 * Map a Stage string to its shard key ('M06' | 'design' | 'misc').
 * Milestone rule wins first, so 'design:M10-backend' -> 'M10'.
 */
export function routeStage(stage) {
  const s = (stage || '').trim();
  const m = s.match(/M(\d+)/);
  if (m) return 'M' + String(parseInt(m[1], 10)).padStart(2, '0');
  if (s.toLowerCase().startsWith('design')) return 'design';
  return 'misc';
}

/** Human title for a shard file header. */
export function shardTitle(key) {
  if (key === 'design') return 'Design';
  if (key === 'misc') return 'Misc';
  return key; // 'M06'
}

/** Read a single-line `- **Name:** value` field from an entry block. */
export function entryField(block, name) {
  const re = new RegExp('- \\*\\*' + name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + ':\\*\\* ?(.*)');
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

/**
 * Split a decision-log document into { preamble, entries } where each entry is a
 * verbatim block starting with '## ' (trailing whitespace trimmed).
 */
export function parseEntries(text) {
  const parts = text.split(/\n(?=## )/);
  let preamble = '';
  const entries = [];
  for (const p of parts) {
    if (p.startsWith('## ')) entries.push(p.replace(/\s+$/, ''));
    else preamble += p;
  }
  return { preamble, entries };
}

/** Structured view of an entry block for indexing. */
export function entryMeta(block) {
  const summary = block.split('\n', 1)[0].slice(3).trim();
  const id = entryField(block, 'ID');
  const date = (entryField(block, 'Date') || '').slice(0, 10);
  const stage = entryField(block, 'Stage') || 'unspecified';
  return { summary, id, date, stage, shard: routeStage(stage) };
}

/** One INDEX.md line for an entry. */
export function indexLine(meta) {
  const shortId = (meta.id || '').slice(0, 8) || '--------';
  return `- ${meta.date || '----------'} · ${shortId} · ${meta.stage} · ${meta.summary}`;
}

/** Order shard keys: design, then milestones numerically, then misc. */
export function orderShardKeys(keys) {
  const set = new Set(keys);
  const out = [];
  if (set.has('design')) out.push('design');
  const ms = [...set].filter((k) => /^M\d+$/.test(k)).sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
  out.push(...ms);
  if (set.has('misc')) out.push('misc');
  // any unexpected keys last, stable
  for (const k of keys) if (!out.includes(k)) out.push(k);
  return out;
}

export const INDEX_PREAMBLE = `# Decision Index

> Fast lookup for \`decisions/\`. One scannable line per decision; full entries live in the
> shard files linked below. Rebuild this file with \`node .gq-spec/reindex-decisions.mjs\`.
>
> Grouped by milestone (M01, M02, …), plus **Design** (planning) and **Misc** (onboard/cleanup).
`;

/**
 * Build INDEX.md text from metas grouped by shard.
 * @param {Record<string, Array>} byShard  shardKey -> array of entryMeta (in file order)
 */
export function buildIndex(byShard) {
  const keys = orderShardKeys(Object.keys(byShard));
  let out = INDEX_PREAMBLE + '\n';
  for (const key of keys) {
    const metas = byShard[key];
    if (!metas || !metas.length) continue;
    out += `## ${shardTitle(key)}  ([decisions/${key}.md](${key}.md)) — ${metas.length}\n`;
    for (const m of metas) out += indexLine(m) + '\n';
    out += '\n';
  }
  return out.replace(/\n+$/, '\n');
}

/** Header block for a shard file. */
export function shardHeader(key) {
  return `# Decisions — ${shardTitle(key)}\n\n> Auto-routed shard of the decision log (see \`../DECISION.md\`). New entries appended by\n> \`.gq-spec/log-decision.sh\`. Reference a decision by its ID; find any decision via\n> \`decisions/INDEX.md\` or \`grep -r <term> decisions/\`.\n`;
}
