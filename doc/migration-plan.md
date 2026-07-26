# Town Square 现代化迁移规划（AI 执行版）

> 文档状态：初稿  
> 编写日期：2026-07-24  
> 适用范围：当前仓库的前端、后端、构建、样式、数据、测试与交付流程

## 1. 结论先行

本项目适合渐进式迁移，不适合直接推倒重写。

推荐的最终技术栈是：

- 前端：Vue 3、Composition API、`<script setup lang="ts">`、Pinia、Vite；
- 后端：Node.js Active LTS、TypeScript、Express 5、`ws`；
- 前后端共享：TypeScript 类型 + Zod 运行时校验；
- 单元/组件/集成测试：Vitest、Vue Test Utils、MSW；
- 浏览器端到端与视觉回归：Playwright；
- 工程质量：`vue-tsc`、ESLint flat config、Prettier、Stylelint、覆盖率门禁；
- 样式：保留 Sass，但重新划分全局层、设计变量和组件样式；迁移期间不改变视觉；
- 仓库：npm workspaces 管理 `web`、`server`、`contracts` 和 `domain`。

不建议在第一轮同时引入 Nuxt、Tailwind、组件库、Socket.IO、数据库或全新的 UI 设计。这些技术目前没有直接解决项目最主要的问题，反而会扩大行为变化和回归范围。

迁移由 AI 完成时，工作单元应按“可证明正确的变更批次”组织，而不是按传统的人日或人员分工组织。每个批次必须具备明确的文件边界、测试前置条件、自动验收、回滚点和完成报告。禁止让 AI 一次性重写全部前后端。

## 2. 迁移目标

### 2.1 必须完成

1. 前端升级到当前稳定版 Vue 3 和 Vite。
2. 项目自有运行时代码全部迁移到 TypeScript，不再保留 `.js` 业务文件。
3. Vuex 迁移到 Pinia，组件逐步迁移到 Composition API。
4. 后端改为 TypeScript，并拆分 HTTP、WebSocket、房间、消息和头像模块。
5. 前后端共用协议类型，并在所有外部输入边界执行运行时校验。
6. 补齐单元、组件、服务端集成、WebSocket 兼容、E2E 和视觉回归测试。
7. 样式建立清晰分层，消除无序的全局覆盖，但迁移阶段保持现有视觉。
8. 保持现有房间链接、本地存档、自定义剧本和 WebSocket 消息协议兼容。
9. 建立持续集成门禁，使 AI 后续修改可被机器验证。
10. 保留许可证、作者署名、来源和 UI 法律入口。

### 2.2 本轮非目标

- 不重新设计页面、交互或文案；
- 不主动改变游戏规则和已有功能；
- 不把 WebSocket 改成 Socket.IO 或其他协议；
- 不为“技术先进”而引入 SSR/SSG；
- 不在无业务需求时引入数据库、账号系统或微服务；
- 不在迁移期间批量压缩、重画或替换角色图标；
- 不追求所有文件一次性达到理想架构。

发现 bug 时可以修复，但必须先添加能稳定复现问题的测试，再提交修复。bug 修复与纯迁移最好分开提交，便于审查和回滚。

## 3. 当前项目基线

### 3.1 技术与规模

| 项目 | 当前状态 |
| --- | --- |
| 前端 | Vue 2.6、Vue CLI 5、Webpack、Vuex 3、Options API、JavaScript |
| 后端 | Express 4、`ws` 7、CommonJS JavaScript |
| 样式 | 组件内 CSS/SCSS，少量共享 Sass 变量，大量组件级和全局选择器混用 |
| 测试 | 1 个 Node 原生后端集成测试；无前端单元、组件、E2E 和视觉测试 |
| 业务代码规模 | `src` 与 `server` 中约 15,000 行 JS/Vue/SCSS |
| 静态资源 | `src/assets` 约 49 MB、345 个文件，其中约 335 个 PNG |
| 数据 | 254 个角色、8 个版本、34 个传奇角色及相克/游戏配置 JSON |
| 构建产物 | 当前生产构建约 51 MB；入口 JS 约 1.76 MB，CSS 约 250 KB |

主要热点文件：

- `src/store/socket.js`：约 2,651 行；
- `src/components/Menu.vue`：约 1,570 行；
- `src/components/Player.vue`：约 1,442 行；
- `src/components/TownSquare.vue`：约 1,389 行；
- `src/store/persistence.js`：约 487 行；
- `server/index.js`：约 430 行。

### 3.2 当前可运行性

本规划编写时实际验证结果：

- `npm run test:server` 通过，但只有 1 个大粒度集成用例；
- 当前生产构建能够完成；
- lint 没有 error，但存在约 1,956 个 warning，绝大多数是格式问题；
- 构建存在大资源和大入口警告；
- 仓库当前固定使用 Node v25.3.0；发布前应在该固定版本下保留完整质量门证据。

### 3.3 主要耦合点

1. `socket.js` 同时承担连接生命周期、重连、消息队列、协议解析、业务权限、状态变更、聊天、投票、计时器和 UI 弹窗调用。
2. Vuex mutation 中存在计时器、跨模块访问、`this.commit` 和直接状态引用，领域逻辑不能脱离 store 测试。
3. `persistence.js` 同时负责初始化、旧数据兼容、页面标题和所有 localStorage 写入。
4. 大组件同时负责布局、浏览器事件、媒体能力、对话框、业务流程和网络动作。
5. WebSocket 使用数组元组协议，例如 `[command, params, feedback]`，命令较多但没有统一类型或运行时 schema。
6. 自定义剧本 JSON、localStorage、HTTP 和 WebSocket 都是“不可信输入”，目前校验分散且不完整。
7. 多个组件独立监听窗口尺寸，存在重复的响应式逻辑。
8. 部分头像 URL 和线上域名写死在业务代码中，没有全部走统一配置。
9. 全局样式与非 scoped 样式依赖现有 DOM 结构，直接拆组件可能造成隐蔽视觉变化。

### 3.4 迁移前需要确认的已知问题候选

以下问题应先写测试确认，不应在纯迁移提交中顺手修改：

- session 初始字段使用 `StId`，其他代码使用 `stId`，大小写不一致；
- 部分条件使用位运算符 `&` 而不是逻辑运算符 `&&`；
- 清理设置时使用 `localStorage.clear()`，可能删除同域名下非本应用数据；
- 根目录 `index.html` 包含 Git 冲突标记，虽然当前 Vue CLI 使用的是 `public/index.html`；
- `package.json` 声明 LGPL，而 `LICENSE`、README 和 PROVENANCE 指向带第 7 条附加条款的 GPLv3；
- 头像地址存在绕过 `apiBase` 的硬编码；
- ping 间隔的代码值与注释不一致；
- 连接重试、定时器和浏览器事件的释放逻辑需要用 fake timers 和断线测试确认。

## 4. 目标架构

### 4.1 建议目录

```text
townsquare/
├── apps/
│   ├── web/
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── app/                 # 应用装配、入口、全局 provider
│   │   │   ├── modules/
│   │   │   │   ├── game/            # 魔典、玩家、角色、提醒标记
│   │   │   │   ├── session/         # 房间连接、座位、身份
│   │   │   │   ├── lobby/           # 房间大厅
│   │   │   │   ├── voting/          # 提名、投票、投票历史
│   │   │   │   ├── chat/            # 私聊、群聊、消息队列
│   │   │   │   ├── scripts/         # 剧本导入、解析、夜间顺序
│   │   │   │   ├── profile/         # 昵称、头像、裁剪
│   │   │   │   └── settings/        # 本地设置与版本提示
│   │   │   ├── shared/
│   │   │   │   ├── components/
│   │   │   │   ├── composables/
│   │   │   │   ├── services/
│   │   │   │   ├── styles/
│   │   │   │   └── utils/
│   │   │   ├── assets/
│   │   │   └── data/
│   │   └── tests/
│   └── server/
│       ├── src/
│       │   ├── app.ts
│       │   ├── config/
│       │   ├── http/
│       │   ├── websocket/
│       │   ├── rooms/
│       │   ├── avatars/
│       │   └── observability/
│       └── tests/
├── packages/
│   ├── contracts/                    # HTTP/WS schema、DTO、协议版本
│   ├── domain/                       # 无 Vue/Node 依赖的纯业务逻辑
│   └── test-fixtures/                # 合法/非法剧本、消息和游戏状态样例
├── e2e/
├── doc/
├── package.json
└── package-lock.json
```

`packages/domain` 只放真正能写成纯函数的规则，例如剧本标准化、角色筛选、夜间顺序、投票统计和游戏状态序列化。不要把 Vue store 或服务器 socket 对象包装后假装成“领域层”。

### 4.2 前端技术选择

| 领域 | 选择 | 原因 |
| --- | --- | --- |
| UI 框架 | Vue 3 当前稳定版 | 官方主线，支持 Composition API 和更好的 TS 推导 |
| SFC 写法 | `<script setup lang="ts">` | 减少样板代码，props/emits/ref 类型更直接 |
| 构建 | Vite 当前稳定版 | 替代已停止维护主线的 Vue CLI，开发和测试工具统一 |
| 状态 | Pinia | Vue 3 官方推荐状态管理，便于按业务拆 store |
| 路由 | 暂不引入 | 当前主要使用根路径和 hash 房间码；没有真实页面路由需求 |
| 外部数据校验 | Zod | 共享类型与运行时校验，覆盖 JSON/HTTP/WS/localStorage 边界 |
| 图标 | 升级 Vue 3 兼容的 Font Awesome 包 | 保留当前图标和视觉，不更换图标体系 |
| 图片裁剪 | 升级 Cropper.js 并封装 adapter | 将第三方 API 隔离在 profile 模块 |

迁移期间可短暂使用 `@vue/compat` 和 `allowJs`，但它们必须有删除批次和 CI 截止门禁，不能成为永久状态。

### 4.3 后端技术选择

后端首轮保留 Express 和原生 `ws` 的语义，只升级到当前稳定的 Express 5 并改为 TypeScript。

理由：

- 当前服务端体量不大，Express + `ws` 已能覆盖需求；
- 最大问题是单文件、无协议类型和测试不足，不是框架能力不足；
- 同时更换框架与协议会使新旧客户端交叉兼容验证变复杂；
- 后续如果出现高并发、统一 schema 路由或插件隔离需求，再单独评估 Fastify。

后端拆分目标：

```text
HTTP request
  -> route schema
  -> avatar/init/health service
  -> response schema

WebSocket upgrade
  -> URL/origin validation
  -> connection registry
  -> protocol decoder
  -> command handler
  -> room service
  -> protocol encoder
```

房间和待发消息仍保持内存存储，浏览器端说书人仍是游戏状态权威来源。这是现有产品语义，除非另开需求，否则本轮不改变。

### 4.4 共享协议

创建 `packages/contracts`，至少包含：

- `RoomId`、`PlayerId`、`HostToken`；
- `Role`、`Edition`、`Fabled`、`Jinx`、`Player`；
- `GameStateSnapshot` 及版本号；
- HTTP request/response schema；
- 每个 WebSocket command 的 discriminated union；
- 旧数组元组协议的 decoder/encoder；
- localStorage snapshot schema 与迁移版本。

第一阶段继续在网络上传输旧格式：

```ts
type LegacyEnvelope = [
  command: string,
  params?: unknown,
  feedback?: string | number | false,
];
```

内部处理时立即 decode 成带类型的消息对象，发出前再 encode 回旧元组。这样新前端、新后端、旧前端、旧后端可以交叉运行。

不应在同一批次把协议改成 JSON object。若未来需要协议 v2，应在 v1 完整兼容测试稳定后，通过显式版本协商独立实施。

## 5. 样式与静态资源规划

### 5.1 原则

1. 迁移期像素级保持现有主要页面；
2. 先建立截图基线，再移动或重命名样式；
3. 不同时进行 DOM 重构与 CSS 重构；
4. CSS 变量承载运行时主题值，Sass 承载编译期函数、mixin 和生成逻辑；
5. 优先使用 scoped 样式和模块局部类，确需全局的样式必须进入明确的全局层；
6. 不引入 Tailwind 或 UI 组件库，以免改变 specificity、DOM 和默认样式。

### 5.2 建议分层

```text
shared/styles/
├── tokens.scss          # Sass 常量、断点、阵营色
├── css-variables.scss   # :root 自定义属性
├── reset.scss           # 最小化 reset
├── base.scss            # html/body、字体、基础元素
├── utilities.scss       # 少量稳定工具类
├── media.scss           # 全局响应式规则
└── legacy.scss          # 暂时无法安全归属的旧全局样式
```

组件样式继续放在相应 SFC 内。`legacy.scss` 必须记录来源和删除条件，迁移结束时应为空或只保留经确认的全局规则。

现有阵营色 Sass 变量可先原值迁入 tokens，再映射为 CSS 自定义属性：

```scss
:root {
  --color-team-townsfolk: #1f65ff;
  --color-team-outsider: #46d5ff;
  --color-team-minion: #ff6900;
  --color-team-demon: #ce0100;
  --color-team-traveler: #cc04ff;
  --color-team-fabled: #ffe91f;
}
```

### 5.3 视觉回归基线

Playwright 截图至少覆盖：

- 首页/空魔典；
- 说书人魔典白天与夜晚；
- 玩家视图；
- 投票进行中；
- 角色、剧本、夜间顺序、聊天和设置弹窗；
- 自定义背景和视频背景；
- 典型桌面、平板、手机横屏、手机竖屏；
- hover 与 touch 两种交互条件。

视觉阈值应先根据现有字体渲染建立合理值。字体文件、图片尺寸、圆形座位布局和动画状态必须固定，动态时间、随机角色、房间号等应在截图测试中 mock。

### 5.4 资源优化

资源优化放在视觉等价迁移完成之后，单独提交：

- 生成图片清单、来源和实际引用关系；
- 删除确认为未引用的重复资源；
- 按页面/弹窗动态加载非首屏资源；
- 对大 PNG 提供无损或可验证等价的 WebP/AVIF 版本；
- 保留原文件直到视觉测试和人工抽样确认；
- 对构建产物设置 JS/CSS/图片预算，但首个门禁以当前基线为上限，之后逐步收紧。

## 6. 测试体系

“完整的 test”应理解为关键风险和用户流程被完整覆盖，而不是机械追求 100% 行覆盖率。

### 6.1 测试分层

| 层级 | 工具 | 重点 |
| --- | --- | --- |
| 类型测试 | `tsc`、`vue-tsc`、必要时 `expectTypeOf` | 协议、store、组件 props/emits |
| 单元测试 | Vitest | 领域纯函数、序列化、校验、计时器、重连退避 |
| Store 测试 | Vitest + Pinia testing utilities | 玩家、房间、投票、聊天、设置状态转换 |
| 组件测试 | Vue Test Utils | 交互、事件、权限显示、弹窗、键盘操作 |
| API 测试 | Vitest + 原生 fetch/测试 server | health、init、头像、错误响应、CORS |
| WebSocket 集成 | Vitest + `ws` | 房间、host 鉴权、直发、广播、离线队列、限流 |
| 网络 mock | MSW | 前端 HTTP 失败、延迟、非法响应 |
| E2E | Playwright | 真实浏览器 + 真实测试后端的完整流程 |
| 视觉回归 | Playwright screenshots | 样式和布局等价 |
| 可访问性 | `@axe-core/playwright` | 关键页面的严重问题，避免迁移造成退化 |

### 6.2 必测业务矩阵

#### 剧本和角色

- 官方版本加载、全角色筛选和额外旅行者；
- 自定义 JSON 的最小/完整/非法/未知字段输入；
- `traveler` 与 `traveller` 兼容；
- 自定义角色默认值、ID 清理、重复 ID；
- firstNight、otherNight、bootlegger 和 jinxes；
- 旧角色与旧夜间顺序开关；
- 自定义剧本的序列化再导入。

#### 玩家和魔典

- 增加、删除、清空、交换、移动玩家；
- 分配角色、角色类型、伪装和完整魔典；
- 存活/死亡、提醒标记、传奇角色；
- 座位认领、离座、说书人身份；
- 白天/夜晚、静态模式、缩放和背景。

#### 房间和 WebSocket

- 创建/加入/离开/重连；
- 相同 host token 接管和错误 token 拒绝；
- 无 host 时加入检查；
- host 与玩家权限边界；
- 直发、广播、feedback、离线消息和确认删除；
- ping/pong、重复连接、房间大厅增加/删除；
- 消息大小、消息速率、非法 JSON 和未知 command；
- host 离开时房间销毁和玩家断开；
- 旧客户端 ↔ 新后端、新客户端 ↔ 旧后端、新客户端 ↔ 新后端。

#### 投票、聊天和计时器

- 普通投票、秘密投票、锁票、暂停与结束；
- 多票、标记玩家、投票历史；
- 私聊、群聊、成员增删、离线消息、未读数；
- 计时器开始、停止、恢复和时间漂移；
- fake timers 下的资源释放。

#### 本地持久化

- 每一个现有 localStorage key 的读写兼容；
- 缺失、损坏、旧版本和部分数据；
- 迁移失败时不覆盖原数据；
- 退出房间后应清理和应保留的数据；
- 应用只能删除自己的 key。

#### 头像和媒体

- PNG/JPEG/WebP、错误格式、超限、损坏图片；
- 旋转、裁剪、缩放、默认头像和缓存 header；
- 麦克风授权成功/拒绝/设备丢失；
- 音频状态和事件监听释放。

### 6.3 覆盖率门禁

建议最终门禁：

- 全仓库 statements/lines ≥ 85%，branches ≥ 75%；
- `contracts`、`domain`、协议 decoder/encoder、持久化迁移 ≥ 95% lines、90% branches；
- 不为提高数字测试第三方包装或静态数据；
- 每个 bug 修复必须有回归测试；
- 覆盖率不得较主分支下降。

迁移初期采用逐步提高的门槛，不要在第一批为了达到数字而生成低价值断言。

### 6.4 标准验收命令

最终根目录应提供：

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:visual
npm run build
npm run check
```

`npm run check` 应运行除视觉基线更新外的所有 CI 必需检查。`test:visual` 只能比较截图，更新基线必须使用单独命令，防止 AI 在测试失败时自动覆盖正确基线。

## 7. 面向 AI 的执行方式

### 7.1 工作单元

每个 AI 迁移批次应包含以下固定字段：

```text
任务目标：
允许修改：
禁止修改：
前置基线：
实现约束：
必须新增的测试：
验收命令：
兼容性检查：
停止条件：
完成报告：
```

单个批次的理想范围：

- 一个模块或一个基础设施目标；
- 通常不超过约 20 个有实质变化的文件；
- 能在一次上下文中读完涉及的旧实现、契约和测试；
- 独立通过 typecheck、相关测试和 build；
- 可以被单独 revert；
- 不混入格式化整个仓库、资源压缩或无关 bug 修复。

强大的 AI 可以完成大规模改造，但仍会受到上下文、隐式行为和错误基线的限制。把任务切小不是为了迁就人工速度，而是为了让每一步都能由机器判定正确，并让后续 AI 读取稳定的中间状态。

### 7.2 AI 必须遵守的规则

1. 修改前先读取模块入口、依赖、测试和相关协议 schema。
2. 先添加 characterization test，再移动高耦合逻辑。
3. 不删除旧适配层，直到新旧交叉兼容测试通过。
4. 不通过放宽类型、加入 `any`、跳过测试或提高截图阈值来“修复”失败。
5. 不自动更新视觉基线；差异必须输出为构建产物供检查。
6. 外部输入保持 `unknown`，通过 schema 后才能进入领域层。
7. 每批结束输出：变更摘要、兼容性影响、测试结果、残余风险和下一批建议。
8. 发现超出当前批次的 bug，只记录并添加最小复现；除非阻塞本批，否则不顺手重构。
9. 任何删除必须先证明无引用，并说明恢复方式。
10. 许可证、署名、README 法律声明和 UI 法律入口是不可删除项。

### 7.3 可并行与不可并行

AI 可以并行处理边界明确且文件不重叠的任务，例如：

- 补服务端协议测试；
- 建立自定义剧本 fixture；
- 建立现有页面视觉截图；
- 整理独立的纯函数单元测试。

以下工作应串行：

- 根 `package.json`、lockfile 和 workspace 调整；
- Vue 3/Vite 启动链；
- Vuex 到 Pinia 的共享状态迁移；
- `socket.js` 拆分；
- 全局 CSS 入口和 Sass 变量迁移。

并行 AI 的结果合并后必须再次运行根级 `npm run check`，不能只依赖各自分支的局部测试。

### 7.4 AI 任务账本

建议维护 `doc/migration-status.md` 或机器可读的 `migration/tasks.yml`，至少记录：

- 任务 ID 和依赖；
- 当前状态；
- 基线 commit 和结果 commit；
- 修改范围；
- 验收命令与结果；
- 是否影响协议、存档、样式；
- 新增/删除的兼容层；
- 待解决风险。

只有自动验收全部通过，任务才能标记完成。AI 的文字判断不能替代测试结果。

## 8. 分阶段迁移

下面的“批次”是 AI 可执行的依赖序列，不是传统工期。

### 阶段 0：冻结行为基线

目标：在改变框架前，把当前行为变成可重复的测试证据。

任务：

1. 固定 Node Active LTS、npm 版本、`.nvmrc`/`.node-version` 和 `engines`；
2. 记录当前 build、bundle size、lint 和服务端测试基线；
3. 修复根 `index.html` 冲突标记，并明确 Vite 之后唯一 HTML 入口；
4. 确认许可证标识，统一 `package.json`、README 和 LICENSE 表述；
5. 为当前 Vue 2 页面建立 Playwright E2E 和视觉基线；
6. 扩展现有后端测试，将一个大测试拆成 HTTP、room、lobby、queue、security 套件；
7. 建立合法/非法自定义剧本、旧存档和 WS 消息 fixture；
8. 记录现有 localStorage keys、HTTP 接口和 WebSocket command 清单；
9. 建立 CI，但先按现有 warning 基线运行，禁止新增 warning。

退出条件：

- 现有关键用户流程可在无人工操作下重复执行；
- 现有协议和存档都有 fixture；
- 视觉基线可稳定复现；
- 主分支 build 和测试状态明确。

### 阶段 1：建立 workspace 与共享契约

目标：先建立边界，不改变运行行为。

任务：

1. 引入 npm workspaces；
2. 创建 `packages/contracts`、`packages/domain`、`packages/test-fixtures`；
3. 为角色、剧本、游戏状态、HTTP 和 WS v1 建 TypeScript 类型与 Zod schema；
4. 给旧 `socket.js` 增加轻量 encoder/decoder adapter；
5. 把剧本解析、夜间顺序、投票统计等纯逻辑移到 domain；
6. 对每个抽出的纯函数添加 characterization + table-driven tests。

过渡约束：

- 旧 JS 可调用编译后的共享包；
- 网络格式、存档格式和 UI 不变；
- 不在此阶段迁移 Vue 组件。

退出条件：

- shared packages 无浏览器/Vue/Express 依赖；
- 新旧消息 fixture 全部可解析；
- domain 核心逻辑达到高覆盖率门禁。

### 阶段 2：后端 TypeScript 化与模块拆分

目标：让服务端先成为有类型、可完整集成测试的稳定协议端。

建议批次：

1. 配置、启动与生命周期；
2. HTTP health/init；
3. 头像校验、处理和静态服务；
4. WebSocket upgrade、origin 和 ID 校验；
5. room registry 与 lobby；
6. direct/broadcast/pending feedback；
7. 限流、payload 上限和错误处理；
8. graceful shutdown、日志、健康检查。

实现要求：

- 使用 Express 5 + `ws`；
- app factory 与实际 listen 分离；
- 依赖通过参数注入，测试不依赖真实生产目录；
- server 不信任来自客户端的泛型参数；
- 对每个 command 做 schema 校验和权限检查；
- 生产入口编译为 JS artifact，但仓库源代码为 TS。

兼容矩阵：

- 旧前端 + 新后端必须通过；
- 新后端的 v1 消息必须与 fixture 字节语义等价；
- host 重连和旧客户端队列行为不得改变。

退出条件：

- `server` 无自有 `.js` 源文件；
- HTTP/WS 集成矩阵通过；
- 旧前端可以完整创建并完成一局核心流程。

### 阶段 3：Vite + Vue 3 兼容启动

目标：先换运行时与构建系统，尽量少改业务。

任务：

1. 创建 `apps/web` Vite 应用入口；
2. 将 `public/index.html` 内容迁到 Vite 根 `index.html`；
3. `VUE_APP_*` 改为 `VITE_*`，通过 typed env adapter 读取；
4. 改用 `createApp` 和 Vue 3 兼容的 Font Awesome；
5. 临时使用 `@vue/compat` 运行 Options API 组件；
6. 将 Vuex 3 升级到可运行于 Vue 3 的过渡版本；
7. 处理静态资源 URL、JSON import、Sass import 和 sitemap 构建；
8. 对比 Vue CLI 与 Vite 的 E2E 和截图结果；
9. 删除 Vue CLI 配置前，确认生产部署、base path 和 source map 策略。

退出条件：

- Vite dev/build 均通过；
- 旧功能 E2E 与视觉基线通过；
- 不再依赖 `vue-cli-service`；
- 所有 compat warning 有任务归属，不能匿名忽略。

### 阶段 4：前端 TypeScript 基础层

目标：先把高复用、低 UI 风险的代码转为严格 TS。

建议顺序：

1. env/config；
2. 数据加载与 schema；
3. utils；
4. localStorage repository 和版本迁移；
5. browser adapters：window size、visibility、keyboard、audio、timer；
6. HTTP client；
7. WebSocket transport、reconnect、queue；
8. protocol dispatcher。

`socket.js` 拆分建议：

```text
session/
├── transport/websocket-client.ts
├── transport/reconnect-policy.ts
├── protocol/dispatcher.ts
├── protocol/handlers/
│   ├── room.ts
│   ├── player.ts
│   ├── vote.ts
│   ├── chat.ts
│   ├── timer.ts
│   └── game-state.ts
└── services/live-session.ts
```

退出条件：

- 基础层 `strict: true`；
- 不允许 `any`，临时例外需带任务 ID 和删除批次；
- fake timers 下无悬挂 timer；
- 断线、重连、队列和协议测试通过。

### 阶段 5：Vuex 到 Pinia，按业务模块迁移

目标：把状态转换与副作用分开。

建议顺序：

1. lobby；
2. settings/modals；
3. scripts/roles；
4. players/game；
5. voting/timer；
6. chat；
7. session/live connection。

规则：

- store 只管理状态和可测试 action；
- localStorage、WebSocket、浏览器 API 通过 service/composable 注入；
- Promise resolver、timer handle、AudioContext、MediaStream 等非序列化对象不进入持久状态；
- 每迁移一个 store，就删除对应 Vuex state/mutation/action；
- 不创建一个与旧 Vuex 等大的“总 Pinia store”。

退出条件：

- 不再依赖 Vuex；
- Pinia store 可以在无 DOM、无真实网络情况下测试；
- state 结构有显式类型；
- 持久化兼容测试通过。

### 阶段 6：组件 Composition API 与拆分

目标：迁移全部 Vue 组件并降低单文件职责。

建议先叶子组件和简单弹窗，最后处理：

- `Menu.vue`；
- `Player.vue`；
- `TownSquare.vue`；
- `Vote.vue`；
- `App.vue`。

大组件按“行为域”拆分，不按模板行数机械拆分。例如 `Menu.vue` 可拆为房间、音频、游戏控制、设置、导入导出等控制区；复杂流程放进 composable/service。

规则：

- 所有新组件使用 `<script setup lang="ts">`；
- props、emits、template ref 全部有类型；
- `$refs` 跨组件命令改为显式事件或 composable；
- 重复 resize listener 改为共享 `useViewport`；
- 键盘快捷键集中管理并测试焦点/输入框边界；
- 组件拆分批次不同时调整视觉。

退出条件：

- 所有 SFC script 为 TypeScript；
- `@vue/compat` warning 清零并移除依赖；
- Vuex 风格的 `$store` 和跨组件隐式命令消失；
- 组件测试和视觉回归通过。

### 阶段 7：样式归档与资源治理

目标：在新 DOM 稳定后整理 CSS，而不是改变设计。

任务：

1. 将颜色、断点、z-index、阴影和尺寸抽为 token；
2. 区分 reset/base/global/component；
3. 将能安全局部化的选择器迁入 scoped 样式；
4. 清理重复媒体查询和重复 resize 逻辑；
5. Stylelint 建立 no-new-warning 门禁，再逐步清零；
6. 生成资源引用报告；
7. 对非首屏弹窗和资源做 lazy load；
8. 在视觉等价前提下设置 bundle budget。

退出条件：

- 全局样式都有明确归属；
- 无未说明的深层 selector 覆盖；
- 关键视口视觉回归通过；
- 首屏 JS/CSS 不高于迁移前基线，并有后续优化目标。

### 阶段 8：清理、部署与收尾

任务：

1. 删除 compat、allowJs、旧入口、旧 store、旧 adapter 和过期配置；
2. CI 增加“自有源代码中禁止 `.js`”检查；
3. 统一所有脚本、文档、环境变量示例和部署说明；
4. 生成 license/credits UI 和终端版本信息的自动测试；
5. 新旧客户端交叉兼容最终演练；
6. canary 部署新前端；
7. 观察客户端错误、WS 断开率、消息校验失败和上传失败；
8. 完成回滚演练后再切全量。

需要特别注意：房间存在服务端内存中，后端重启会中断进行中的房间。部署新后端时应选择低峰维护窗口，或先实现连接 drain/维护通知；不能把普通滚动重启视为无损部署。

最终退出条件：

- `npm run check` 全绿；
- 自有前后端运行时源代码均为 TS/Vue TS；
- Vue CLI、Vuex、`@vue/compat` 不在依赖树中；
- 现有存档和旧客户端兼容策略有明确期限；
- E2E、视觉、协议和覆盖率报告作为 CI artifact 保存；
- README 与部署文档反映真实架构。

## 9. 推荐的首批 AI 任务

以下顺序能最快建立安全网：

1. `MIG-001`：建立当前行为、接口、存档和 WS command 清单；
2. `MIG-002`：把后端单个集成测试拆成独立测试套件；
3. `MIG-003`：建立 Playwright，录制当前 Vue 2 核心流程和视觉基线；
4. `MIG-004`：为自定义剧本解析和游戏状态序列化添加 characterization tests；
5. `MIG-005`：统一许可证元数据，修复冲突标记；
6. `MIG-006`：创建 contracts 包和 WS v1 decoder/encoder；
7. `MIG-007`：创建 domain 包，迁移第一个纯逻辑模块；
8. `MIG-008`：将后端 config/app factory 迁为 TS；
9. 后续按阶段 2 的服务端拆分继续，不提前启动大组件重写。

每个任务都应产生一个可独立审查和回滚的提交。依赖升级与业务迁移不要混在同一个提交。

## 10. CI 与分支策略

建议使用短生命周期迁移分支，每个 AI 批次一个分支/提交，合并前要求：

```text
format:check
lint
typecheck
affected unit/component tests
server integration tests
protocol compatibility tests
build
affected E2E
visual diff artifact
```

依赖升级使用独立批次。lockfile 只能由负责当前依赖批次的 AI 修改，避免并行任务产生不可审查的 lockfile 冲突。

CI 至少使用：

- Active LTS Node；
- Chromium；
- Linux 固定字体与 locale；
- 固定时区；
- 确定性随机种子；
- 独立临时头像目录；
- 动态分配测试端口。

生产依赖使用精确 lockfile，通过自动依赖更新工具分批升级。文档中不长期写死“最新小版本”；实际实施每个阶段时选择当时稳定版本、记录版本和升级说明。

## 11. 风险与控制

| 风险 | 控制措施 |
| --- | --- |
| 新旧客户端协议不兼容 | 共享 fixture、v1 adapter、四向兼容矩阵 |
| localStorage 导致用户进度丢失 | versioned schema、先复制后迁移、失败不覆盖、fixture |
| Vue 3 响应式语义变化 | compat 阶段、store tests、逐模块迁移 |
| CSS scoped/DOM 改动造成视觉漂移 | 先截图、DOM 与 CSS 分批改、禁止自动更新基线 |
| socket 拆分改变消息顺序 | fake transport、消息序列 snapshot、真实 WS 集成 |
| 定时器/事件监听泄漏 | fake timers、mount/unmount 测试、统一 composable |
| AI 为通过检查放宽门禁 | 禁止 any/skip/阈值漂移，CI 配置需单独审查 |
| 图片优化破坏透明度或清晰度 | 独立阶段、像素对比、保留源文件 |
| 后端部署中断房间 | 维护窗口、drain/通知、回滚演练 |
| 法律署名在重构中丢失 | 自动检查 README、CLI version、UI Legal/Credits |

## 12. 完成定义

只有同时满足以下条件，迁移才算完成：

- 用户可见功能和样式与迁移前一致，明确记录的 bug 修复除外；
- Vue 3 + Vite + Pinia + strict TypeScript 已成为唯一前端实现；
- 后端为模块化 TypeScript，HTTP/WS 外部输入都有 schema；
- 自有运行时源文件无 `.js`；
- 旧存档、自定义剧本和 WS v1 兼容测试通过；
- 关键用户路径具备跨浏览器 E2E 与视觉回归；
- 自动测试与覆盖率门禁在 CI 中稳定通过；
- 没有 `@vue/compat`、`allowJs`、未归档旧 store 或匿名兼容代码；
- 部署和回滚流程经过演练；
- 许可证、来源和作者署名完整保留。

这份规划的核心不是让 AI 模仿人工逐文件翻译，而是先把隐式行为转换成类型、schema、fixture 和测试，再让 AI 在这些机器可验证的边界内快速重组代码。这样既能利用强 AI 的实现速度，也能避免“大改看起来完成、上线后才发现协议和样式悄悄变化”的风险。
