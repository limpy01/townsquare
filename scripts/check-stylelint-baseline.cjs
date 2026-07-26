const { spawnSync } = require("node:child_process");

const MAX_WARNINGS = 628;
const result = spawnSync(
  "npx",
  ["stylelint", "src/**/*.{vue,scss,css}", "--formatter", "json"],
  { encoding: "utf8" },
);

if (result.error) throw result.error;

const output = result.stderr.trim() || result.stdout.trim();
let report;
try {
  report = JSON.parse(output);
} catch {
  throw new Error(`Stylelint 未返回可解析报告：${output}`);
}

const warnings = report.flatMap((file) => file.warnings ?? []);
if (warnings.length > MAX_WARNINGS) {
  throw new Error(
    `Stylelint 告警新增：${warnings.length} 条，基线为 ${MAX_WARNINGS} 条。`,
  );
}

console.log(
  `Stylelint 基线通过：${warnings.length}/${MAX_WARNINGS} 条历史告警，禁止新增。`,
);
