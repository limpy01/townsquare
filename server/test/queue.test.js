const assert = require("node:assert/strict");
const test = require("node:test");
const { createTestService, delay, openClient } = require("./helpers");

test("delivers pending direct messages once and honors deletion feedback", async (t) => {
  const { wsBase } = await createTestService(t);
  const host = await openClient(`${wsBase}/ws/42/host-a/host?auth=host-secret`);

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
});
