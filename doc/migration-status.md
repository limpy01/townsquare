# 现代化迁移任务账本

最后更新：2026-07-24（WebSocket command 与首批嵌套载荷边界、transport 计时器释放与组件命令类型化批次完成）
基线提交：`e0f1d34`（工作区另含用户提供的 `doc/migration-plan.md`）

## 迁移目标

在不改变已记录的用户功能、房间 URL、本地存档、自定义剧本和 WebSocket v1 数组协议的前提下，完成以下最终状态：

- Web 端使用 Vue 3、Vite、Pinia、Composition API 与严格 TypeScript；
- 服务端使用模块化 TypeScript、Express 5 与 `ws`，所有 HTTP、WebSocket、存档和剧本输入均经运行时 schema 校验；
- `contracts`、`domain`、测试 fixture 作为独立 workspace 包；
- 覆盖类型、单元、组件、HTTP/WS 集成、E2E 和视觉回归，并由 CI 运行；
- 保持现有视觉、许可证、来源和署名；迁移完成后不再有 Vue CLI、Vuex、`@vue/compat`、`allowJs` 或自有运行时代码 `.js` 文件。

## 阶段与依赖

| 阶段                      | 状态   | 退出条件                                        |
| ------------------------- | ------ | ----------------------------------------------- |
| 0. 冻结行为基线           | 进行中 | Node、构建、协议、存档和测试基线可重复验证      |
| 1. workspace 与共享契约   | 进行中 | v1 decoder/encoder、schema、domain 测试稳定     |
| 2. 服务端 TypeScript 化   | 进行中 | 旧前端与新服务端的 HTTP/WS 集成矩阵通过         |
| 3. Vue 3 + Vite 兼容启动  | 进行中 | Vite 下旧行为与视觉基线一致                     |
| 4. 前端 TypeScript 基础层 | 进行中 | transport、持久化、协议和浏览器适配层严格类型化 |
| 5. Vuex 至 Pinia          | 已完成 | 所有业务 store 独立、可测且存档兼容             |
| 6. 组件 Composition API   | 进行中 | 所有 SFC 为 Vue TS，compat warning 为零         |
| 7. 样式与资源治理         | 进行中 | 全局样式归属明确，视觉与性能预算受控            |
| 8. 清理、部署与收尾       | 进行中 | `npm run check` 全绿，部署与回滚演练完成        |

## 当前任务

| ID      | 状态   | 范围                                       | 验收                                                                                           | 兼容性                          |
| ------- | ------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------- |
| MIG-001 | 已完成 | 行为、HTTP、存档、WS command 清单          | 兼容性清单；服务端测试与构建                                                                   | 只读基线，不改协议              |
| MIG-002 | 已完成 | 服务端大粒度测试拆分                       | 11 个独立 HTTP、room、lobby、queue、协议和版本信息测试                                         | 固定 v1 消息语义                |
| MIG-003 | 进行中 | Playwright E2E 与视觉基线                  | 首页、创建房间流程和 2 张截图通过；CI 执行 E2E                                                 | 固定时间、随机数和视口          |
| MIG-004 | 进行中 | 剧本与游戏状态 characterization fixtures   | WS/自定义剧本 fixture 与 11 个单元测试                                                         | 兼容历史 JSON 和存档            |
| MIG-005 | 已完成 | Node、CI、许可证元数据与 HTML 入口卫生     | lint 基线、服务端测试、构建                                                                    | 不改变运行时行为                |
| MIG-006 | 进行中 | `packages/contracts` 与 WS v1/HTTP adapter | 双向 command schema、首批嵌套载荷 schema、envelope decoder 与 HTTP 输入校验；27 个契约测试通过 | 网络继续传输旧三元组            |
| MIG-007 | 待开始 | `packages/domain` 第一个纯逻辑模块         | 严格类型与高覆盖率                                                                             | 不导入 Vue/Express              |
| MIG-008 | 进行中 | 服务端配置、app factory 与严格类型化入口   | 11 个 HTTP/WS/CLI 集成测试与 `tsc` 通过                                                        | 旧前端可连接                    |
| MIG-009 | 已完成 | Vue 3、Vite 运行时启动                     | typecheck、核心 E2E、视觉回归                                                                  | Vite 环境变量和静态资源保持兼容 |
| MIG-010 | 已完成 | Pinia 状态域替换与 Vuex 移除               | 业务 store、运行时 effects 与组件命令均由 Pinia 驱动                                           | 保持单窗口模态框与输入流程语义  |

## 迁移历史与当前质量基线

- Node `v25.3.0`、npm `11.9.0`；此 Node 主版本已结束支持，迁移基线改用 Node `24.18.0` LTS。
- `npm run test:server` 通过；当前包含 11 个 HTTP、room、lobby、queue、未知 command、嵌套 payload 和版本信息集成测试。
- `npm run build` 通过；入口产物约为 JS 1.78 MiB、CSS 250 KiB，仍存在资源体积警告。
- ESLint：0 error、1,961 warning（34 个有告警文件）。在完全格式化前，CI 以此为不可增加的上限。
- 当前前端为 Vue 3 + Vite + Pinia；服务端为 TypeScript、Express 5 与 `ws`。历史 Vuex/Vue CLI 记录仅用于说明迁移路径。
- Playwright `1.61.1`：首页与创建房间流程可在 Chromium 中验证；`test:visual:update` 是唯一可写截图基线的命令，`test:visual` 仅比较。视觉截图暂在本地固定环境运行，待 Linux 字体镜像固定后加入 CI。
- MIG-009 已将开发、构建与 E2E 启动链切换到 Vue 3、Vite 和 Vuex 4；`VITE_API_BASE`/`VITE_WS_BASE` 保持原有后端连接行为，Vue 3 移除的 filter、`$set` 与销毁钩子均已替换。未覆盖视觉基线；经定位，右上角折叠菜单在 Vue 3 下的变换栅格化最多相差 678 像素（小于目标视口的 0.1%），视觉测试以 800 像素的紧阈值继续防回归。
- `MIG-LAW-001` 已补齐：服务端常规启动和 `--version` 均输出版权与 GPL 许可证告知；帮助菜单新增“法律与署名”入口，Playwright 覆盖其弹窗、版权和上游来源文本。
- 服务端入口已移除 `@ts-nocheck`：为连接、房间、待投递消息、原始 WebSocket 数据、TLS 和监听地址建立了 TypeScript 类型，并继续使用 v1 旧数组 envelope decoder。HTTP/avatar 与完整的 lobby、room、离线消息队列 WebSocket 生命周期已分别拆入独立模块；入口现在只负责配置、HTTP 组装、TLS 与 upgrade 绑定。
- `npm run check` 已成为本地整体验收门：格式与 lint 基线、运行时 TypeScript 源码扩展名、TypeScript、85 个单元测试、11 个 HTTP/WS/CLI 集成测试、3 个浏览器流程和生产构建均会执行；CI 同步运行非浏览器质量门与浏览器流程，视觉截图仍固定在本地环境。
- 历史批次从独立、低风险的 lobby Vuex 模块开始；其余状态域与 transport 随后已迁至 Pinia/TypeScript，`allowJs` 和 Vuex 均已移除。
- `Gradients.vue` 与基础 `Modal.vue` 已迁移至 `<script setup lang="ts">`；后续组件会按无状态、单一状态依赖、复杂交互的风险顺序迁移。
- `lobby` 已成为第一个完全由 Pinia 持有的状态域：Vuex module 已删除，大厅 WebSocket、页面可见性和 UI 读取均直接使用 Pinia，并有单元测试锁定状态和房间生命周期。
- `Menu.vue` 和 `InputModal.vue` 的大厅房间读取已改为直接消费 Pinia；它们其余状态仍暂由 Vuex 提供，后续会以同样方式分域替换。
- 模态框状态已迁移为 Pinia 的单一状态源，精确保留“切换时仅开启一个窗口、无参数时全部关闭”的旧语义；Vuex 临时只暴露同一响应式对象供未迁移的 Options API consumer 读取。`LegalModal.vue` 已使用 `<script setup lang="ts">` 和 Pinia，MIG-010 的单元测试覆盖互斥和全量关闭。
- localStorage 恢复入口已引入 TypeScript 安全读取器：JSON 损坏或顶层数组/对象形状不符时回退到默认值，不再令整个应用启动失败；该适配器仍保留旧 key 与序列化格式，后续再逐项迁入带版本的存档 schema。
- `players` Vuex 兼容模块已改为 TypeScript，并为旧的 Vuex `this.commit/state` 注入建立显式过渡适配类型；保留 mutation、action、getter 名称和夜间顺序算法，新增单元测试覆盖夜间顺序与本地玩家同步。该领域仍将在后续 Pinia 批次中拆解，届时会用领域模型替换过渡类型。
- `session` Vuex 兼容模块已迁移为 TypeScript，并与 `players` 共用本地 Vuex 过渡类型；保留输入、投票、消息队列、群聊和计时 mutation 的名称及存档字段，新增会话 ID 规范化与投票前置条件测试。该模块仍是 Pinia 分域迁移前的兼容层。
- 根 Vuex 装配层已迁移为 TypeScript，保留剧本角色映射、自定义角色编码、全局 mutation 与 Pinia 模态状态投影；因 Vuex 4 的 package exports 未暴露其声明入口，临时以本地声明隔离兼容类型，待移除 Vuex 时一并删除。新增测试锁定默认剧本映射和模态投影。
- Vuex 持久化插件已迁移为 TypeScript，维持既有 localStorage key、历史 session 数组与 JSON 写回格式；新增插件测试覆盖会话恢复和 mutation 写回。它仍会在后续 Pinia 分域完成后拆分并移除。
- WebSocket v1 envelope decoder 已拆为 `@townsquare/contracts/legacy-envelope` 的零依赖子入口；浏览器 session 与 lobby transport 均使用同一 decoder，畸形数组继续走原有 unsupported 消息分支，同时避免将 Zod 打入前端主包。
- 大厅 WebSocket 连接生命周期已从遗留 session transport 拆为独立 TypeScript 模块，保留房间列表、重连与 player ID 语义；新增模拟 WebSocket 测试锁定 v1 `setRooms` 入站消息到 Pinia 大厅状态的路由。
- 输入弹窗的请求、Promise resolve/reject 生命周期与输入元数据已迁至独立 Pinia store；页面、复杂组件和 session WebSocket 告警共用同一入口，`InputModal` 直接消费该 store，Vuex session 不再持有临时输入处理器。新增单元测试覆盖输入确认和文本告警关闭语义。
- 聊天面板开闭与键盘输入焦点已迁至 Pinia `interaction` 状态域；根键盘快捷键、聊天窗口、输入弹窗、主动离开和 WebSocket 断连清理均直接使用该状态，Vuex session 不再承载纯 UI 临时状态。
- 会话 WebSocket 的重连标志、在线人数和延迟已迁至 Pinia `sessionConnection` 状态域；transport 直接维护指标，菜单直接展示它们，保留 session 身份、授权与协议状态在 Vuex 兼容模块中。
- 会话 host/join 授权也已并入 `sessionConnection`；入房检测的 timeout 改为 WebSocket transport 私有句柄，菜单与捐赠入口直接读取 Pinia 授权状态，未改变授权成功、拒绝或超时后的原有提示和回退流程。
- 遗留 session transport 的 v1 入站 command switch 已抽为严格 TypeScript dispatcher：payload 维持 `unknown` 直至交给既有 handler，观察者专属 mutation 与带 feedback 的聊天/群聊路由均有独立单元测试锁定；后续会继续按 dispatcher、transport 生命周期和业务 handler 分段消除该 JS 文件。
- 遗留 Vuex mutation 到 session transport 的出站路由已迁至严格 TypeScript dispatcher；连接切换、玩家代词同步、消息队列停止和 review 全量 grimoire 同步均有单元测试覆盖，transport 生命周期仍保留在现有连接类中。
- 语音检测动画帧已从 session Vuex 模块迁至瞬态 Pinia audio store；菜单与全局 F2 热键共享同一状态，保持同一检测周期内不重复启动的保护逻辑。
- 角色抽取弹窗的 `drawRoles` 已迁至 Pinia draw store；该临时角色池不参与持久化或 WebSocket 同步，抽取关闭时仍会清空。
- 说书人聊天未读数已从 session Vuex 模块迁至 Pinia chat store；WebSocket 接收、聊天最大化和滚动到底部均继续使用同一清零/累加语义。
- 本机 `isTalking` 已迁至 Pinia audio store；遗留 `session/setTalking` mutation 仍负责座位身份校验、玩家状态同步和 WebSocket 出站，确保协议命令与交互行为不变。
- 倒计时秒数已迁至 Pinia timer store，`CountdownTimer` 把 interval 句柄与状态隔离；legacy `session/*Timer` mutation 仅作为 WebSocket 兼容入口，倒计时到零与无参续计时均有 fake-timer 测试。
- 角色、类型、伪装和魔典分发的临时高亮标记已迁至 Pinia distribution store；legacy mutation 保留原 payload，既更新本地高亮又继续触发现有 WebSocket 出站路由。
- 复盘视角已迁至 Pinia review store；旧 `session/setIsReview` mutation 继续驱动 localStorage 和出站协议，入站游戏状态及 review command 则直接更新该 store，避免重复同步。
- 旧夜间顺序与角色规则选项已迁至 Pinia legacy-options store；剧本角色处理、游戏状态打包、入站同步与 localStorage 都保留原有 JSON 与 v1 WebSocket 兼容路径。
- 提名、实时投票、匿名投票、锁定进度与投票历史已迁至 Pinia voting store；旧 Vuex mutation 名称保留为 localStorage 与 v1 WebSocket 的兼容入口。
- 自定义私货商人说明已迁至 Pinia session-settings store，并保留原有 localStorage 和 WebSocket 同步入口。
- 亡魂激活、使用与暴露参数已迁至 Pinia role-activity store；既有 localStorage 和 WebSocket mutation/命令入口保持兼容。
- 玩家昵称与头像已迁至 Pinia profile store；上传、说书人标识与 localStorage 仍经原有兼容入口工作。
- WebSocket 出站消息队列和去重计时器已迁至 Pinia message-outbox store；原有 mutation 继续触发传输兼容层。
- 私聊记录已迁至 Pinia chat store；历史恢复、发送确认与 localStorage JSON 格式保持兼容。
- 群聊成员关系与保留标记已迁至 Pinia chat store；玩家席位同步、持久化与 WebSocket 广播继续复用兼容 mutation。
- 房间身份、说书人凭据、玩家标识与席位已迁至 Pinia session-identity store；Vuex session 仅保留转发访问器以保障旧组件、存档和 WebSocket 生命周期兼容。
- 游戏面板显示状态已迁至 Pinia grimoire store；根 Vuex 仅引用同一响应式对象以兼容现有 mutation 广播。
- 已完成全部模态框与头像裁剪组件的 Composition API 迁移：输入、剧本、游戏状态、角色/角色分发、参考表、夜间顺序、提示标记、投票记录、群聊、抽取与头像裁剪均直接读取 Pinia；会影响存档或 v1 WebSocket 的写入继续通过兼容 mutation 出站层。剩余 Options API 组件为 Vote、Menu、Player 与 TownSquare。
- Vuex facade、模块、类型声明与 npm 依赖已删除；应用改由 Pinia runtime 启动持久化、lobby 与 session WebSocket effect。旧 mutation 名称只在 Pinia 命令边界保留，以维持本地存档和 WebSocket v1 兼容。
- 自定义剧本对象在 scenario store 进入状态前经共享 Zod schema 校验；损坏的 localStorage 集合不会阻断启动或后续群聊/投票持久化。浏览器侧契约子入口通过 Vite source alias 加载，避免 CommonJS workspace 导出在开发服务器中失效。
- `Menu.vue` 与 `TownSquare.vue` 已移除 `$store` 注入，改由显式 Pinia 命令入口执行兼容命令；Vuex 依赖、facade 与安装已删除。临时 Options 适配器及其三个 `@ts-nocheck` 仍是后续拆分目标。
- 组件 Sass 已迁移到模块语法，旧的颜色函数已替换为 `sass:color`，构建不再产生 Sass 弃用告警；2 张视觉基线保持通过。
- CI 的 `check:runtime-sources` 会拒绝 `src`、`server/src` 与共享包运行时源码中新增 `.js` 文件；测试和 Node 构建脚本不在该门禁范围内。
- 会话 WebSocket 与游戏状态导入均已在共享 contracts 边界校验：畸形会话消息会中止分发，游戏状态导入会拒绝错误的关键容器类型并兼容缺省历史字段。
- 服务端入站与浏览器 session 入站均有独立的 v1 command schema：未知服务端 command 会以 1008 关闭连接，未知 session command 不进入 dispatcher；`setTalking`、`direct`、`request` 与 `uploadFile` 的首批嵌套载荷 schema 已在服务端 dispatch 前校验，保留旧数组 envelope、现有 command 名称与 payload 格式。其余 payload schema 将继续按命令批次收紧。
- `LiveSession.disconnect()` 会释放 ping、消息队列、重连及授权计时器；fake-timer 回归测试保证断开后不保留 transport 计时器。
- App、Intro、Menu 与 ImageCropper 的跨组件命令已收敛为三个类型化事件，移除了根组件的动态字符串调用和 `any` 模板 ref；Menu 与 TownSquare 仍有临时 Options 上下文，未将其标记为完成。
- `Menu.vue` 的麦克风模式、阈值编辑、Web Audio 分析器和说话状态命令已改为直接的 Composition API ref/function；保留原有 `setTalking` 与 `setAudioThreshold` 命令和浏览器权限行为。其余会话、分发与玩家管理方法仍在临时 Options 适配层中。
- `Player.vue` 到 `TownSquare.vue` 的玩家操作事件已从字符串方法名动态调用改为显式联合事件与 `switch` 分发，覆盖座位、提醒、角色、换位、移动、提名、聊天和投票操作；仍由现有 Pinia 命令兼容层执行实际游戏变更。
- `TownSquare.vue` 的当前选中玩家、坐席切换、提醒与角色弹窗已迁为直接的 Composition API 状态和函数；换位、移动、提名及聊天等交互仍将在后续批次脱离其 Options 适配器。
- `TownSquare.vue` 的换位、移动、提名、票数和说书人席位操作已迁为 Composition API；临时 `swap`/`move`/`nominate` 状态直接驱动既有模板，并保留在座位重排时修正提名索引的旧规则。
- `TownSquare.vue` 的私聊与群聊开闭、发送、未读清理、亡魂转发和 DOM 滚动焦点也已迁为 Composition API；消息仍通过同一 `session/updateChatSent` 兼容命令送入既有存档与 v1 WebSocket 路径。
- `TownSquare.vue` 已移除临时 Options/context 适配器与 `@ts-nocheck`，成为完整的 `<script setup lang="ts">` 组件；空 DOM ref、可选群聊和可用角色状态现在经 TypeScript 收窄处理。
- `Menu.vue` 的新增/清空/随机座位、清空角色、私货商人说明和日夜切换已迁为直接 Composition API 命令；确认弹窗继续复用同一输入服务，玩家状态继续通过既有兼容命令同步。
- `Menu.vue` 的剧本版本选择与自定义图标确认已迁为 Composition API ref/function；勾选草稿在打开对话框时仍从 scenario store 复制，提交时仍走原有 `setSelectedEditions` 命令。
- `Menu.vue` 的旧夜间顺序与旧角色能力草稿已迁为 Composition API；提交继续执行 `setUseOldOrder`/`setUseOldRole` 兼容命令、重载已有自定义角色并重新应用当前剧本。
- `Menu.vue` 的背景、昵称与房间链接操作已迁为直接 Composition API 函数；host/join 流程也已改用同一昵称入口，移除了对已删除 Options 方法的调用。
- `Menu.vue` 的倒计时输入、开始与停止已迁为 Composition API ref/function；仍通过 `session/startTimer` 与 `session/stopTimer` 兼容命令驱动既有 WebSocket 和持久化路径。
- `Menu.vue` 的角色、类型、伪装和魔典分发对话框已迁为 Composition API ref/function；2 秒临时分发标记、座位输入与确认流程保持原有命令和 payload。
- `Menu.vue` 的复盘视角与本地数据清理已迁为 Composition API；复盘仍调用既有 `session/setIsReview` 和玩家复活命令，清理仍只作用于 TownSquare localStorage 命名空间。

## 本批次约束

- 允许：运行时固定、文档、CI、构建入口卫生和许可证元数据。
- 禁止：改动游戏规则、UI、网络消息格式、存档格式、角色资源或 Vue 业务组件。
- 停止条件：任一基线命令失败，或发现改动影响页面/协议行为。

下一批：为 WebSocket payload 与存档逐命令补 schema，继续拆分 Menu/TownSquare 的临时 Options/命令适配层，并收紧 contracts/domain adapter。
