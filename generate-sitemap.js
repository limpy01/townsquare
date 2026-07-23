const fs = require("fs/promises");
const path = require("path");
const { SitemapStream, streamToPromise } = require("sitemap");

async function generateSitemap() {
  const hostname = (process.env.SITE_URL || "https://botcgrimoire.top").replace(
    /\/$/,
    "",
  );
  const sitemap = new SitemapStream({ hostname });
  sitemap.write({ url: "/", changefreq: "weekly", priority: 1 });
  sitemap.end();
  await fs.writeFile(
    path.join(__dirname, "dist", "sitemap.xml"),
    await streamToPromise(sitemap),
  );
}

generateSitemap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
