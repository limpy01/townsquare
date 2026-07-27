const { spawnSync } = require("node:child_process");

const KNOWN_UNFORMATTED = new Set([
  ".eslintrc.js",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/feature_request.md",
  ".github/workflows/deploy.yml",
  ".github/workflows/linter.yml",
  "CHANGELOG.md",
  "doc/compatibility-inventory.md",
  "doc/migration-plan.md",
  "index.html",
  "packages/contracts/package.json",
  "packages/contracts/src/index.ts",
  "packages/contracts/test/legacy-envelope.test.ts",
  "packages/domain/package.json",
  "packages/test-fixtures/package.json",
  "PROVENANCE.md",
  "public/index.html",
  "public/static/manifest.json",
  "README.md",
  "server/test/room.test.js",
  "server/test/version.test.js",
  "src/App.vue",
  "src/components/Gradients.vue",
  "src/components/ImageCropper.vue",
  "src/components/Intro.vue",
  "src/components/Menu.vue",
  "src/components/modals/DrawModal.vue",
  "src/components/modals/EditionModal.vue",
  "src/components/modals/FabledModal.vue",
  "src/components/modals/GameStateModal.vue",
  "src/components/modals/GroupChatModal.vue",
  "src/components/modals/InputModal.vue",
  "src/components/modals/Modal.vue",
  "src/components/modals/NightOrderModal.vue",
  "src/components/modals/ReferenceModal.vue",
  "src/components/modals/ReminderModal.vue",
  "src/components/modals/RoleModal.vue",
  "src/components/modals/RolesModal.vue",
  "src/components/modals/VersionModal.vue",
  "src/components/modals/VoteHistoryModal.vue",
  "src/components/Player.vue",
  "src/components/Token.vue",
  "src/components/TownInfo.vue",
  "src/components/TownSquare.vue",
  "src/components/Vote.vue",
  "src/editions.json",
  "src/fabled.json",
  "src/game.json",
  "src/roles.json",
  "src/scripts/a_lleach_of_distrust.json",
  "src/scripts/no_greater_joy.json",
  "src/version.json",
  "vue.config.js",
]);

const result = spawnSync("npx", ["prettier", "--check", "."], {
  encoding: "utf8",
});

if (result.error) throw result.error;
if (result.status === 0) process.exit(0);

const output = `${result.stdout}${result.stderr}`;
const unformatted = [...output.matchAll(/^\[warn\] (.+)$/gm)].map(
  ([, filename]) => filename,
);
const newViolations = unformatted.filter(
  (filename) =>
    !filename.startsWith("Code style issues found") &&
    !KNOWN_UNFORMATTED.has(filename),
);

if (newViolations.length) {
  throw new Error(`发现未格式化的新文件：${newViolations.join(", ")}`);
}

process.stdout.write(
  `格式化基线通过：${unformatted.length} 个历史文件仍待后续迁移批次格式化。\n`,
);
