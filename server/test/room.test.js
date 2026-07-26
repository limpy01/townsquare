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

  host.send(["direct", { "player-a": ["gs", { gamestate: [] }] }, 101]);
  assert.deepEqual(await player.next((message) => message[0] === "gs"), [
    "gs",
    { gamestate: [] },
    101,
  ]);
  assert.deepEqual(await host.next((message) => message[0] === "feedback"), [
    "feedback",
    101,
  ]);

  host.send(["direct", { "": ["gs", { gamestate: [{ id: 0 }] }] }]);
  assert.deepEqual(await player.next((message) => message[0] === "gs"), [
    "gs",
    { gamestate: [{ id: 0 }] },
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

test("rejects malformed player talking payloads", async (t) => {
  const { wsBase } = await createTestService(t);
  const host = await openClient(`${wsBase}/ws/42/host-a/host?auth=host-secret`);
  const player = await openClient(`${wsBase}/ws/42/player-a`);

  player.send(["setTalking", { seatNum: "0", isTalking: true }]);
  const [code, reason] = await new Promise((resolve) =>
    player.socket.once("close", (closeCode, closeReason) =>
      resolve([closeCode, closeReason.toString()]),
    ),
  );

  assert.equal(code, 1008);
  assert.match(reason, /Invalid setTalking payload/);
  host.socket.terminate();
});

test("rejects malformed nested WebSocket payloads", async (t) => {
  const { wsBase } = await createTestService(t);

  for (const [message, expectedReason] of [
    [
      ["direct", { "player-a": ["runArbitraryCode", {}] }],
      /Invalid direct payload/,
    ],
    [["request", { arbitraryRequest: [] }], /Invalid request payload/],
    [
      ["uploadFile", { uploadAvatar: ["player-a"] }],
      /Invalid uploadFile payload/,
    ],
    [["isNight", "true"], /Invalid isNight payload/],
    [["setTimer", -1], /Invalid setTimer payload/],
    [["stopTimer", true], /Invalid stopTimer payload/],
    [["vote", [0, true, "host"]], /Invalid vote payload/],
    [["lock", [1]], /Invalid lock payload/],
    [["stId", 42], /Invalid stId payload/],
    [["marked", { val: -1 }], /Invalid marked payload/],
    [["move", [0, "1"]], /Invalid move payload/],
    [["ping", ["player-a", "other"]], /Invalid ping payload/],
    [["pronouns", [0, 1]], /Invalid pronouns payload/],
    [["remove", -1], /Invalid remove payload/],
    [["useOldOrder", { pithag: true }], /Invalid useOldOrder payload/],
    [["nomination", [0]], /Invalid nomination payload/],
    [["player", { index: "0", property: "name", value: "Alice" }], /Invalid player payload/],
    [["firstNight", ["dusk", 1]], /Invalid firstNight payload/],
    [["teamsNames", { townsfolk: 1 }], /Invalid teamsNames payload/],
    [["direct", { "player-a": ["gs", { gamestate: {} }] }], /Invalid direct payload/],
  ]) {
    const client = await openClient(
      `${wsBase}/ws/42/${Math.random().toString(36).slice(2)}`,
    );
    client.send(message);
    const [code, reason] = await new Promise((resolve) =>
      client.socket.once("close", (closeCode, closeReason) =>
        resolve([closeCode, closeReason.toString()]),
      ),
    );

    assert.equal(code, 1008);
    assert.match(reason, expectedReason);
  }
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
