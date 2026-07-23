# 兼容性清单（MIG-001）

此清单记录迁移前的外部边界。后续契约、fixture 和兼容测试必须以此为基线；未明确记录的行为不能被重构批次擅自删除。

## HTTP

| 方法和路径 | 当前响应/行为 |
| --- | --- |
| `GET /health` | `{ status: "ok", rooms }` |
| `GET /dynamic/init` | `{ payload: { version, floatingNotice } }` |
| `GET /avatars/default.webp` | 动态生成的 WebP 默认头像 |
| `GET /avatars/:filename` | 私有数据目录中的静态头像，缓存 7 天 |
| `POST /upload/avatar` | 输入 `playerId` 与 data URL；成功返回 201 和 `{ status, avatarUrl }` |

服务端还保留 CORS origin allowlist、HTTP JSON body 2 MiB 上限，以及 WebSocket payload 1 MiB 和每秒 30 条的限制。

## WebSocket v1

网络 envelope 固定为 `[command, params?, feedback?]`。不要在迁移中将其替换成 object。

| 连接 | 语义 |
| --- | --- |
| `/ws/:roomId/:playerId` | 玩家连接；房间号为 1–10000，player ID 是 1–64 位字母、数字、`_` 或 `-` |
| `/ws/:roomId/:playerId/host?auth=:token` | 说书人连接/重连；相同 token 接管旧连接 |
| `/lobby/:playerId` | 大厅连接，服务端发送 `setRooms` 并广播房间增删 |

服务端直接处理 `request`、`direct`、`uploadFile`；普通玩家仅可发送 `ping`、`setTalking` 和这些包装命令，其他状态变更仅由 host 广播。重要服务端回包包括 `allowHost`、`allowJoin`、`feedback`、`avatarReceived`、`alertPopup`、`setRooms`、`addRoom`、`removeRoom`。

当前客户端接收的业务 command 至少包括：`gs`、`edition`、`states`、`teamsNames`、`firstNight`、`otherNight`、`fabled`、`player`、`bluff`、`grimoire`、`claim`、`leaveSeat`、`nomination`、`swap`、`move`、`remove`、`vote`、`lock`、`chat`、`addGroupChat`、`removeGroupChat`、`removeGroupChatMember`、`setTimer`、`startTimer`、`stopTimer`、`secretVote`、`bootlegger`、`useOldOrder`、`useOldRole`、`isReview`、`setTalking`、`ping`、`pong` 和 `feedback`。

## localStorage

迁移中的持久化 schema 必须逐项兼容以下现有 key：

- 应用显示：`lastVersion`、`background`、`muted`、`static`、`imageOptIn`、`zoom`、`audioThreshold`、`isGrimoire`；
- 剧本与游戏：`selectedEditions`、`edition`、`roles`、`states`、`teamsNames`、`firstNight`、`otherNight`、`bluffs`、`fabled`、`players`、`customBootlegger`；
- 身份与房间：`playerId`、`stSecret`、`playerName`、`stId`、`claimedSeat`、`session`、`playerAvatar`、旧 key `playerProfileImage`；
- 投票与聊天：`playerVotes`、`votes`、`votesSelected`、`secretVote`、`chatHistory`、`groupChats`；
- 兼容与权限：`useOldOrder`、`useOldRole`、`isReview`、`isRole`。

已知风险：当前实现有两处 `localStorage.clear()`；后续 bug 修复必须先为“仅删除本应用 key”添加回归测试，不能混入纯迁移批次。

## 文件和部署边界

- 当前 Vue CLI 的有效模板是 `public/index.html`；根 `index.html` 曾是未使用的冲突文件。Vite 迁移时将以已清理的根入口替代它。
- 静态资源 URL、房间 hash/link、`DATA_DIR`、`FLOATING_NOTICE`、`APP_VERSION`、`ALLOWED_ORIGINS`、`PORT`、`HOST`、`TLS_CERT_PATH` 与 `TLS_KEY_PATH` 均属于部署兼容面。
- 许可证为 GPLv3-or-later，并包含 GPLv3 第 7 条作者署名与终端/UI 告知附加条款；README、PROVENANCE、终端 banner/`--version` 与 UI Legal/Credits 均为不可删除项。当前未在运行时代码中找到 banner、`--version` 或 Legal/Credits 入口，已作为 `MIG-LAW-001` 记录，迁移时不得把该缺口误判为可删除行为。
