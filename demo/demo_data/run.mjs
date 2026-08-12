/**
 * Runner for demo seed/cleanup scripts.
 * Gives a clear error when .env.demo is missing (Node's --env-file is opaque).
 *
 * Usage (from apps/web via package.json):
 *   node ../../demo/demo_data/run.mjs seed [--dry-run] [--reset] ...
 *   node ../../demo/demo_data/run.mjs cleanup [--confirm] ...
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = resolve(__dirname, ".env.demo");
const exampleFile = resolve(__dirname, ".env.demo.example");

const command = process.argv[2];
// pnpm sometimes forwards a bare "--" before user flags; strip it so parseArgs stays happy.
const extraArgs = process.argv.slice(3).filter((a) => a !== "--");

if (command !== "seed" && command !== "cleanup") {
  console.error("Usage: node run.mjs <seed|cleanup> [flags...]");
  process.exit(1);
}

if (!existsSync(envFile)) {
  console.error("\n✗ Missing demo/demo_data/.env.demo");
  console.error("  Copy the example and set DATABASE_URL to your Neon/dev database:\n");
  console.error("    cp demo/demo_data/.env.demo.example demo/demo_data/.env.demo");
  console.error("    # edit demo/demo_data/.env.demo — usually the same DATABASE_URL as apps/web/.env.local\n");
  if (existsSync(exampleFile)) {
    console.error(`  Example file: ${exampleFile}\n`);
  }
  process.exit(1);
}

const script =
  command === "cleanup"
    ? resolve(__dirname, "cleanup-demo.ts")
    : resolve(__dirname, "seed-demo.ts");

const result = spawnSync(
  "tsx",
  [`--env-file=${envFile}`, script, ...extraArgs],
  { stdio: "inherit", shell: process.platform === "win32" },
);

process.exit(result.status ?? 1);
