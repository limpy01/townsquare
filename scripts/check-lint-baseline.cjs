const { ESLint } = require("eslint");

const MAX_WARNINGS = 1961;

async function checkLintBaseline() {
  const reports = await new ESLint().lintFiles(["."]);
  const totals = reports.reduce(
    (summary, report) => ({
      errors: summary.errors + report.errorCount,
      warnings: summary.warnings + report.warningCount,
    }),
    { errors: 0, warnings: 0 },
  );

  if (totals.errors > 0 || totals.warnings > MAX_WARNINGS) {
    throw new Error(
      `Lint 基线超出：${totals.errors} errors，${totals.warnings} warnings（上限 ${MAX_WARNINGS}）。`,
    );
  }

  process.stdout.write(
    `Lint 基线通过：${totals.errors} errors，${totals.warnings}/${MAX_WARNINGS} warnings。\n`,
  );
}

checkLintBaseline().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
