import rss from "@astrojs/rss";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

export async function GET(context) {
  const now = new Date();
  const pages = [
    {
      title: "projects",
      description: "Projects page",
      link: "/projects/",
      pubDate: now,
    },
    {
      title: "tldr",
      description: "TLDR page",
      link: "/tldr/",
      pubDate: now,
    },
    {
      title: "usr",
      description: "Usr page",
      link: "/usr/",
      pubDate: now,
    },
  ];
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: pages,
  });
}
