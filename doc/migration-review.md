# Town Square 现代化迁移复盘与后续规划

> 评估日期：2026-07-26
> 对照文档：[`migration-plan.md`](./migration-plan.md)
> 当前任务账本：[`migration-status.md`](./migration-status.md)
> 评估范围：README、工程配置、前后端源码、共享包、测试、CI、构建与部署文档
> 本文仅用于分析和规划，不包含代码修改

## 1. 总体结论

本次迁移的技术方向正确，主要技术栈替换已经完成，并且建立了可运行的自动化质量门。但按照 `migration-plan.md` 的最终退出条件衡量，项目尚不能视为迁移完成。

当前更准确的状态是：

- 技术栈迁移约完成 80%；
- 架构解耦与遗留层清理约完成 50%；
- 测试与交付成熟度约完成 45%–55%。

已经完成的重点是 Vue 3、Vite、Pinia、严格 TypeScript、TypeScript 服务端、共享契约、基础测试和 CI。当前剩余工作的核心不再是继续进行零散的语法或字段类型转换，而是：

1. 为高风险会话和持久化逻辑补齐行为证据；
2. 拆分巨型 transport、persistence 和组件；
3. 删除 legacy command/effect/mutation bridge；
4. 扩大真实业务 E2E、视觉和兼容验证；
5. 完成样式、资源、服务端运维和发布收尾。

## 2. 本次核验结果

本次实际执行了根目录完整质量门：

```bash
npm run check
```

执行结果：

| 检查项                      | 结果                              |
| --------------------------- | --------------------------------- |
| TypeScript / Vue TypeScript | 通过                              |
| Vitest                      | 49 个测试文件、166 个测试通过     |
| 服务端集成测试              | 13 个测试通过                     |
| Chromium E2E                | 4 个流程通过                      |
| 视觉回归                    | 3 个测试、4 张截图通过            |
| ESLint                      | 0 error、0 warning                |
| Stylelint                   | 628 条历史告警，未新增            |
| 格式检查                    | 基线通过，23 个历史文件仍待格式化 |
| TypeScript 抑制             | 未发现 `@ts-nocheck`              |
| 生产构建                    | 通过                              |
| 工作区                      | 干净，无未提交改动                |

本次复盘最初运行于 Node `v25.3.0`、npm `11.9.0`。仓库现固定为该版本；最新一次完整质量门包含类型检查、166 个单元/组件测试、13 个服务端集成、4 个 Chromium E2E、3 个视觉回归和生产构建，全部通过。

当前构建结果：

| 产物     |          当前值 |            预算 | 状态                  |
| -------- | --------------: | --------------: | --------------------- |
| 入口 JS  | 1,798,558 bytes | 1,800,000 bytes | 通过，但仅余约 1.4 KB |
| 入口 CSS |   249,956 bytes |   260,000 bytes | 通过                  |

当前 Vitest 全局覆盖率：

| 指标       | 当前值 | 规划最终目标 |
| ---------- | -----: | -----------: |
| Statements | 39.75% |         ≥85% |
| Branches   | 32.01% |         ≥75% |
| Functions  | 58.89% |   未单独规定 |
| Lines      | 41.48% |         ≥85% |

共享 `contracts` 和 `domain` 已达到高覆盖率门禁；整体覆盖率偏低主要来自会话 transport、持久化、legacy command 和 dispatcher。

## 3. 已完成或基本完成的内容

### 3.1 前端技术栈

- 已使用 Vue 3 和 Vite；
- 已使用 Pinia，Vuex 不再存在于依赖树；
- 所有 Vue SFC 均使用 `<script setup lang="ts">`；
- 已移除 `@vue/compat` 和 `allowJs`；
- Vue 3 兼容的 Font Awesome 和 Vite 静态资源加载已经落地；
- `VITE_API_BASE`、`VITE_WS_BASE` 已成为实际环境变量入口。

### 3.2 TypeScript 基础

- 前端、服务端、contracts 和 domain 均开启 `strict`；
- 同时开启 `exactOptionalPropertyTypes` 和 `noUncheckedIndexedAccess`；
- 自有运行时代码已无 `.js` 业务源文件；
- 自有运行时代码已无 `@ts-nocheck`；
- 服务端生产入口由 TypeScript 编译为 JavaScript artifact。

### 3.3 状态管理

- 业务状态已经拆成多个 Pinia store；
- lobby、players、voting、chat、timer、scenario、profile、session 等状态域均有独立 store；
- 没有创建一个简单复制旧 Vuex 结构的巨型 Pinia store；
- 多数 store 已具备基本单元测试。

### 3.4 共享协议与领域层

- 已建立 `packages/contracts`、`packages/domain` 和 `packages/test-fixtures`；
- WebSocket v1 数组 envelope 保持兼容；
- 角色、剧本、游戏状态、动态初始化、localStorage 和客户端命令已建立共享契约；
- Zod 已用于主要外部输入边界；
- 自定义剧本规范化、角色目录、夜间顺序和投票统计等纯逻辑已进入 domain；
- contracts/domain 已建立高覆盖率门禁。

### 3.5 服务端

- 已迁移至 TypeScript、Express 5 和 `ws`；
- app factory 与 CLI listen 入口已经分离；
- HTTP、头像和 WebSocket 已不再全部集中在入口文件；
- 已实现 origin、ID、消息 schema、payload 大小、速率和待投递消息数量等防御；
- 已覆盖 HTTP、房间、host/player 重连、队列、lobby、未知命令和版本信息测试。

### 3.6 工程质量与兼容性

- 根 `npm run check` 已形成统一质量门；
- CI 会执行类型、测试、构建、覆盖率、E2E 和视觉回归；
- 视觉基线只能通过独立命令显式更新；
- 已建立旧存档、自定义剧本、游戏状态和 WebSocket fixture；
- 已建立 bundle budget 和资源引用报告；
- 许可证元数据、终端版权告知、`--version` 和 UI 法律入口已经补齐；
- README 和服务端部署文档已说明内存房间导致的发布中断风险。

## 4. 尚未完成的重点

### 4.1 会话 transport 仍是最大风险

`src/store/socket.ts` 仍约 2,664 行，同时负责：

- WebSocket 连接和关闭；
- host/join 授权；
- ping/pong；
- 重连和多个 timer；
- outbox 和 feedback；
- 游戏状态同步；
- 玩家、角色和魔典分发；
- 提名、投票、聊天和群聊；
- UI 告警和输入流程。

虽然部分 guard、dispatcher 和 outbox 已经抽离，但计划中的 transport、reconnect policy、协议 handler 和 live-session 分层还没有完成。

该文件当前约有 8% statements、5% branches 和 9% lines 覆盖率。它是系统中风险最高但测试最薄弱的模块，不适合在缺少 characterization tests 的情况下直接大拆。

### 4.2 持久化已拆为可单测的兼容层，仍待移除外层 bridge

原约 664 行的 `src/store/persistence.ts` 已收敛为 19 行浏览器装配适配器；初始化恢复、旧值解析、写回投影和兼容类型分别位于 `persistence-hydrator.ts`、`persistence-codecs.ts`、`persistence-writer.ts` 与 `persistence-types.ts`。生产代码不再在该边界使用 `any` 或直接属性访问 localStorage。

新增独立回归覆盖损坏值拒绝、旧头像迁移失败重试、会话/聊天/群聊/角色状态恢复、投票历史、群聊完整生命周期和角色状态清理。页面标题仍由最外层浏览器适配器提供；MIG-052 已将原 mutation bus 替换为显式游戏事件通道。该边界尚未建立 95% lines、90% branches 的专属覆盖率门禁。

### 4.3 仍存在 legacy 命令体系

Vuex 已经删除，但下列过渡设施仍被大量组件和 transport 使用：

- `legacy-commands.ts`；
- `LegacyRuntimeStore` 投影；
- `commitGameCommand`；
- `emitLegacyMutation`。

`legacy-effects.ts`、`mutation-bus.ts` 与全部 `emitLegacyMutation` 调用已删除。App、投票、玩家、头像及全部相关弹窗现在在 Pinia action 后发布明确的游戏事件，持久化与 session transport 是该事件的消费者。`Menu.vue` 已进一步移除全部 `commitGameCommand`/`gameCommands` 调用：房间生命周期、玩家和群聊清理、计时器、分发、剧本选项与复盘均直接调用 Pinia。仍需迁移 TownSquare 与 runtime store 投影，才能完成整个命令桥收口。

### 4.4 TypeScript 仍有绕过点

严格 TypeScript 配置已经生效，但生产代码仍存在显式 `any`，主要分布在：

- legacy command bridge；
- players store 的部分状态；
- 少数组件输入和群聊成员处理。

因此阶段 4 的“不允许 `any`”退出条件尚未达到。后续应通过删除遗留桥和建立稳定领域类型解决，不建议简单用宽泛接口掩盖这些问题。

### 4.5 组件完成了语法迁移，但未完成职责拆分

当前主要热点：

| 文件                                        | 约行数 |
| ------------------------------------------- | -----: |
| `src/components/Player.vue`                 |  1,491 |
| `src/components/TownSquare.vue`             |  1,489 |
| `src/components/Menu.vue`                   |  1,429 |
| `src/components/Vote.vue`                   |    609 |
| `src/components/modals/NightOrderModal.vue` |    530 |

这些组件仍直接协调网络命令、多个 store、legacy bridge、浏览器能力、弹窗和复杂业务流程。因此阶段 6 应记录为“Composition API/TS 语法迁移完成，组件职责拆分进行中”。

### 4.6 测试风险覆盖不均衡

当前 E2E 主要覆盖：

- 首页；
- 创建房间弹窗；
- 创建说书人房间；
- 法律与署名入口。

尚未覆盖的高价值用户流程包括：

- 第二浏览器作为玩家加入；
- 认领和离开座位；
- 角色分发；
- 提名、普通投票和秘密投票；
- 私聊和群聊；
- 玩家/说书人掉线重连；
- 自定义剧本导入；
- 旧存档恢复；
- 头像上传；
- 玩家视角下的完整流程。

视觉回归目前只运行桌面 Chromium。迁移计划要求的玩家视图、投票、主要弹窗尚未覆盖。MSW 已安装但没有实际测试使用。

### 4.7 服务端尚未达到生产收尾状态

服务端已经完成 TypeScript 化，但 WebSocket service 仍集中管理 room、lobby、pending queue、权限和限流。

仍需补齐的测试和能力包括：

- origin allowlist；
- WebSocket 1 MiB payload 上限；
- 每秒 30 条消息限流；
- pending queue 上限；
- 非法 JSON；
- HTTP 2 MiB body 上限；
- graceful shutdown；
- 维护/drain 行为；
- 结构化日志和指标。

`prom-client` 已在依赖中，但当前还没有形成完整可观察性能力。

### 4.8 样式和资源治理仍处于早期

当前已经建立 tokens、CSS variables、base、app-shell、intro 和 modal 等样式层，但大量样式仍留在巨型组件中。

剩余问题包括：

- 628 条 Stylelint 历史告警；
- 全局和深层选择器尚未完全归档；
- 资源报告只完成识别，尚未完成人工确认和安全删除；
- 非首屏弹窗和大型资源尚未明显 lazy load；
- JS 入口已经贴近 1.8 MB 预算上限。

### 4.9 最终目录、清理和发布演练未完成

当前 npm workspace 只包含 `packages/*`；Web 和 server 没有成为独立 workspace，也没有迁入计划示意的 `apps/web` 和 `apps/server`。

仓库仍保留：

- `vue.config.js`；
- `.eslintrc.js`；
- `public/index.html`；
- JavaScript 格式的服务端测试；
- legacy command/effect/mutation bridge；
- 多套构建产物目录。

目录重排本身不是近期最高优先级。应先决定是否确实需要 `apps/*` 架构；如果决定保留当前根 `src`/`server` 结构，应修改计划，使完成定义与真实目标一致。

canary、旧客户端交叉兼容、生产观察和回滚流程已有文档，但尚无实际演练证据。

## 5. 分阶段状态复核

| 阶段                          | 账本状态 | 本次判断   | 说明                                                                     |
| ----------------------------- | -------- | ---------- | ------------------------------------------------------------------------ |
| 0. 冻结行为基线               | 进行中   | 基本完成   | 工具和基线已建立，但关键用户流程和视觉矩阵不足                           |
| 1. workspace 与共享契约       | 进行中   | 基本完成   | contracts/domain 成熟；Web/server workspace 与部分协议矩阵未完成         |
| 2. 服务端 TypeScript 化       | 进行中   | 部分完成   | TS 与 app factory 完成；模块拆分、边界测试和运维能力不足                 |
| 3. Vue 3 + Vite               | 已完成   | 已完成     | 启动、构建、E2E 与视觉基线均可运行                                       |
| 4. 前端 TypeScript 基础层     | 进行中   | 部分完成   | strict 已开启；socket、persistence、HTTP/browser adapter 和 `any` 未收口 |
| 5. Vuex 至 Pinia              | 已完成   | 基本完成   | Vuex 已删除；legacy 字符串命令和副作用桥仍存在                           |
| 6. Composition API 与组件拆分 | 已完成   | 部分完成   | 所有 SFC 已迁移语法；巨型组件和隐式命令仍未拆分                          |
| 7. 样式与资源治理             | 进行中   | 早期至中期 | 已有样式层、报告和预算；告警、归档、lazy load 和资源优化未完成           |
| 8. 清理、部署与收尾           | 进行中   | 早期       | `check` 已绿；清理、兼容演练、监控、canary 和回滚演练未完成              |

## 6. 迁移账本质量问题

`migration-status.md` 记录了大量迁移细节和测试结果，作为历史日志很有价值，但不适合继续直接作为当前阶段状态的唯一来源。

主要问题：

- 阶段状态偏重“文件是否已改”，弱化了退出条件；
- 测试数量仍记录为 111/11，实际已经是 160/13；
- 阶段 6 被标记完成，但组件拆分目标尚未完成；
- 尾部“下一批”仍指向已经完成的类型收口工作；
- 大量历史批次说明掩盖了当前真正的 blocker；
- 缺少每个阶段退出条件的证据链接和未满足项。

建议把账本拆成两部分：

1. 当前状态：首页只保留阶段、退出条件、证据和下一批；
2. 历史记录：将 MIG-001 至 MIG-047 的详细日志移入归档章节或独立文件。

## 7. 推荐后续执行规划

### 批次 A：校准基线和账本

目标：让后续迁移依据可信、可复现。

任务：

1. 使用仓库固定的 Node 25.3.0 重新执行 `npm ci` 和 `npm run check`；
2. 更新测试数量、覆盖率、构建体积和告警数字；
3. 按阶段退出条件重写迁移账本首页；
4. 为每个未满足项附测试、配置或源码证据；
5. 决定是否采用 `apps/web`、`apps/server`，或正式修订计划；
6. 记录当前生产兼容和回滚基线。

退出条件：

- Node 25.3.0 下完整质量门通过；
- 账本数字与当前仓库一致；
- 阶段状态不再把语法迁移等同于架构完成。

### 批次 B：冻结会话层高风险行为

目标：在拆分 `socket.ts` 前建立足够的行为证据。

优先测试：

- 连接、关闭、重连和 host/join timeout；
- ping/pong 和所有 timer 释放；
- outbox 重试、确认、去重、过期；
- direct、broadcast、feedback 消息顺序；
- 玩家、角色、魔典和游戏状态分发；
- 提名、投票、聊天和群聊；
- host、player、spectator 权限；
- malformed payload 不改变状态；
- 历史 fixture 与新前后端的消息序列一致。

建议阶段门槛：

- `socket.ts` lines 先达到 50%；
- 关键连接状态机 branches 达到 60%–70%；
- fake timers 下没有遗留 timer；
- 不改变 WebSocket v1 envelope 和消息顺序。

### 批次 C：拆分 session transport

建议顺序：

1. WebSocket client 和连接生命周期；
2. reconnect policy 和 timer 管理；
3. encoder/decoder 和统一消息入口；
4. outbox/feedback；
5. room/player handler；
6. chat/vote/timer/game-state handler；
7. 最后删除巨型 `LiveSession` 协调类。

约束：

- 每批只移动一个行为域；
- 先有 characterization test，再移动代码；
- 不同时更改网络格式、存档格式或 UI；
- 每批通过相关单测、服务端集成、E2E 和根检查。

### 批次 D：重构持久化边界

目标：建立真正独立、可验证的 localStorage repository。

任务：

1. 集中定义所有应用 key；
2. 为每个 key 定义读取 schema、默认值和写入投影；
3. 将页面标题等职责移出 persistence；
4. 删除 `LegacyPersistenceStore` 和 `any`；
5. 用 Pinia action 或明确的领域事件替代 mutation switch；
6. 覆盖缺失、损坏、旧版本、部分写入失败和迁移重试；
7. 证明应用只会删除自己的 key。

退出条件：

- 持久化 lines ≥95%、branches ≥90%；
- 所有旧 key fixture 可恢复；
- 迁移失败不覆盖原数据；
- 不再依赖 mutation bus。

### 批次 E：删除 legacy command/effect bridge

任务：

- 组件直接调用对应 Pinia action；
- 网络和持久化副作用通过明确 service/composable 注入；
- 删除字符串形式的 `commitGameCommand` 和 `emitLegacyMutation` 调用；
- 删除 `legacy-commands.ts`、`legacy-effects.ts`、`mutation-bus.ts` 和 runtime store 投影；
- 为每个删除的命令建立直接 action 回归测试。

完成该批次后，阶段 5 才可正式标记为完成。

### 批次 F：拆分高风险组件

推荐顺序：

1. `Menu.vue`：房间、音频、游戏控制、设置、导入导出；
2. `TownSquare.vue`：座位操作、聊天、提名和布局；
3. `Player.vue`：token、状态标记、投票和上下文菜单；
4. `Vote.vue`：计票状态机和显示层；
5. `App.vue`：初始化、快捷键和应用装配。

规则：

- 按行为域拆分，不按行数机械拆分；
- 复杂流程进入 composable/service；
- 每批不同时改 DOM 和 CSS；
- 补齐 props、emits、快捷键和 mount/unmount 测试；
- 视觉截图不得自动更新。

### 批次 G：扩展真实业务测试矩阵

第一组核心 E2E：

1. 说书人创建房间；
2. 第二浏览器加入房间并认领座位；
3. 说书人分配角色；
4. 玩家收到角色；
5. 提名、投票、结束投票；
6. 私聊和群聊；
7. 玩家断线重连；
8. 说书人离开后房间销毁。

第二组边界 E2E：

- 自定义剧本导入；
- 旧存档恢复；
- 头像上传；
- HTTP 失败、延迟和非法响应；
- 浏览器权限拒绝；
- 秘密投票和复盘状态。

浏览器与视觉：

- Chromium 保持完整矩阵；
- Firefox/WebKit 先运行核心 smoke tests；
- 增加玩家视图、投票、角色表、夜间顺序、聊天和设置弹窗截图；

### 批次 H：样式、资源和性能

任务：

1. 按组件逐批减少 Stylelint 告警；
2. 完成 reset/base/global/component/legacy 样式归属；
3. 记录并清理深层 selector；
4. 动态加载非首屏弹窗；
5. 拆分角色数据和大型工具代码；
6. 人工确认资源报告中的未引用文件；
7. 在视觉等价后优化图片；
8. 将入口 JS 降至明显低于 1.8 MB，再收紧预算。

### 批次 I：服务端与发布收尾

任务：

- 拆分 room registry、lobby、pending queue 和 WebSocket router；
- 补齐 origin、payload、限流、非法 JSON 和 graceful shutdown 测试；
- 增加结构化日志和必要指标；
- 明确维护通知或 connection drain 策略；
- 执行旧客户端兼容演练；
- 执行头像目录备份和恢复演练；
- canary 发布并观察错误率、WS 断开率和校验失败；
- 完成回滚演练；
- 删除过期配置、旧入口和构建残留；
- 更新 README、部署文档和迁移账本。

## 8. 建议的覆盖率提升方式

不建议从当前约 37% lines 一次性把全局门槛提高到 85%，否则容易产生低价值测试。建议按风险分阶段提升：

| 阶段                                | 全局 lines | 全局 branches | 特殊模块                              |
| ----------------------------------- | ---------: | ------------: | ------------------------------------- |
| 会话测试补齐后                      |       ≥50% |          ≥40% | socket 关键状态机 branches ≥60%       |
| persistence 与 legacy bridge 收口后 |       ≥65% |          ≥55% | persistence ≥95%/90%                  |
| 组件与 E2E 扩展后                   |       ≥75% |          ≥65% | 关键 store ≥85% lines                 |
| 最终迁移门禁                        |       ≥85% |          ≥75% | contracts/domain/协议/持久化 ≥95%/90% |

所有 bug 修复继续要求先添加稳定回归测试，覆盖率不得通过排除高风险业务文件来提高。

## 9. 当前优先级

建议接下来按以下顺序执行：

1. 会话层 characterization tests；
2. 拆分 session transport；
3. 重构 persistence；
4. 删除 legacy command/effect bridge；
5. 拆分 Menu、TownSquare、Player 和 Vote；
6. 扩展多客户端业务 E2E 与视觉矩阵；
7. 样式、资源和包体治理；
8. 服务端运维、兼容、canary 和回滚收尾。

在前五项完成前，不建议优先进行：

- 全仓目录大搬迁；
- UI 重设计；
- 图片批量格式转换；
- WebSocket v2/object 协议；
- 数据库、账号系统或 Socket.IO；
- 只为减少文件行数的机械拆分。

## 10. 完成判定建议

后续只有同时满足以下条件，才应把迁移标记为完成：

- Node 25.3.0 下 `npm run check` 稳定通过；
- Vue 3、Vite、Pinia 和 strict TypeScript 是唯一实现；
- 自有运行时代码无 `.js`、`any` 和 TypeScript 抑制；
- socket、persistence 和巨型组件完成职责拆分；
- legacy command/effect/mutation bridge 已删除；
- HTTP、WS、剧本和存档输入均有运行时 schema；
- 旧存档、自定义剧本和 WS v1 兼容矩阵通过；
- 关键用户流程具有多客户端 E2E；
- 关键视口和重要状态具有稳定视觉基线；
- 覆盖率达到规划门槛；
- Stylelint 历史债务完成清理或有明确、有限的例外；
- 首屏包体显著低于预算，而不是贴线通过；
- 许可证、来源和作者署名完整保留；
- canary、监控、备份和回滚已经实际演练；
- README、部署文档和迁移账本反映真实架构。

## 11. 最终评价

当前迁移不是“做得不够”，而是已经从技术栈替换阶段进入更难的收口阶段。项目已经具备继续安全迁移的重要基础：共享契约、严格编译、测试框架、CI、视觉基线和兼容 fixture 都已存在。

下一阶段最重要的判断是，不再把零散类型收口等同于整体迁移进度。应集中处理会话 transport、持久化和 legacy bridge，并用真实多客户端流程证明这些改动没有破坏房间、消息、投票和存档兼容性。完成这些核心工作后，再进行样式、资源、目录和发布层面的最终清理，迁移才会从“新技术栈能够运行”真正进入“新架构可长期维护和安全发布”的状态。
