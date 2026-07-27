const assert = require("node:assert/strict");
const test = require("node:test");
const { TINY_PNG, createTestService } = require("./helpers");

test("serves health, dynamic initialization, and the default avatar", async (t) => {
  const { base } = await createTestService(t);

  assert.deepEqual(await (await fetch(`${base}/health`)).json(), {
    status: "ok",
    rooms: 0,
  });
  assert.deepEqual(await (await fetch(`${base}/dynamic/init`)).json(), {
    payload: { version: "test-version", floatingNotice: "hello" },
  });

  const defaultAvatar = await fetch(`${base}/avatars/default.webp`);
  assert.equal(defaultAvatar.status, 200);
  assert.equal(defaultAvatar.headers.get("content-type"), "image/webp");
});

test("accepts an avatar upload and serves the normalized WebP", async (t) => {
  const { base } = await createTestService(t);

  const upload = await fetch(`${base}/upload/avatar`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId: "player-a", uploadContent: TINY_PNG }),
  });

  assert.equal(upload.status, 201);
  assert.deepEqual(await upload.json(), {
    status: "success",
    avatarUrl: "player-a.webp",
  });

  const avatar = await fetch(`${base}/avatars/player-a.webp`);
  assert.equal(avatar.status, 200);
  assert.equal(avatar.headers.get("content-type"), "image/webp");
});

test("rejects avatar upload requests that fail the shared schema", async (t) => {
  const { base } = await createTestService(t);

  const upload = await fetch(`${base}/upload/avatar`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: "invalid player ID",
      uploadContent: TINY_PNG,
    }),
  });

  assert.equal(upload.status, 400);
  assert.equal((await upload.json()).status, "error");
});
