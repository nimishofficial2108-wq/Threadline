export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} · Threadline Command` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · Threadline Command` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});
