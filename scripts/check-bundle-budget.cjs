const { readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");

const ASSET_DIRECTORY = "dist/assets";
const BUDGETS = {
  js: 2_000_000,
  css: 260_000,
};

function findEntrypoint(extension) {
  const matches = readdirSync(ASSET_DIRECTORY).filter((file) =>
    new RegExp(`^index-.+\\.${extension}$`).test(file),
  );
  if (matches.length !== 1) {
    throw new Error(
      `无法确定唯一的入口 ${extension.toUpperCase()} 资源：${matches.join(
        ", ",
      )}`,
    );
  }
  return join(ASSET_DIRECTORY, matches[0]);
}

function checkBudget(extension, limit) {
  const file = findEntrypoint(extension);
  const size = statSync(file).size;
  if (size > limit) {
    throw new Error(
      `入口 ${extension.toUpperCase()} 超出预算：${size} bytes（上限 ${limit} bytes）`,
    );
  }
  return size;
}

const jsSize = checkBudget("js", BUDGETS.js);
const cssSize = checkBudget("css", BUDGETS.css);
process.stdout.write(
  `构建预算通过：入口 JS ${jsSize} bytes / ${BUDGETS.js}，CSS ${cssSize} bytes / ${BUDGETS.css}。\n`,
);
