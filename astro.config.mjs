// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
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
  session: {
    driver: "memory",
  },
  output: "server",
  integrations: [mdx(), sitemap()],
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: {
      enabled: true,
    },
  }),
});
