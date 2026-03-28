import type { APIContext } from "astro";

export function GET({ request }: APIContext) {
  return Response.redirect(new URL("/y.png", request.url), 302);
}
