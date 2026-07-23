const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const express = require("express");
const cors = require("cors");
const sharp = require("sharp");
const WebSocket = require("ws");

const PACKAGE = require("../package.json");
const MAX_MESSAGE_BYTES = 1024 * 1024;
const MAX_MESSAGES_PER_WINDOW = 30;
const MESSAGE_WINDOW_MS = 1000;
const MAX_PENDING_PER_PLAYER = 100;
const PLAYER_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const ROOM_ID = /^(?:[1-9]\d{0,3}|10000)$/;
const DEFAULT_AVATAR_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#34261d"/><circle cx="256" cy="190" r="100" fill="#c5a16d"/><path d="M65 500c25-135 113-205 191-205s166 70 191 205" fill="#c5a16d"/></svg>',
);

const safeSend = (socket, message) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  return false;
};

const parseJson = (data) => {
  try {
    return JSON.parse(data.toString());
  } catch (_) {
    return null;
  }
};

const validPlayerId = (value) =>
  typeof value === "string" && PLAYER_ID.test(value);
const validRoomId = (value) => typeof value === "string" && ROOM_ID.test(value);

function parseAvatar(dataUrl) {
  if (typeof dataUrl !== "string")
    throw new Error("Avatar must be a data URL.");
  const match = dataUrl.match(
    /^data:image\/(?:png|jpeg|jpg|webp);base64,([a-z0-9+/=\s]+)$/i,
  );
  if (!match) throw new Error("Unsupported avatar format.");
  const buffer = Buffer.from(match[1].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_MESSAGE_BYTES)
    throw new Error("Avatar is too large.");
  return buffer;
}

function createTownSquareServer(options = {}) {
  const dataDir =
    options.dataDir || process.env.DATA_DIR || path.join(__dirname, "data");
  const avatarDir = path.join(dataDir, "avatars");
  const floatingNotice =
    options.floatingNotice ?? process.env.FLOATING_NOTICE ?? "";
  const version = options.version || process.env.APP_VERSION || PACKAGE.version;
  const allowedOrigins =
    options.allowedOrigins || process.env.ALLOWED_ORIGINS || "";
  const rooms = new Map();
  const lobbyClients = new Set();
  const pendingMessages = new Map();
  let defaultAvatar;
  fs.mkdirSync(avatarDir, { recursive: true });

  const originAllowed = (origin) => {
    if (!allowedOrigins) return true;
    return allowedOrigins
      .split(",")
      .map((value) => value.trim())
      .includes(origin);
  };

  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || originAllowed(origin)),
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.get("/health", (_req, res) =>
    res.json({ status: "ok", rooms: rooms.size }),
  );
  app.get("/dynamic/init", (_req, res) =>
    res.json({ payload: { version, floatingNotice } }),
  );
  app.get("/avatars/default.webp", async (_req, res, next) => {
    try {
      if (!defaultAvatar) {
        defaultAvatar = await sharp(DEFAULT_AVATAR_SVG)
          .webp({ quality: 85 })
          .toBuffer();
      }
      res.type("webp").send(defaultAvatar);
    } catch (error) {
      next(error);
    }
  });
  app.use(
    "/avatars",
    express.static(avatarDir, {
      fallthrough: false,
      maxAge: "7d",
      immutable: true,
    }),
  );

  async function saveAvatar(playerId, uploadContent) {
    if (!validPlayerId(playerId)) throw new Error("Invalid player ID.");
    const source = parseAvatar(uploadContent);
    const filename = `${playerId}.webp`;
    await sharp(source, { limitInputPixels: 4096 * 4096 })
      .rotate()
      .resize(512, 512, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(path.join(avatarDir, filename));
    return filename;
  }

  app.post("/upload/avatar", async (req, res) => {
    try {
      const avatarUrl = await saveAvatar(
        req.body && req.body.playerId,
        req.body && req.body.uploadContent,
      );
      res.status(201).json({ status: "success", avatarUrl });
    } catch (error) {
      res.status(400).json({ status: "error", message: error.message });
    }
  });
  app.use((_req, res) =>
    res.status(404).json({ status: "error", message: "Not found" }),
  );

  const wss = new WebSocket.Server({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  const roomNames = () =>
    [...rooms.values()]
      .filter((room) => room.host && room.host.readyState === WebSocket.OPEN)
      .map((room) => room.id)
      .sort((a, b) => Number(a) - Number(b));
  const pendingKey = (roomId, playerId) => `${roomId}:${playerId}`;
  const publishRooms = (command, roomId) => {
    for (const socket of lobbyClients) safeSend(socket, [command, roomId]);
  };
  const sendPending = (socket) => {
    for (const item of pendingMessages.get(
      pendingKey(socket.roomId, socket.playerId),
    ) || [])
      safeSend(socket, item.message);
  };
  const addPending = (roomId, recipientId, feedback, message) => {
    if (!feedback || !validPlayerId(recipientId)) return;
    const key = pendingKey(roomId, recipientId);
    const queue = pendingMessages.get(key) || [];
    if (queue.some((item) => item.feedback === feedback)) return;
    queue.push({ feedback, message });
    if (queue.length > MAX_PENDING_PER_PLAYER) queue.shift();
    pendingMessages.set(key, queue);
  };
  const deletePending = (roomId, recipientId, feedback) => {
    const key = pendingKey(roomId, recipientId);
    const queue = pendingMessages.get(key);
    if (!queue) return;
    const next = queue.filter(
      (item) => String(item.feedback) !== String(feedback),
    );
    if (next.length) pendingMessages.set(key, next);
    else pendingMessages.delete(key);
  };
  const closeProtocol = (socket, message) => socket.close(1008, message);

  const broadcast = (room, sender, message, onlyHost) => {
    const targets = onlyHost ? [room.host] : room.players.values();
    for (const client of targets)
      if (client && client !== sender) safeSend(client, message);
  };

  const handleRequest = (socket, room, params) => {
    if (!params || typeof params !== "object") return;
    if (Object.prototype.hasOwnProperty.call(params, "checkAllowHost")) {
      return safeSend(socket, [
        "allowHost",
        Boolean(socket.isHost && !socket.hostDenied),
      ]);
    }
    if (Object.prototype.hasOwnProperty.call(params, "checkAllowJoin")) {
      return safeSend(socket, [
        "allowJoin",
        Boolean(room.host && room.host.readyState === WebSocket.OPEN),
      ]);
    }
    const deletion = params.deleteMessage;
    if (
      Array.isArray(deletion) &&
      deletion.length === 2 &&
      deletion[0] === socket.playerId
    ) {
      const [, payload] = deletion;
      if (Array.isArray(payload) && payload[0] === "direct")
        deletePending(socket.roomId, socket.playerId, payload[1]);
    }
  };

  const handleDirect = (socket, room, targets, feedback) => {
    if (!targets || typeof targets !== "object" || Array.isArray(targets))
      return;
    let accepted = false;
    for (const [recipient, content] of Object.entries(targets)) {
      if (!Array.isArray(content) || typeof content[0] !== "string") continue;
      if (!socket.isHost && recipient !== "host") continue;
      const forwarded = [content[0], content[1], feedback || false];

      // The legacy client sends a room-wide game-state snapshot through the
      // direct-message envelope with an empty recipient. Keep that protocol
      // contract so legacy and migrated clients can share one backend.
      if (socket.isHost && recipient === "") {
        broadcast(room, socket, forwarded);
        accepted = true;
        continue;
      }

      const recipientSocket =
        recipient === "host" ? room.host : room.players.get(recipient);
      if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
        safeSend(recipientSocket, forwarded);
        accepted = true;
      } else if (recipient !== "host" && validPlayerId(recipient) && feedback) {
        addPending(room.id, recipient, feedback, forwarded);
        accepted = true;
      }
    }
    if (accepted && feedback) safeSend(socket, ["feedback", feedback]);
  };

  const handleUpload = async (socket, params) => {
    if (!params || typeof params !== "object") return;
    const request = params.uploadAvatar;
    if (!Array.isArray(request) || request[0] !== socket.playerId) return;
    try {
      safeSend(socket, [
        "avatarReceived",
        await saveAvatar(socket.playerId, request[1]),
      ]);
    } catch (_) {
      safeSend(socket, ["alertPopup", "头像上传失败，请重试。"]);
    }
  };

  const attachRoomSocket = (socket, roomId, playerId, hostToken) => {
    const isHostCandidate = hostToken !== null;
    const room = rooms.get(roomId) || {
      id: roomId,
      host: null,
      hostToken: null,
      players: new Map(),
    };
    const existingHost =
      room.host && room.host.readyState === WebSocket.OPEN ? room.host : null;
    socket.roomId = roomId;
    socket.playerId = playerId;
    socket.isHost = false;
    socket.hostDenied = false;
    socket.messageCount = 0;
    socket.windowStartedAt = Date.now();

    if (isHostCandidate && existingHost) {
      const knownToken = room.hostToken && Buffer.from(room.hostToken);
      const submittedToken = Buffer.from(hostToken);
      const isSameHost =
        knownToken &&
        knownToken.length === submittedToken.length &&
        crypto.timingSafeEqual(knownToken, submittedToken);
      if (!isSameHost) socket.hostDenied = true;
      else {
        existingHost.close(1012, "Storyteller reconnected");
        room.host = socket;
        socket.isHost = true;
      }
    } else if (isHostCandidate) {
      room.host = socket;
      room.hostToken = hostToken;
      socket.isHost = true;
      rooms.set(roomId, room);
      publishRooms("addRoom", roomId);
    }

    const oldPlayer = room.players.get(playerId);
    if (
      oldPlayer &&
      oldPlayer !== socket &&
      oldPlayer.readyState === WebSocket.OPEN
    )
      oldPlayer.close(1012, "Reconnected elsewhere");
    room.players.set(playerId, socket);
    if (socket.isHost) rooms.set(roomId, room);

    socket.on("message", (data) => {
      const now = Date.now();
      if (now - socket.windowStartedAt >= MESSAGE_WINDOW_MS) {
        socket.windowStartedAt = now;
        socket.messageCount = 0;
      }
      if (
        ++socket.messageCount > MAX_MESSAGES_PER_WINDOW ||
        data.length > MAX_MESSAGE_BYTES
      )
        return closeProtocol(socket, "Invalid message rate or size");
      const message = parseJson(data);
      if (!Array.isArray(message) || typeof message[0] !== "string") return;
      const [command, params, feedback] = message;
      // Guests can connect before a host exists so that the client receives an explicit allowJoin=false response.
      const currentRoom = rooms.get(socket.roomId) || room;
      if (command === "request")
        return handleRequest(socket, currentRoom, params);
      if (command === "direct")
        return handleDirect(socket, currentRoom, params, feedback);
      if (command === "uploadFile") return handleUpload(socket, params);
      if (!socket.isHost && !["ping", "setTalking"].includes(command)) return;
      broadcast(currentRoom, socket, message, command === "ping");
    });
    socket.on("close", () => {
      const currentRoom = rooms.get(socket.roomId);
      if (!currentRoom) return;
      if (currentRoom.players.get(socket.playerId) === socket)
        currentRoom.players.delete(socket.playerId);
      if (currentRoom.host === socket) {
        rooms.delete(socket.roomId);
        publishRooms("removeRoom", socket.roomId);
        for (const player of currentRoom.players.values())
          if (player.readyState === WebSocket.OPEN)
            player.close(1012, "Storyteller left the room");
      }
    });
    sendPending(socket);
  };

  const attachLobbySocket = (socket, playerId) => {
    socket.playerId = playerId;
    lobbyClients.add(socket);
    safeSend(socket, ["setRooms", roomNames()]);
    socket.on("close", () => lobbyClients.delete(socket));
  };

  const server =
    options.server ||
    (options.tls
      ? https.createServer(options.tls, app)
      : http.createServer(app));
  server.on("upgrade", (request, networkSocket, head) => {
    const origin = request.headers.origin;
    if (!originAllowed(origin)) {
      networkSocket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      return networkSocket.destroy();
    }
    const url = new URL(request.url, "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);
    const isRoom =
      segments[0] === "ws" && (segments.length === 3 || segments.length === 4);
    const isLobby = segments[0] === "lobby" && segments.length === 2;
    const roomId = isRoom ? segments[1] : null;
    const playerId = isRoom ? segments[2] : segments[1];
    const hostToken =
      isRoom && segments[3] === "host" ? url.searchParams.get("auth") : null;
    const invalidRoom =
      isRoom &&
      (!validRoomId(roomId) ||
        !validPlayerId(playerId) ||
        (segments.length === 4 && (!hostToken || hostToken.length > 256)));
    if (
      (!isRoom && !isLobby) ||
      invalidRoom ||
      (isLobby && !validPlayerId(playerId))
    ) {
      networkSocket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      return networkSocket.destroy();
    }
    wss.handleUpgrade(request, networkSocket, head, (socket) => {
      if (isRoom) attachRoomSocket(socket, roomId, playerId, hostToken);
      else attachLobbySocket(socket, playerId);
    });
  });

  return {
    app,
    server,
    rooms,
    listen(
      port = Number(process.env.PORT) || 8081,
      host = process.env.HOST || "0.0.0.0",
    ) {
      return new Promise((resolve) =>
        server.listen(port, host, () => resolve(server.address())),
      );
    },
    close() {
      for (const client of wss.clients) client.terminate();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

if (require.main === module) {
  const certPath = process.env.TLS_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH;
  const tls =
    certPath && keyPath
      ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
      : null;
  const service = createTownSquareServer({ tls: tls || undefined });
  service
    .listen()
    .then((address) =>
      console.log(
        `Town Square backend listening on ${tls ? "https" : "http"}://${
          address.address
        }:${address.port}`,
      ),
    );
}

module.exports = { createTownSquareServer };
