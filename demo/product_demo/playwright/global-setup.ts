/**
 * Pre-flight: verify the dev server is responding before tests start.
 */
export default async function globalSetup() {
  const baseURL = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
  console.log(`\n[demo-recording] Pre-flight: GET ${baseURL}`);
  try {
    const res = await fetch(baseURL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok && res.status !== 404 && res.status !== 200) {
      throw new Error(`Got status ${res.status}`);
    }
    console.log(`[demo-recording] Pre-flight: server responding (${res.status}).\n`);
  } catch (err) {
    console.error(`\n✗ Dev server not responding at ${baseURL}.`);
    console.error(`  Start it with:  pnpm --filter web dev`);
    console.error(`  Or override the URL:  DEMO_BASE_URL=http://your-host:port npx playwright test ...`);
    console.error(`  Original error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
