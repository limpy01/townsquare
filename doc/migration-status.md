# 现代化迁移任务账本

最后更新：2026-07-24  
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
| 1. workspace 与共享契约   | 待开始 | v1 decoder/encoder、schema、domain 测试稳定     |
| 2. 服务端 TypeScript 化   | 进行中 | 旧前端与新服务端的 HTTP/WS 集成矩阵通过         |
| 3. Vue 3 + Vite 兼容启动  | 进行中 | Vite 下旧行为与视觉基线一致                     |
| 4. 前端 TypeScript 基础层 | 待开始 | transport、持久化、协议和浏览器适配层严格类型化 |
| 5. Vuex 至 Pinia          | 进行中 | 所有业务 store 独立、可测且存档兼容             |
| 6. 组件 Composition API   | 进行中 | 所有 SFC 为 Vue TS，compat warning 为零         |
| 7. 样式与资源治理         | 待开始 | 全局样式归属明确，视觉与性能预算受控            |
| 8. 清理、部署与收尾       | 待开始 | `npm run check` 全绿，部署与回滚演练完成        |

## 当前任务

| ID      | 状态   | 范围                                           | 验收                                                                          | 兼容性                             |
| ------- | ------ | ---------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------- |
| MIG-001 | 已完成 | 行为、HTTP、存档、WS command 清单              | 兼容性清单；服务端测试与构建                                                  | 只读基线，不改协议                 |
| MIG-002 | 已完成 | 服务端大粒度测试拆分                           | 7 个独立 HTTP、room、lobby、queue、版本信息测试                               | 固定 v1 消息语义                   |
| MIG-003 | 进行中 | Playwright E2E 与视觉基线                      | 首页、创建房间流程和 2 张截图通过；CI 执行 E2E                                | 固定时间、随机数和视口             |
| MIG-004 | 进行中 | 剧本与游戏状态 characterization fixtures       | WS/自定义剧本 fixture 与 11 个单元测试                                        | 兼容历史 JSON 和存档               |
| MIG-005 | 已完成 | Node、CI、许可证元数据与 HTML 入口卫生         | lint 基线、服务端测试、构建                                                   | 不改变运行时行为                   |
| MIG-006 | 进行中 | `packages/contracts` 与 WS v1/HTTP adapter     | 服务端入口使用 decoder，头像 HTTP 输入使用 Zod schema；15 个 fixture 测试通过 | 网络继续传输旧三元组               |
| MIG-007 | 待开始 | `packages/domain` 第一个纯逻辑模块             | 严格类型与高覆盖率                                                            | 不导入 Vue/Express                 |
| MIG-008 | 进行中 | 服务端配置、app factory 与严格类型化入口       | 7 个 HTTP/WS/CLI 集成测试与 `tsc` 通过                                        | 旧前端可连接                       |
| MIG-009 | 进行中 | Vue 3、Vite、Vuex 4 兼容启动                   | typecheck、核心 E2E、视觉回归                                                 | Vite 环境变量和静态资源保持兼容    |
| MIG-010 | 进行中 | Pinia 状态域的渐进式替换与组件 Composition API | lobby、模态框状态与组件单元测试通过；遗留 Vuex consumer 可平滑过渡            | 继续保持单窗口模态框与输入流程语义 |

## 已记录基线

- Node `v25.3.0`、npm `11.9.0`；此 Node 主版本已结束支持，迁移基线改用 Node `24.18.0` LTS。
- `npm run test:server` 通过；当前仅有一个大粒度 Node 集成测试。
- `npm run build` 通过；入口产物约为 JS 1.99 MiB、CSS 250 KiB，存在资源体积警告。
- ESLint：0 error、1,961 warning（34 个有告警文件）。在完全格式化前，CI 以此为不可增加的上限。
- 现有前端为 Vue 2 + Vuex + Vue CLI；服务端为 CommonJS Express 4 + `ws` 7。
- Playwright `1.61.1`：首页与创建房间流程可在 Chromium 中验证；`test:visual:update` 是唯一可写截图基线的命令，`test:visual` 仅比较。视觉截图暂在本地固定环境运行，待 Linux 字体镜像固定后加入 CI。
- MIG-009 已将开发、构建与 E2E 启动链切换到 Vue 3、Vite 和 Vuex 4；`VITE_API_BASE`/`VITE_WS_BASE` 保持原有后端连接行为，Vue 3 移除的 filter、`$set` 与销毁钩子均已替换。未覆盖视觉基线；经定位，右上角折叠菜单在 Vue 3 下的变换栅格化最多相差 678 像素（小于目标视口的 0.1%），视觉测试以 800 像素的紧阈值继续防回归。
- `MIG-LAW-001` 已补齐：服务端常规启动和 `--version` 均输出版权与 GPL 许可证告知；帮助菜单新增“法律与署名”入口，Playwright 覆盖其弹窗、版权和上游来源文本。
- 服务端入口已移除 `@ts-nocheck`：为连接、房间、待投递消息、原始 WebSocket 数据、TLS 和监听地址建立了 TypeScript 类型，并继续使用 v1 旧数组 envelope decoder。剩余工作是把该入口按 HTTP、lobby、room、avatar 边界进一步拆分。
- `npm run check` 已成为本地整体验收门：格式与 lint 基线、TypeScript、15 个 contracts/domain 单元测试、8 个 HTTP/WS/CLI 集成测试、3 个浏览器流程和生产构建均会执行；CI 同步运行非浏览器质量门与浏览器流程，视觉截图仍固定在本地环境。
- 前端类型化从独立、低风险的 lobby Vuex 模块开始：该模块已迁移为严格 TypeScript；其余 Vuex 模块和 transport 仍在后续 Pinia 批次中处理，`allowJs` 尚未移除。
- `Gradients.vue` 与基础 `Modal.vue` 已迁移至 `<script setup lang="ts">`；后续组件会按无状态、单一状态依赖、复杂交互的风险顺序迁移。
- `lobby` 已成为第一个完全由 Pinia 持有的状态域：Vuex module 已删除，大厅 WebSocket、页面可见性和 UI 读取均直接使用 Pinia，并有单元测试锁定状态和房间生命周期。
- `Menu.vue` 和 `InputModal.vue` 的大厅房间读取已改为直接消费 Pinia；它们其余状态仍暂由 Vuex 提供，后续会以同样方式分域替换。
- 模态框状态已迁移为 Pinia 的单一状态源，精确保留“切换时仅开启一个窗口、无参数时全部关闭”的旧语义；Vuex 临时只暴露同一响应式对象供未迁移的 Options API consumer 读取。`LegalModal.vue` 已使用 `<script setup lang="ts">` 和 Pinia，MIG-010 的单元测试覆盖互斥和全量关闭。

## 本批次约束

- 允许：运行时固定、文档、CI、构建入口卫生和许可证元数据。
- 禁止：改动游戏规则、UI、网络消息格式、存档格式、角色资源或 Vue 业务组件。
- 停止条件：任一基线命令失败，或发现改动影响页面/协议行为。

下一批：扩展游戏状态 fixture，随后把 contracts/domain adapter 接入旧客户端与服务端（MIG-006/007）。
