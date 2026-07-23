import cors from "cors";
import express, { type Express } from "express";

export interface HttpAppOptions {
  allowedOrigins: readonly string[];
  floatingNotice: string;
  getRoomCount: () => number;
  version: string;
}

export function createHttpApp({
  allowedOrigins,
  floatingNotice,
  getRoomCount,
  version,
}: HttpAppOptions): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(
          null,
          !origin || !allowedOrigins.length || allowedOrigins.includes(origin),
        ),
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.get("/health", (_req, res) =>
    res.json({ status: "ok", rooms: getRoomCount() }),
  );
  app.get("/dynamic/init", (_req, res) =>
    res.json({ payload: { version, floatingNotice } }),
  );
  return app;
}
