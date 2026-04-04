// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  site: "https://no-tone.com",
  security: {
    allowedDomains: [
      {
        hostname: "no-tone.com",
        protocol: "https",
      },
      {
        hostname: "**.no-tone.com",
        protocol: "https",
      },
    ],
  },
  output: "server",
  integrations: [sitemap()],
  adapter: cloudflare({
    imageService: "compile",
  }),
});
