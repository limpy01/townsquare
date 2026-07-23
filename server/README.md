# Town Square backend

This service is the runtime counterpart for the Vue client. It provides WebSocket rooms at `/ws/:roomId/:playerId`, storyteller connections at `/ws/:roomId/:playerId/host?auth=:secret`, and a lobby WebSocket at `/lobby/:playerId`. It also provides `GET /dynamic/init`, `GET /health`, avatar upload, and avatar serving.

## Run locally

```bash
npm install
npm run server
VUE_APP_WS_BASE=ws://localhost:8081 VUE_APP_API_BASE=http://localhost:8081 npm run serve
```

The backend listens on port `8081` by default. `PORT`, `HOST`, `DATA_DIR`, `APP_VERSION`, `FLOATING_NOTICE`, and `ALLOWED_ORIGINS` are optional environment variables. `ALLOWED_ORIGINS` is a comma-separated exact allowlist; leave it unset for local development.

## Production

Build the frontend with the addresses of this backend:

```bash
VUE_APP_WS_BASE=wss://ws.example.com VUE_APP_API_BASE=https://api.example.com npm run build
```

Run the service behind a TLS reverse proxy, or set both `TLS_CERT_PATH` and `TLS_KEY_PATH`. Avatar files are written under `DATA_DIR/avatars` (default: `server/data/avatars`), so mount that path as persistent storage. Rooms and queued direct messages are deliberately in memory: the storyteller browser remains the authoritative holder of game state, matching the client protocol.
