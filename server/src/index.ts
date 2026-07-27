import fs from "node:fs";

import { createTownSquareServer } from "./app";

const PACKAGE = require("../../package.json");

const attribution = `Town Square ${PACKAGE.version}\nCopyright (C) 2026 @limpy01 <admin@botcgrimoire.top>\nContains heavy modifications and original enhancements developed by limpy01.\nLicense: GPL-3.0-or-later with GPLv3 Section 7 attribution requirements.`;

if (require.main === module) {
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

export { createTownSquareServer } from "./app";
