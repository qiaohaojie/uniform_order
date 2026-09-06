#!/usr/bin/env node
// reindex-decisions.mjs — rebuild decisions/INDEX.md from the shard files.
// Recovery path if the index drifts from the shards. Reads every <shard>.md in the
// decisions dir (except INDEX.md), re-derives one index line per entry, and rewrites INDEX.md.
//
// Usage:  node .gq-spec/reindex-decisions.mjs [dir=decisions]

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEntries, entryMeta, buildIndex } from './decisions-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2] || join(here, '..', 'decisions');

const metasByShard = {};
let total = 0;
for (const name of readdirSync(dir)) {
  if (!name.endsWith('.md') || name === 'INDEX.md') continue;
  const key = name.replace(/\.md$/, '');
  const { entries } = parseEntries(readFileSync(join(dir, name), 'utf8'));
  for (const block of entries) {
    (metasByShard[key] ||= []).push(entryMeta(block));
    total++;
  }
}

writeFileSync(join(dir, 'INDEX.md'), buildIndex(metasByShard));
console.log(`Reindexed ${total} entries across ${Object.keys(metasByShard).length} shards -> ${join(dir, 'INDEX.md')}`);
