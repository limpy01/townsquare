const { readFileSync, readdirSync, statSync } = require("node:fs");
const { dirname, extname, relative, resolve, sep } = require("node:path");

const SOURCE_DIRECTORY = resolve("src");
const ASSET_DIRECTORY = resolve("src/assets");
const SOURCE_EXTENSIONS = new Set([".css", ".scss", ".ts", ".vue"]);

function walk(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sources = walk(SOURCE_DIRECTORY).filter((path) =>
  SOURCE_EXTENSIONS.has(extname(path)),
);
const assets = walk(ASSET_DIRECTORY).filter(
  (path) => !SOURCE_EXTENSIONS.has(extname(path)),
);
const directReferences = new Set();
const globDirectories = new Set();

function addReference(source, value) {
  const cleanValue = value.replace(/[?#].*$/, "");
  const path = resolve(dirname(source), cleanValue);
  if (!path.startsWith(`${ASSET_DIRECTORY}${sep}`)) return;
  if (cleanValue.includes("*")) {
    globDirectories.add(resolve(path.slice(0, path.indexOf("*"))));
  } else {
    directReferences.add(path);
  }
}

for (const source of sources) {
  const content = readFileSync(source, "utf8");
  const assetPaths = content.matchAll(/["'`]([^"'`\s)]*assets\/[^"'`\s)]+)/g);
  for (const match of assetPaths) addReference(source, match[1]);

  const localGlobs = content.matchAll(
    /import\.meta\.glob\(\s*["'`]([^"'`]+)["'`]/g,
  );
  for (const match of localGlobs) addReference(source, match[1]);
}

const referenced = assets.filter(
  (asset) =>
    directReferences.has(asset) ||
    [...globDirectories].some((directory) =>
      asset.startsWith(`${directory}${sep}`),
    ),
);
const unreferenced = assets
  .filter((asset) => !referenced.includes(asset))
  .map((asset) => relative(process.cwd(), asset));

process.stdout.write(
  `${JSON.stringify(
    {
      totalAssets: assets.length,
      directReferences: directReferences.size,
      globDirectories: [...globDirectories]
        .map((directory) => relative(process.cwd(), directory))
        .sort(),
      unreferencedAssets: unreferenced.sort(),
    },
    null,
    2,
  )}\n`,
);
