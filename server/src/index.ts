import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import path from "node:path";

import express from "express";

import { parseAvatarUpload } from "@townsquare/contracts";

import { readServerConfig } from "./config";
import { createAvatarService } from "./http/avatar";
import { createHttpApp } from "./http/app";
import { createWebsocketService } from "./websocket/service";

const PACKAGE = require("../../package.json");

interface CreateServerOptions {
  allowedOrigins?: string;
  dataDir?: string;
  floatingNotice?: string;
  server?: http.Server | https.Server;
  tls?: https.ServerOptions;
  version?: string;
}

function createTownSquareServer(options: CreateServerOptions = {}) {
  const config = readServerConfig(process.env, {
    dataDir: path.join(__dirname, ".."),
    version: PACKAGE.version,
  });
  const dataDir = options.dataDir || config.dataDir;
  const avatarDir = path.join(dataDir, "avatars");
  const floatingNotice = options.floatingNotice ?? config.floatingNotice;
  const version = options.version || config.version;
  const allowedOrigins = options.allowedOrigins
    ? options.allowedOrigins
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : config.allowedOrigins;
  fs.mkdirSync(avatarDir, { recursive: true });
  const avatarService = createAvatarService(avatarDir);
  const websocketService = createWebsocketService({
    allowedOrigins,
    avatarService,
  });

  const app = createHttpApp({
    allowedOrigins,
    floatingNotice,
    getRoomCount: () => websocketService.rooms.size,
    version,
  });
  app.get("/avatars/default.webp", async (_req, res, next) => {
    try {
      res.type("webp").send(await avatarService.getDefaultAvatar());
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

  app.post("/upload/avatar", async (req, res) => {
    try {
      const upload = parseAvatarUpload(req.body);
      const avatarUrl = await avatarService.saveAvatar(
        upload.playerId,
        upload.uploadContent,
      );
      res.status(201).json({ status: "success", avatarUrl });
    } catch (error) {
      res.status(400).json({
        status: "error",
        message:
          error instanceof Error ? error.message : "Avatar upload failed.",
      });
    }
  });
  app.use((_req, res) =>
    res.status(404).json({ status: "error", message: "Not found" }),
  );

  const server: http.Server | https.Server =
    options.server ||
    (options.tls
      ? https.createServer(options.tls, app)
      : http.createServer(app));
  server.on("upgrade", websocketService.handleUpgrade);

  return {
    app,
    server,
    rooms: websocketService.rooms,
    listen(
      port = config.port,
      host = config.host,
    ): Promise<AddressInfo | string | null> {
      return new Promise((resolve, reject) =>
        server.listen(port, host, (error?: Error) =>
          error ? reject(error) : resolve(server.address()),
        ),
      );
    },
    close(): Promise<void> {
      websocketService.close();
      return new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

if (require.main === module) {
  const attribution = `Town Square ${PACKAGE.version}\nCopyright (C) 2026 @limpy01 <admin@botcgrimoire.top>\nContains heavy modifications and original enhancements developed by limpy01.\nLicense: GPL-3.0-or-later with GPLv3 Section 7 attribution requirements.`;
  if (process.argv.includes("--version")) {
    console.log(attribution);
    process.exit(0);
  }
  const certPath = process.env.TLS_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH;
  const tls =
    certPath && keyPath
      ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
      : null;
  const service = tls
    ? createTownSquareServer({ tls })
    : createTownSquareServer();
  console.log(attribution);
  service.listen().then((address) => {
    const endpoint =
      typeof address === "string"
        ? address
        : address
        ? `${address.address}:${address.port}`
        : "unknown";
    console.log(
      `Town Square backend listening on ${
        tls ? "https" : "http"
      }://${endpoint}`,
    );
  });
}

export { createTownSquareServer };
