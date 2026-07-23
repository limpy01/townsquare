const assert = require("node:assert/strict");
const test = require("node:test");
const { createTestService, openClient } = require("./helpers");

test("enforces room membership and host authorization", async (t) => {
  const { wsBase } = await createTestService(t);

  const missing = await openClient(`${wsBase}/ws/99/missing-player`);
  missing.send(["request", { checkAllowJoin: ["missing-player"] }]);
  assert.deepEqual(
    await missing.next((message) => message[0] === "allowJoin"),
    ["allowJoin", false],
  );
  missing.socket.terminate();

  const host = await openClient(`${wsBase}/ws/42/host-a/host?auth=host-secret`);
  host.send(["request", { checkAllowHost: ["host-a"] }]);
  assert.deepEqual(await host.next((message) => message[0] === "allowHost"), [
    "allowHost",
    true,
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
});

test("forwards host broadcasts and player messages to the storyteller", async (t) => {
  const { wsBase } = await createTestService(t);
  const host = await openClient(`${wsBase}/ws/42/host-a/host?auth=host-secret`);
  const player = await openClient(`${wsBase}/ws/42/player-a`);

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
});

test("rejects unknown WebSocket commands before they are broadcast", async (t) => {
  const { wsBase } = await createTestService(t);
  const host = await openClient(`${wsBase}/ws/42/host-a/host?auth=host-secret`);

  host.send(["runArbitraryCode", { payload: "ignored" }]);
  const [code, reason] = await new Promise((resolve) =>
    host.socket.once("close", (closeCode, closeReason) =>
      resolve([closeCode, closeReason.toString()]),
    ),
  );

  assert.equal(code, 1008);
  assert.match(reason, /Unknown WebSocket command/);
});

test("announces room lifecycle to lobby clients and disconnects players after host exit", async (t) => {
  const { wsBase } = await createTestService(t);
  const lobby = await openClient(`${wsBase}/lobby/lobby-a`);
  assert.deepEqual(await lobby.next(), ["setRooms", []]);

  const host = await openClient(`${wsBase}/ws/42/host-a/host?auth=host-secret`);
  assert.deepEqual(await lobby.next((message) => message[0] === "addRoom"), [
    "addRoom",
    "42",
  ]);
  const player = await openClient(`${wsBase}/ws/42/player-a`);

  host.socket.close();
  assert.deepEqual(await lobby.next((message) => message[0] === "removeRoom"), [
    "removeRoom",
    "42",
  ]);
  await new Promise((resolve) => player.socket.once("close", resolve));
  lobby.socket.terminate();
});
