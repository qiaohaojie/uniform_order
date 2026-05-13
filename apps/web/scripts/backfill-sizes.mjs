// Backfill script — run with: node scripts/backfill-sizes.mjs
// Populates catalog_variants.sizes from the CATALOG definition in lib/data.ts.
// Safe to re-run (idempotent UPDATE).

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local — try worktree-local first, fall back to main repo location.
function loadEnv() {
  const candidates = [
    resolve(__dirname, "../.env.local"),
    resolve(__dirname, "../../../../../../apps/web/.env.local"), // main repo via worktree path
    resolve(__dirname, "../../../../apps/web/.env.local"),
    resolve(__dirname, "../../../../../apps/web/.env.local"),
  ];
  for (const p of candidates) {
    try {
      const content = readFileSync(p, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (key && !process.env[key]) process.env[key] = val;
      }
      console.log(`Loaded env from: ${p}`);
      return;
    } catch {
      // try next
    }
  }
  console.warn("Warning: .env.local not found — relying on existing process.env");
}

loadEnv();

// ---------------------------------------------------------------------------
// CATALOG tuples — (itemId, label, sizes[])
// Must stay in sync with seed.mjs CATALOG_VARIANTS (seed.mjs is authoritative).
// ---------------------------------------------------------------------------
const SIZES_GENERIC = ["10", "12", "14", "16", "18", "20", "22", "24", "26"];

const CATALOG_TUPLES = [
  // Summer
  { itemId: "shirt-ss",      label: "10–26",               sizes: SIZES_GENERIC },
  { itemId: "cap",           label: "One size",             sizes: [] },
  { itemId: "sock-white",    label: "3–9",                  sizes: ["3-9"] },
  { itemId: "sock-white",    label: "7–11",                 sizes: ["7-11"] },
  { itemId: "shorts-navy",   label: "Boys 10–16",           sizes: ["10", "12", "14", "16"] },
  { itemId: "shorts-navy",   label: "Mens 4–8",             sizes: ["4", "5", "6", "7", "8"] },
  // Winter
  { itemId: "shirt-ls",      label: "10–24",                sizes: ["10", "12", "14", "16", "18", "20", "22", "24"] },
  { itemId: "jumper",        label: "12–16",                sizes: ["12", "14", "16"] },
  { itemId: "jumper",        label: "18–22",                sizes: ["18", "20", "22"] },
  { itemId: "jumper",        label: "24–26",                sizes: ["24", "26"] },
  { itemId: "trousers",      label: "10–18",                sizes: ["10", "12", "14", "16", "18"] },
  { itemId: "trousers",      label: "Mens 5–8",             sizes: ["5", "6", "7", "8"] },
  { itemId: "belt",          label: "70–95cm",              sizes: ["70cm", "75cm", "80cm", "85cm", "90cm", "95cm"] },
  { itemId: "jacket",        label: "12–3XL",               sizes: ["12", "14", "16", "18", "20", "XS", "S", "M", "L", "XL", "2XL", "3XL"] },
  // Ties: variant label is the size selector; no sub-size needed
  { itemId: "tie",           label: "Year 7–10 short (127cm)",  sizes: [] },
  { itemId: "tie",           label: "Year 7–10 long (137cm)",   sizes: [] },
  { itemId: "tie",           label: "Year 11–12 short (137cm)", sizes: [] },
  { itemId: "tie",           label: "Year 11–12 long (147cm)",  sizes: [] },
  { itemId: "sock-grey",     label: "3–9",                  sizes: ["3-9"] },
  { itemId: "sock-grey",     label: "7–11",                 sizes: ["7-11"] },
  { itemId: "scarf",         label: "One size",             sizes: [] },
  { itemId: "prefect-tie",   label: "147cm",                sizes: [] },
  // Sports
  { itemId: "polo",          label: "10–26",                sizes: SIZES_GENERIC },
  { itemId: "shorts-sport",  label: "12–24",                sizes: ["12", "14", "16", "18", "20", "22", "24"] },
  { itemId: "hoodie",        label: "12–XXL",               sizes: ["12", "14", "16", "18", "20", "XS", "S", "M", "L", "XL", "XXL"] },
  { itemId: "tracks",        label: "12–16",                sizes: ["12", "14", "16"] },
  { itemId: "tracks",        label: "18–26",                sizes: ["18", "20", "22", "24", "26"] },
  { itemId: "sock-sport",    label: "2–7 / 7–11 / XL",     sizes: ["2-7", "7-11", "XL"] },
  { itemId: "soccer-jersey", label: "12–22",                sizes: ["12", "14", "16", "18", "20", "22"] },
  { itemId: "swimming-briefs", label: "XS–XXL",             sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  // Formal
  { itemId: "blazer",        label: "88–95cm chest",        sizes: ["88cm", "90cm", "92cm", "95cm"] },
  { itemId: "blazer",        label: "100–115cm chest",      sizes: ["100cm", "105cm", "110cm", "115cm"] },
  // Bags
  { itemId: "backpack",      label: "One size",             sizes: [] },
  { itemId: "sportsbag",     label: "Small",                sizes: [] },
  { itemId: "sportsbag",     label: "Large",                sizes: [] },
  // Stationery
  { itemId: "calc",          label: "N/A",                  sizes: [] },
  { itemId: "mathset",       label: "N/A",                  sizes: [] },
  { itemId: "exercise-book-a4",   label: "N/A",             sizes: [] },
  { itemId: "exercise-book-math", label: "N/A",             sizes: [] },
  { itemId: "ring-binder",   label: "N/A",                  sizes: [] },
];

// Build full set: canonical IDs + rgsh-prefixed IDs (imhs uses bare item IDs).
const ALL_TUPLES = [
  ...CATALOG_TUPLES,
  ...CATALOG_TUPLES.map((t) => ({ ...t, itemId: `rgsh-${t.itemId}` })),
];

import("@neondatabase/serverless").then(async ({ neon }) => {
  const sql = neon(process.env.DATABASE_URL);

  let updated = 0;
  let skipped = 0;

  for (const { itemId, label, sizes } of ALL_TUPLES) {
    const sizesJson = JSON.stringify(sizes);
    const result = await sql`
      UPDATE catalog_variants
      SET    sizes = ${sizesJson}::jsonb
      WHERE  item_id = ${itemId}
        AND  label   = ${label}
        AND  sizes   = '[]'::jsonb
      RETURNING id
    `;
    const count = result.length;
    if (count > 0) {
      updated += count;
    } else {
      skipped++;
    }
  }

  console.log(`\nBackfill complete: ${updated} rows updated, ${skipped} tuples had no match or were already set.`);

  // -------------------------------------------------------------------------
  // Post-check: report any rows still empty
  // -------------------------------------------------------------------------
  const unmatched = await sql`
    SELECT item_id, label FROM catalog_variants WHERE sizes = '[]'::jsonb ORDER BY item_id, label
  `;

  if (unmatched.length === 0) {
    console.log("All rows backfilled — zero unmatched rows.");
  } else {
    console.log(`\nNot backfilled — fix via admin drawer (${unmatched.length} rows):`);
    for (const row of unmatched) {
      console.log(`  item_id=${row.item_id}  label=${row.label}`);
    }
  }
});
