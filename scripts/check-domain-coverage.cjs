const fs = require("node:fs");
const path = require("node:path");

const reportPath = path.join(process.cwd(), "coverage", "coverage-final.json");
if (!fs.existsSync(reportPath)) {
  throw new Error(
    "缺少 coverage/coverage-final.json；请先运行 npm run test:unit:coverage。",
  );
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const domainMarker = `${path.sep}packages${path.sep}domain${path.sep}src${path.sep}`;
const domainFiles = Object.entries(report).filter(([file]) =>
  file.includes(domainMarker),
);
if (!domainFiles.length) {
  throw new Error("覆盖率报告中没有 @townsquare/domain 源文件。");
}

const metrics = {
  statements: { covered: 0, total: 0 },
  branches: { covered: 0, total: 0 },
  lines: { covered: 0, total: 0 },
};

for (const [, file] of domainFiles) {
  for (const hits of Object.values(file.s)) {
    metrics.statements.total += 1;
    if (hits > 0) metrics.statements.covered += 1;
  }
  for (const hits of Object.values(file.b).flat()) {
    metrics.branches.total += 1;
    if (hits > 0) metrics.branches.covered += 1;
  }

  const lines = new Map();
  for (const [id, location] of Object.entries(file.statementMap)) {
    const line = location.start.line;
    lines.set(line, Boolean(lines.get(line)) || file.s[id] > 0);
  }
  for (const covered of lines.values()) {
    metrics.lines.total += 1;
    if (covered) metrics.lines.covered += 1;
  }
}

const minimum = { statements: 95, branches: 90, lines: 95 };
const failed = Object.entries(minimum).filter(([name, threshold]) => {
  const metric = metrics[name];
  return metric.covered / metric.total < threshold / 100;
});

if (failed.length) {
  const detail = failed
    .map(([name, threshold]) => {
      const metric = metrics[name];
      return `${name} ${((metric.covered / metric.total) * 100).toFixed(
        2,
      )}% < ${threshold}%`;
    })
    .join(", ");
  throw new Error(`@townsquare/domain 覆盖率门禁失败：${detail}`);
}

console.log(
  `@townsquare/domain 覆盖率通过：${Object.entries(metrics)
    .map(
      ([name, metric]) =>
        `${name} ${((metric.covered / metric.total) * 100).toFixed(2)}%`,
    )
    .join("，")}。`,
);
