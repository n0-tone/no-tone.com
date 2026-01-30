import rss from "@astrojs/rss";
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts";

export async function GET(context) {
  const pages = [
    {
      title: "projects",
      description: "Projects page",
      link: "/projects/",
      pubDate: new Date(),
    },
    {
      title: "tldr",
      description: "TLDR page",
      link: "/tldr/",
      pubDate: new Date(),
    },
    {
      title: "usr",
      description: "Usr page",
      link: "/usr/",
      pubDate: new Date(),
    },
  ];
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: pages,
  });
}
