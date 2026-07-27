# Town Square backend

This service is the runtime counterpart for the Vue client. It provides WebSocket rooms at `/ws/:roomId/:playerId`, storyteller connections at `/ws/:roomId/:playerId/host?auth=:secret`, and a lobby WebSocket at `/lobby/:playerId`. It also provides `GET /dynamic/init`, `GET /health`, avatar upload, and avatar serving.

## Run locally

```bash
npm ci
npm run server
VITE_WS_BASE=ws://localhost:8081 VITE_API_BASE=http://localhost:8081 npm run serve
```

The backend listens on port `8081` by default. `PORT`, `HOST`, `DATA_DIR`, `APP_VERSION`, `FLOATING_NOTICE`, and `ALLOWED_ORIGINS` are optional environment variables. `ALLOWED_ORIGINS` is a comma-separated exact allowlist; leave it unset for local development.

## Production

Build the frontend with the addresses of this backend:

```bash
VITE_WS_BASE=wss://ws.example.com VITE_API_BASE=https://api.example.com npm run build
```

Run the service behind a TLS reverse proxy, or set both `TLS_CERT_PATH` and `TLS_KEY_PATH`. Avatar files are written under `DATA_DIR/avatars` (default: `server/data/avatars`), so mount that path as persistent storage. Rooms and queued direct messages are deliberately in memory: the storyteller browser remains the authoritative holder of game state, matching the client protocol.

## 发布、维护与回滚

1. 在发布候选环境运行 `npm run check`，并使用与生产一致的 `VITE_API_BASE`、`VITE_WS_BASE` 构建前端。
2. 先发布静态前端；确认 `GET /health` 和创建/加入房间流程正常后，再安排后端维护窗口。
3. 后端重启会关闭内存中的房间和待发直连消息，不能视为无损滚动更新。请选择低峰期，提前通知正在进行游戏的用户，并确认 `DATA_DIR/avatars` 已持久化和备份。
4. 发布后观察健康检查、WebSocket 断开、消息校验失败和头像上传失败；出现兼容问题时，先恢复上一版前端和服务端构建。不要删除用户的浏览器 localStorage，版本化迁移会在下一次成功启动时继续执行。

生产环境至少应保留上一版前端产物、上一版服务端构建和 `DATA_DIR/avatars` 备份，作为可执行回滚点。
