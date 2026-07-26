# 现代化迁移任务账本

最后更新：2026-07-26（夜间顺序纯逻辑迁入 domain workspace，并继续收紧 WebSocket payload 边界）
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
| MIG-007 | 进行中 | `packages/domain` 纯逻辑模块               | 投票统计、夜间顺序严格类型化与表驱动测试；后续补覆盖率门禁                                     | 不导入 Vue/Express              |
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
- `npm run check` 已成为本地整体验收门：格式与 lint 基线、运行时 TypeScript 源码扩展名、TypeScript、111 个单元测试、13 个 HTTP/WS/CLI 集成测试、4 个浏览器流程和生产构建均会执行；CI 同步运行非浏览器质量门与浏览器流程，视觉截图仍固定在本地环境。
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
- `Menu.vue` 的创建、加入与离开房间流程已迁为 Composition API，最后的 Options/context 适配器已删除；房间身份、清场、群聊退出、消息队列和亡魂重置仍走现有兼容命令。
- `Menu.vue` 已移除 `@ts-nocheck`；模板事件、可选输入和数组访问均经 TypeScript 收窄，完整的 Vue 类型检查现覆盖该组件。
- v1 WebSocket 的稳定标量命令（布尔状态、计时器、投票速度及无参数命令）现于服务端转发前经 contracts 校验；畸形 payload 以 1008 拒绝，嵌套命令仍按现有专用 schema 分批收紧。
- 浏览器 session transport 的 v1 envelope 编码与解码已从 `socket.ts` 提取为独立类型化模块；仍使用 contracts source 子入口，避免 Vite 开发环境误加载过期 workspace 构建产物。
- 浏览器 session 的持久化出站队列分流已从 `socket.ts` 提取为纯 dispatcher；direct、request、upload 和房间广播仍走相同 v1 传输助手，并有独立回归覆盖。
- 服务端 v1 WebSocket 校验已扩展至稳定的投票、锁票、说书人标识和私货商人标量 payload；错误的元组形状或标量类型会在房间广播前以 1008 拒绝。
- v1 WebSocket 的座位标记、换位/移动和 ping payload 也已按客户端真实出站格式校验；对象标记保留 `val`/`force` 兼容形状。
- v1 WebSocket 的代词、座位移除和旧规则选项 payload 已加入 contracts 校验，并由服务端拒绝畸形字段。
- `getNightOrder` 已从前端目录迁入 `@townsquare/domain`；玩家、传奇角色、自定义顺序与缺失顺序的回退行为由纯函数测试锁定。Vite 在开发期直接解析 workspace 源码，类型检查则先构建 domain，避免使用过期声明文件。
- WebSocket v1 的复杂广播与直发载荷现校验关键容器：游戏状态、剧本版本、角色/传奇角色、夜间顺序、座位更新、魔典、聊天和角色状态。服务端会在转发前以 `1008` 拒绝错误结构，合法的房间广播与离线消息队列继续保持原三元组格式。
- CI 基线作业现在执行运行时源码扩展名门禁，浏览器作业会保留 Playwright 报告和失败追踪作为构建产物；视觉基线仍维持显式、本地比较，待固定 Linux 字体环境后单独接入。
- 浏览器 session transport 会在调用入站 dispatcher 前使用共享协议 schema 拒绝畸形服务端消息；Vite 在开发期直连该 contracts 子入口，避免 workspace 构建产物过期导致的校验偏差。
- 遗留 transport 的 Pinia 状态投影已补齐自定义剧本状态、阵营别名和首夜/其他夜顺序；发送完整游戏状态与独立剧本同步命令现在读取到与原 Vuex state 相同的字段。
- 生产构建会校验当前入口 JS（1.8 MB）和 CSS（260 KB）的基线预算，后续代码拆分或资源优化可以收紧预算，但不会在迁移过程中无声扩大首屏产物。
- 样式基础层已开始建立：Sass 阵营色移动到 `styles/tokens`，全局 CSS 变量提供同值映射；现有组件仍经兼容入口读取原变量，避免在 DOM/CSS 归档前改变视觉。
- Playwright 已覆盖真实创建房间并进入说书人魔典的链路，验证昵称、房间号、座位初始化和本地测试后端的 WebSocket host 授权可以协同完成。
- 所有前端动态角色与剧本图片现在均经 Vite 的 `import.meta.glob` 资源映射解析，移除了 Webpack `require` 运行时依赖；房主进入魔典时会正确显示剧本图片。
- 创建房间自动复制链接在浏览器拒绝剪贴板权限时会安全忽略该非关键操作，不再产生未处理 Promise rejection；Playwright 覆盖了拒绝权限的房主流程。
- Vitest 覆盖率报告已作为独立命令和 CI artifact 接入；当前先如实报告 Vitest 可审计的 TypeScript 运行模块，组件覆盖将随 Vue Test Utils 的实际挂载测试单独纳入，待补齐高风险模块测试后再按迁移计划分层设置门槛。
- `@townsquare/domain` 的夜间顺序边界（无角色、无夜间顺序与重复数字顺序）已由表驱动回归覆盖；CI 现要求该纯逻辑包 statements/lines ≥95%、branches ≥90%，作为第一个按模块提升的覆盖率门禁。
- `@townsquare/contracts` 已补齐标量 payload、未知入站命令、请求目标与自定义角色规范化失败路径的回归覆盖；CI 现要求 contracts 与 domain 两个共享包均达到 statements/lines ≥95%、branches ≥90%。
- Playwright 视觉基线已扩展到真实房主魔典的白天与夜晚状态，固定本地测试后端、房间号、座位数和动画，避免后续样式归档只覆盖首页。
- Vue Test Utils 已开始实际挂载 Vue 组件：`Intro` 的创建/加入房间显式事件和共享菜单状态已由 jsdom 回归测试覆盖，为后续复杂组件交互测试建立基线。
- `useViewport` 共享浏览器适配器现有 jsdom 生命周期测试，锁定初始尺寸、resize 响应和组件卸载时的监听器释放；TownSquare 已通过该适配器复用窗口尺寸状态。
- 服务端 WebSocket 集成测试已覆盖同一 host token 的说书人接管：旧连接以 1012 关闭、房间玩家不断开，新的说书人仍可继续发送 v1 游戏状态。
- 服务端同样覆盖相同玩家 ID 的重连替换：旧玩家连接以 1012 关闭，新连接可继续向说书人发送 v1 claim 消息，避免 room registry 残留旧 socket。
- 严格 TypeScript 诊断已确认唯一剩余 `@ts-nocheck` 为 `src/store/socket.ts`；MIG-011 已完成 LiveSession 字段、出站 helper、队列 payload guard、连接生命周期、稳定标量、聊天/群聊、角色状态与座位 handler 声明；玩家运行时投影、游戏状态、魔典同步与定向分发参数也已收窄。移除抑制后的错误数从 701 降至 103，剩余主要为魔典出站组装和兼容 mutation payload 的收窄。该例外由 CI 限制为唯一允许项，禁止新增匿名抑制，并将按生命周期与协议 handler 分段移除。
- MIG-011 的连接生命周期现已在 transport 边界收窄：会话号仅接受有限的字符串或数字标量，WebSocket close/message 事件、输入弹窗请求和授权回调均有显式类型；非布尔授权与非字符串告警会被安全忽略，避免未校验服务端 payload 污染 Pinia 授权状态或弹窗。
- 已由共享 contracts 校验的稳定入站标量命令（说书人标识、头像链接、离开通知、匿名投票、私货商人说明、旧规则选项和复盘状态）现在直接传入精确的 TypeScript handler 参数；不会改变既有 v1 payload 格式。
- `setTalking`、设置/启动倒计时现在会在 session transport 出站前使用 contracts schema 或有限数值 guard 收窄；畸形 mutation payload 不会写入 WebSocket，已有 fake transport 回归覆盖。
- 聊天、群聊和玩家状态 payload 已从 contracts 导出精确类型，transport 对 feedback ID 统一按字符串去重，并在缺失群组、成员或亡魂目标时安全停止后续转发；完整 payload 仍遵守原 v1 envelope。
- 角色激活/使用和玩家代词的稳定 payload 也已复用 contracts 类型；session transport 仅向实际支持的 `wraith` 角色状态发出 `usingRole` 请求，保留其他 v1 入站角色状态的原有兼容提交。
- 出站队列确认 ID 已在 transport 边界限制为整数；字符串或其他畸形 feedback 不会影响 Pinia queue，单元测试覆盖该拒绝分支。
- 入站座位确认 payload 已抽为共享 contracts tuple；本地座位申请只接受 `-1` 或非负整数，错误类型不会进入 WebSocket 传输。
- `LiveSession` 的玩家运行时状态不再以 `unknown[]` 表示：常用身份、角色、状态、提醒、投票与群聊字段均有显式过渡投影，允许后续游戏状态与魔典 handler 在真实字段上继续收窄。
- 游戏状态 contracts schema 现描述席位同步使用的姓名、身份、提醒、投票、状态与可选角色 ID；入站同步会跳过缺失本地玩家并将无效 nomination 回退为空候选人，保持 lightweight/full game state 的 v1 兼容路径。
- 游戏状态的历史 player ID 保留 `string | number` 兼容：服务端房间转发回归测试锁定 numeric ID 的直发场景，避免 schema 收紧误拒绝旧 v1 游戏状态。
- 魔典 contracts schema 已区分角色、玩家提醒与说书人提醒条目；入站处理只读取符合对应条目形状的数组，并跳过不存在的席位，避免不完整直发消息污染本地玩家状态。
- 伪装与魔典分发的目标参数现有独立 TypeScript 结构，支持全体、角色、座位和 player ID 四种历史路由；座位不在当前玩家列表时不会生成无效直发消息。
- 已在 numeric player ID 兼容修复后重新运行完整 `npm run check`：格式、lint、运行时源码、唯一 TypeScript 抑制、类型检查、111 个单元、13 个服务端集成、4 个 Chromium E2E 和生产构建全部通过。浏览器流程仍会输出既有的 readonly computed Vue warning，未作为本批改动范围扩展。
- session transport 的 `leaveSeat` 已不再直接写入只读 runtime projection，而是走 `session/claimSeat` 兼容命令；此路径已有 socket 回归。创建房间流程中的 readonly computed Vue warning 仍存在，已确认并非该离座写入所致，后续将按组件双向绑定单独定位。
- lobby transport 的遗留 store 适配器已收窄为仅含 player ID 的状态投影；入站 WebSocket 仅接受字符串帧和全字符串房间列表，混合类型列表不会写入 Pinia lobby 状态，并有独立回归覆盖。
- 持久化恢复的聊天、群聊、角色状态和玩家角色 ID 已由 `unknown` 经 record/array guard 收窄；群聊成员必须全部为字符串 ID，损坏或混合类型的旧 JSON 不会阻断新的会话或写入 Pinia。
- 群聊持久化的新增、移除成员和保留标记现在复用同一受验证的旧存档投影；畸形群聊条目会在下一次合法写入时被排除，合法群聊与其 `keep` 状态保持原有 JSON 格式。回归测试覆盖混合有效/无效旧条目后的新增群聊。
- `isRole` 旧存档现在仅接受“角色 ID → 属性记录”的两层对象；初始化与写回都会拒绝标量或数组条目，保留原有真值写入、假值删除和 `session/setIsRole` 兼容命令。回归测试覆盖混合损坏/合法记录的恢复和清理。
- 抽取角色的 Pinia 临时池已从 `any[]` 收窄为带稳定角色 ID 的记录列表；抽取时从数组移除角色后会显式确认元素存在，避免异常状态下把 `undefined` 传入显示和分发路径。
- 自定义剧本传输压缩器现显式区分完整旧角色记录、官方角色 ID 引用和数字键紧凑记录；仍按原字段索引生成 v1 自定义剧本 payload，选择器回归测试锁定官方/自定义角色两种输出。
- session 入站 dispatcher 现只依赖其实际读取的 `players.players` 投影和 `commit` 命令边界，不再把整个遗留 store 标为匿名类型；旁观者结束提名时保存历史与投票选择的既有顺序由回归测试锁定。
- `LiveSession` 的计时器句柄现分别使用 timeout/interval 类型，清理前显式排除空句柄；断线、授权回应与队列停止继续使用正确的清理 API。运行时 session 投影补齐授权/座位字段，队列确认也会先跳过不存在的索引项。移除 transport 抑制后的严格诊断从 127 降至 119，socket 回归继续覆盖断开时释放 ping 与出站队列计时器。
- `LiveSession` 的游戏状态出站投影现显式包含魔典、角色表、剧本状态与传奇角色字段；定向群聊同步会排除缺失席位，历史游戏状态扩容会跳过不可读取的数组项。移除 transport 抑制后的严格诊断从 119 降至 103，旧 v1 game-state 和群聊 payload 形状保持不变。

## 本批次约束

- 允许：运行时固定、文档、CI、构建入口卫生和许可证元数据。
- 禁止：改动游戏规则、UI、网络消息格式、存档格式、角色资源或 Vue 业务组件。
- 停止条件：任一基线命令失败，或发现改动影响页面/协议行为。

下一批：为 WebSocket payload 与存档逐命令补 schema，继续拆分 Menu/TownSquare 的临时 Options/命令适配层，并收紧 contracts/domain adapter。
