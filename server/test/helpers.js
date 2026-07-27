const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const WebSocket = require("ws");
const { createTownSquareServer } = require("../dist/app");

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL1LwAAAABJRU5ErkJggg==";

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function createTestService(t) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "townsquare-test-"));
  const service = createTownSquareServer({
    dataDir,
    version: "test-version",
    floatingNotice: "hello",
  });
  const address = await service.listen(0, "127.0.0.1");
  t.after(async () => {
    await service.close();
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  return {
    base: `http://127.0.0.1:${address.port}`,
    service,
    wsBase: `ws://127.0.0.1:${address.port}`,
  };
}

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

module.exports = { TINY_PNG, createTestService, delay, openClient };
