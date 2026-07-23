import crypto from "node:crypto";
import type http from "node:http";
import type { Socket } from "node:net";

import WebSocket, { WebSocketServer, type RawData } from "ws";

import {
  decodeLegacyEnvelope,
  isLegacyClientPayload,
  isLegacyClientCommand,
  legacyDirectPayloadSchema,
  legacyRequestPayloadSchema,
  legacySetTalkingPayloadSchema,
  legacyUploadFilePayloadSchema,
  playerIdSchema,
  roomIdSchema,
  type LegacyFeedback,
} from "@townsquare/contracts";

import type { AvatarService } from "../http/avatar";
import type { PendingMessage, Room, TownSquareSocket } from "./types";

const MAX_MESSAGE_BYTES = 1024 * 1024;
const MAX_MESSAGES_PER_WINDOW = 30;
const MESSAGE_WINDOW_MS = 1000;
const MAX_PENDING_PER_PLAYER = 100;

type UnknownRecord = Record<string, unknown>;

export interface WebsocketService {
  close(): void;
  handleUpgrade(
    request: http.IncomingMessage,
    networkSocket: Socket,
    head: Buffer,
  ): void;
  rooms: Map<string, Room>;
}

export interface WebsocketServiceOptions {
  allowedOrigins: readonly string[];
  avatarService: AvatarService;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const safeSend = (socket: WebSocket | null | undefined, message: unknown) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  return false;
};

const rawDataLength = (data: RawData): number => {
  if (typeof data === "string") return Buffer.byteLength(data);
  if (Array.isArray(data))
    return data.reduce((total, part) => total + part.length, 0);
  return data.byteLength;
};

const parseJson = (data: RawData): unknown => {
  try {
    const text =
      typeof data === "string"
        ? data
        : Array.isArray(data)
        ? Buffer.concat(data).toString()
        : data instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(data)).toString()
        : Buffer.from(data).toString();
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
};

const validPlayerId = (value: unknown): value is string =>
  playerIdSchema.safeParse(value).success;
const validRoomId = (value: unknown): value is string =>
  roomIdSchema.safeParse(value).success;

export function createWebsocketService({
  allowedOrigins,
  avatarService,
}: WebsocketServiceOptions): WebsocketService {
  const rooms = new Map<string, Room>();
  const lobbyClients = new Set<TownSquareSocket>();
  const pendingMessages = new Map<string, PendingMessage[]>();
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_MESSAGE_BYTES,
  });
  const originAllowed = (origin: string | undefined) =>
    !allowedOrigins.length ||
    (origin !== undefined && allowedOrigins.includes(origin));
  const roomNames = () =>
    [...rooms.values()]
      .filter((room) => room.host && room.host.readyState === WebSocket.OPEN)
      .map((room) => room.id)
      .sort((a, b) => Number(a) - Number(b));
  const pendingKey = (roomId: string, playerId: string) =>
    `${roomId}:${playerId}`;
  const publishRooms = (command: "addRoom" | "removeRoom", roomId: string) => {
    for (const socket of lobbyClients) safeSend(socket, [command, roomId]);
  };
  const sendPending = (socket: TownSquareSocket) => {
    for (const item of pendingMessages.get(
      pendingKey(socket.roomId, socket.playerId),
    ) || [])
      safeSend(socket, item.message);
  };
  const addPending = (
    roomId: string,
    recipientId: string,
    feedback: LegacyFeedback,
    message: unknown,
  ) => {
    if (!feedback || !validPlayerId(recipientId)) return;
    const key = pendingKey(roomId, recipientId);
    const queue = pendingMessages.get(key) || [];
    if (queue.some((item) => item.feedback === feedback)) return;
    queue.push({ feedback, message });
    if (queue.length > MAX_PENDING_PER_PLAYER) queue.shift();
    pendingMessages.set(key, queue);
  };
  const deletePending = (
    roomId: string,
    recipientId: string,
    feedback: LegacyFeedback,
  ) => {
    const key = pendingKey(roomId, recipientId);
    const queue = pendingMessages.get(key);
    if (!queue) return;
    const next = queue.filter(
      (item) => String(item.feedback) !== String(feedback),
    );
    if (next.length) pendingMessages.set(key, next);
    else pendingMessages.delete(key);
  };
  const closeProtocol = (socket: TownSquareSocket, message: string) =>
    socket.close(1008, message);

  const broadcast = (
    room: Room,
    sender: TownSquareSocket,
    message: unknown,
    onlyHost = false,
  ) => {
    const targets = onlyHost ? [room.host] : room.players.values();
    for (const client of targets)
      if (client && client !== sender) safeSend(client, message);
  };

  const handleRequest = (
    socket: TownSquareSocket,
    room: Room,
    params: unknown,
  ) => {
    if (!isRecord(params)) return;
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

  const handleDirect = (
    socket: TownSquareSocket,
    room: Room,
    targets: unknown,
    feedback: LegacyFeedback | undefined,
  ) => {
    if (!isRecord(targets)) return;
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
      } else if (
        recipient !== "host" &&
        validPlayerId(recipient) &&
        feedback !== undefined
      ) {
        addPending(room.id, recipient, feedback, forwarded);
        accepted = true;
      }
    }
    if (accepted && feedback) safeSend(socket, ["feedback", feedback]);
  };

  const handleUpload = async (socket: TownSquareSocket, params: unknown) => {
    if (!isRecord(params)) return;
    const request = params.uploadAvatar;
    if (!Array.isArray(request) || request[0] !== socket.playerId) return;
    try {
      safeSend(socket, [
        "avatarReceived",
        await avatarService.saveAvatar(socket.playerId, request[1]),
      ]);
    } catch (_) {
      safeSend(socket, ["alertPopup", "头像上传失败，请重试。"]);
    }
  };

  const attachRoomSocket = (
    socket: TownSquareSocket,
    roomId: string,
    playerId: string,
    hostToken: string | null,
  ) => {
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

    socket.on("message", (data: RawData) => {
      const now = Date.now();
      if (now - socket.windowStartedAt >= MESSAGE_WINDOW_MS) {
        socket.windowStartedAt = now;
        socket.messageCount = 0;
      }
      if (
        ++socket.messageCount > MAX_MESSAGES_PER_WINDOW ||
        rawDataLength(data) > MAX_MESSAGE_BYTES
      )
        return closeProtocol(socket, "Invalid message rate or size");
      const rawMessage = parseJson(data);
      let message;
      try {
        message = decodeLegacyEnvelope(rawMessage);
      } catch (_) {
        return;
      }
      const { command, params, feedback } = message;
      if (!isLegacyClientCommand(command))
        return closeProtocol(socket, "Unknown WebSocket command");
      if (!isLegacyClientPayload(command, params))
        return closeProtocol(socket, `Invalid ${command} payload`);
      if (
        command === "setTalking" &&
        !legacySetTalkingPayloadSchema.safeParse(params).success
      )
        return closeProtocol(socket, "Invalid setTalking payload");
      if (
        command === "direct" &&
        !legacyDirectPayloadSchema.safeParse(params).success
      )
        return closeProtocol(socket, "Invalid direct payload");
      if (
        command === "request" &&
        !legacyRequestPayloadSchema.safeParse(params).success
      )
        return closeProtocol(socket, "Invalid request payload");
      if (
        command === "uploadFile" &&
        !legacyUploadFilePayloadSchema.safeParse(params).success
      )
        return closeProtocol(socket, "Invalid uploadFile payload");
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

  const attachLobbySocket = (socket: TownSquareSocket, playerId: string) => {
    socket.playerId = playerId;
    lobbyClients.add(socket);
    safeSend(socket, ["setRooms", roomNames()]);
    socket.on("close", () => lobbyClients.delete(socket));
  };

  return {
    rooms,
    handleUpgrade(request, networkSocket, head) {
      const origin = request.headers.origin;
      if (!originAllowed(origin)) {
        networkSocket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        return networkSocket.destroy();
      }
      const url = new URL(request.url ?? "/", "http://localhost");
      const segments = url.pathname.split("/").filter(Boolean);
      const isRoom =
        segments[0] === "ws" &&
        (segments.length === 3 || segments.length === 4);
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
        const townSquareSocket = socket as TownSquareSocket;
        if (isRoom && roomId && playerId)
          attachRoomSocket(townSquareSocket, roomId, playerId, hostToken);
        else if (isLobby && playerId)
          attachLobbySocket(townSquareSocket, playerId);
      });
    },
    close() {
      for (const client of wss.clients) client.terminate();
    },
  };
}
