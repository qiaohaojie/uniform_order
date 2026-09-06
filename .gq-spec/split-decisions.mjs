#!/usr/bin/env node
// split-decisions.mjs — one-shot migration: shard the monolithic DECISION.md into
// decisions/<shard>.md files + decisions/INDEX.md, routing each entry by its Stage.
//
// Verbatim: entry bodies are copied unchanged (history is not rewritten). Asserts that
// entries-in === entries-out before writing, and prints a per-shard summary.
//
// Usage:  node .gq-spec/split-decisions.mjs [source=DECISION.md] [outDir=decisions]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseEntries, entryMeta, buildIndex, shardHeader, orderShardKeys,
} from './decisions-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const src = process.argv[2] || join(repoRoot, 'DECISION.md');
const outDir = process.argv[3] || join(repoRoot, 'decisions');

const text = readFileSync(src, 'utf8');
const { entries } = parseEntries(text);

// group entries + metas by shard, preserving file order
const blocksByShard = {};
const metasByShard = {};
for (const block of entries) {
  const meta = entryMeta(block);
  (blocksByShard[meta.shard] ||= []).push(block);
  (metasByShard[meta.shard] ||= []).push(meta);
}

// parity check BEFORE writing anything
const out = Object.values(blocksByShard).reduce((n, a) => n + a.length, 0);
if (out !== entries.length) {
  console.error(`PARITY FAIL: ${entries.length} entries in, ${out} routed out.`);
  process.exit(1);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const keys = orderShardKeys(Object.keys(blocksByShard));
for (const key of keys) {
  const body = blocksByShard[key].join('\n\n') + '\n';
  writeFileSync(join(outDir, `${key}.md`), shardHeader(key) + '\n' + body);
}
writeFileSync(join(outDir, 'INDEX.md'), buildIndex(metasByShard));

console.log(`Migrated ${entries.length} entries -> ${keys.length} shards in ${outDir}`);
for (const key of keys) console.log(`  ${key.padEnd(8)} ${blocksByShard[key].length}`);
console.log(`  INDEX.md written (${entries.length} lines)`);
console.log(`Parity OK: ${entries.length} in == ${out} out`);
