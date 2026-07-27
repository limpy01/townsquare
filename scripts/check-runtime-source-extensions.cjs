const { readdirSync } = require("node:fs");
const { join } = require("node:path");

const RUNTIME_SOURCE_ROOTS = [
  "src",
  "server/src",
  "packages/contracts/src",
  "packages/domain/src",
];

function findJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}

const javaScriptFiles = RUNTIME_SOURCE_ROOTS.flatMap(findJavaScriptFiles);

if (javaScriptFiles.length) {
  throw new Error(
    `运行时源码必须使用 TypeScript：${javaScriptFiles.join(", ")}`,
  );
}

process.stdout.write("运行时源码扩展名检查通过。\n");
