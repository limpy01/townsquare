const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const WebSocket = require("ws");
const { createTownSquareServer } = require("../index");

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL1LwAAAABJRU5ErkJggg==";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function openClient(url) {
  const socket = new WebSocket(url);
  const messages = [];
  const waiters = [];
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    const index = waiters.findIndex((waiter) => waiter.predicate(message));
    if (index >= 0) waiters.splice(index, 1)[0].resolve(message);
    else messages.push(message);
  });
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return {
    socket,
    next(predicate = () => true, timeout = 1000) {
      const index = messages.findIndex(predicate);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve: null };
        const timer = setTimeout(() => {
          const waiterIndex = waiters.indexOf(waiter);
          if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
          reject(new Error("Timed out waiting for WebSocket message"));
        }, timeout);
        waiter.resolve = (value) => {
          clearTimeout(timer);
          resolve(value);
        };
        waiters.push(waiter);
      });
    },
    send(message) {
      socket.send(JSON.stringify(message));
    },
  };
}

test("serves HTTP APIs and enforces the room, lobby, direct-message protocol", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "townsquare-test-"));
  const service = createTownSquareServer({
    dataDir,
    version: "test-version",
    floatingNotice: "hello",
  });
  const address = await service.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  const wsBase = `ws://127.0.0.1:${address.port}`;
  t.after(async () => {
    await service.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

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

  const missing = await openClient(`${wsBase}/ws/99/missing-player`);
  missing.send(["request", { checkAllowJoin: ["missing-player"] }]);
  assert.deepEqual(
    await missing.next((message) => message[0] === "allowJoin"),
    ["allowJoin", false],
  );
  missing.socket.terminate();

  const lobby = await openClient(`${wsBase}/lobby/lobby-a`);
  assert.deepEqual(await lobby.next(), ["setRooms", []]);

  const host = await openClient(`${wsBase}/ws/42/host-a/host?auth=host-secret`);
  host.send(["request", { checkAllowHost: ["host-a"] }]);
  assert.deepEqual(await host.next((message) => message[0] === "allowHost"), [
    "allowHost",
    true,
  ]);
  assert.deepEqual(await lobby.next((message) => message[0] === "addRoom"), [
    "addRoom",
    "42",
  ]);

  const duplicateHost = await openClient(
    `${wsBase}/ws/42/host-b/host?auth=wrong-secret`,
  );
  duplicateHost.send(["request", { checkAllowHost: ["host-b"] }]);
  assert.deepEqual(
    await duplicateHost.next((message) => message[0] === "allowHost"),
    ["allowHost", false],
  );
  duplicateHost.socket.terminate();

  const player = await openClient(`${wsBase}/ws/42/player-a`);
  player.send(["request", { checkAllowJoin: ["player-a"] }]);
  assert.deepEqual(await player.next((message) => message[0] === "allowJoin"), [
    "allowJoin",
    true,
  ]);

  host.send(["direct", { "player-a": ["gs", { players: 1 }] }, 101]);
  assert.deepEqual(await player.next((message) => message[0] === "gs"), [
    "gs",
    { players: 1 },
    101,
  ]);
  assert.deepEqual(await host.next((message) => message[0] === "feedback"), [
    "feedback",
    101,
  ]);

  host.send(["direct", { "": ["gs", { players: [{ id: 0 }] }] }]);
  assert.deepEqual(await player.next((message) => message[0] === "gs"), [
    "gs",
    { players: [{ id: 0 }] },
    false,
  ]);

  player.send(["direct", { host: ["claim", [0, "player-a", "Player"]] }]);
  assert.deepEqual(await host.next((message) => message[0] === "claim"), [
    "claim",
    [0, "player-a", "Player"],
    false,
  ]);

  host.send(["direct", { later: ["chat", { message: "queued" }] }, 202]);
  assert.deepEqual(await host.next((message) => message[0] === "feedback"), [
    "feedback",
    202,
  ]);
  const later = await openClient(`${wsBase}/ws/42/later`);
  assert.deepEqual(await later.next((message) => message[0] === "chat"), [
    "chat",
    { message: "queued" },
    202,
  ]);
  later.send(["request", { deleteMessage: ["later", ["direct", 202]] }]);
  await delay(20);
  later.socket.terminate();

  const returned = await openClient(`${wsBase}/ws/42/later`);
  await assert.rejects(
    returned.next((message) => message[0] === "chat", 100),
    /Timed out/,
  );
  returned.socket.terminate();

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

  host.socket.close();
  assert.deepEqual(await lobby.next((message) => message[0] === "removeRoom"), [
    "removeRoom",
    "42",
  ]);
  await new Promise((resolve) => player.socket.once("close", resolve));
  lobby.socket.terminate();
});
