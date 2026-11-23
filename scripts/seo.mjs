// Writes robots.txt and sitemap.xml into public/ before the build, using the deployed site URL.
import { writeFileSync } from "node:fs";
const raw = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "");
const site = raw.replace(/\/$/, "");
if (!site) {
  console.warn("SITE_URL not set: writing robots.txt without a sitemap reference and skipping sitemap.xml");
  writeFileSync("public/robots.txt", "User-agent: *\nAllow: /\n");
} else {
  writeFileSync("public/robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
  writeFileSync("public/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}/</loc></url>\n</urlset>\n`);
}
