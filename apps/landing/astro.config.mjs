// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// Static marketing site for uniformorder.online (Hostinger static hosting).
// The shop app lives on shop.uniformorder.online (Hostinger Node.js) — see CLAUDE.md.
export default defineConfig({
  site: "https://uniformorder.online",
  output: "static",
  integrations: [react()],
});
