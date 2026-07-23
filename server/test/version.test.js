const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

test("version command retains the required copyright and license notice", async () => {
  const entry = path.join(__dirname, "..", "dist", "index.js");
  const { stdout } = await execFileAsync(process.execPath, [entry, "--version"]);

  assert.match(stdout, /Town Square/);
  assert.match(stdout, /Copyright \(C\) 2026 @limpy01 <admin@botcgrimoire\.top>/);
  assert.match(stdout, /GPL-3\.0-or-later/);
});
