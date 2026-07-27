import path from "node:path";

export interface ServerConfig {
  allowedOrigins: readonly string[];
  dataDir: string;
  floatingNotice: string;
  host: string;
  port: number;
  version: string;
}

export function readServerConfig(
  env: NodeJS.ProcessEnv,
  defaults: { dataDir: string; version: string },
): ServerConfig {
  const parsedPort = Number(env.PORT);
  return {
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    dataDir: env.DATA_DIR ?? path.join(defaults.dataDir, "data"),
    floatingNotice: env.FLOATING_NOTICE ?? "",
    host: env.HOST ?? "0.0.0.0",
    port: Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 8081,
    version: env.APP_VERSION ?? defaults.version,
  };
}
