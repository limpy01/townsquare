const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const allowed = new Map([
  [
    "src/store/socket.ts",
    "MIG-011: Legacy runtime payload narrowing and transport method signatures remain untyped.",
  ],
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return /\.(ts|vue)$/.test(entry.name) ? [target] : [];
  });
}

const sourceRoots = ["src", "server/src", "packages"];
const suppressions = sourceRoots
  .flatMap((directory) => walk(path.join(root, directory)))
  .filter((file) => fs.readFileSync(file, "utf8").includes("@ts-nocheck"));

const unexpected = suppressions.filter((file) => {
  const relative = path.relative(root, file);
  const expectedNote = allowed.get(relative);
  return !expectedNote || !fs.readFileSync(file, "utf8").includes(expectedNote);
});

if (unexpected.length) {
  throw new Error(
    `发现未登记的 @ts-nocheck：${unexpected
      .map((file) => path.relative(root, file))
      .join(", ")}`,
  );
}

if (suppressions.length !== allowed.size) {
  throw new Error(
    `@ts-nocheck 登记不一致：期望 ${allowed.size} 个，实际 ${suppressions.length} 个。`,
  );
}

console.log(
  "TypeScript 抑制检查通过：仅保留已登记的 MIG-011 transport 迁移例外。",
);
