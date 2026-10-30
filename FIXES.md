# Teable 1.10.0 构建修复记录（相对原始源码快照）

原始快照路径：`/opt/teable-develop`（已完整复制为 `/opt/teable-develop-fixed`）
本文件列出为了让项目可完整构建/运行而做的全部改动，共 14 处（12 个新增文件 + 2 个修改文件），另附自定义构建文件 `Dockerfile.teable`。

## 1. packages/icons —— 补齐缺失图标组件（新增 2 个）

`src/index.ts` 导出了 `TableNew`、`TableAi`，但快照中缺少对应文件（原本由 Figma 脚本生成）。

| 文件 | 说明 |
|---|---|
| `packages/icons/src/components/TableNew.tsx` | 24×24 表格图标组件 |
| `packages/icons/src/components/TableAi.tsx` | 24×24 表格+AI 图标组件 |

## 2. packages/v2/core —— 模块改名兼容别名（新增 4 个）

`src/index.ts` 仍按旧名 `OnTable*` 导出，而实际文件名已改为 `OnTeable*`，导致 rolldown 解析失败。

| 新增别名文件 | 指向 |
|---|---|
| `packages/v2/core/src/domain/table/fields/OnTableFieldUpdated.ts` | `./OnTeableFieldUpdated` |
| `packages/v2/core/src/domain/table/OnTableFieldDeleted.ts` | `./OnTeableFieldDeleted` |
| `packages/v2/core/src/domain/table/OnTableTableDeleted.ts` | `./OnTeableTableDeleted` |
| `packages/v2/core/src/domain/table/views/OnTableViewFieldDeleted.ts` | `./OnTeableViewFieldDeleted` |

## 3. packages/openapi —— 补 DOM 类型（修改 1 个）

`src/axios.ts` 使用了 `window.location`，但 tsconfig 的 `lib` 只有 `esnext`，`tsc` 报 TS2304。

`packages/openapi/tsconfig.json`：`"lib": ["esnext"]` → `"lib": ["esnext", "dom"]`

## 4. apps/nextjs-app —— 补齐缺失组件（新增 5 个 + 修改 1 个）

Turbopack 构建报 `Module not found`，实际组件以 `Teable*` 命名，页面按 `Table*` 引入。

| 文件 | 说明 |
|---|---|
| `src/components/TableLogo.tsx` | 转导出 `./TeableLogo` |
| `src/features/auth/components/TableFooter.tsx` | 转导出 `./TeableFooter` |
| `src/features/app/components/setting/teable-skill/TableSkillContent.tsx` | 转导出同名组件 |
| `src/features/app/components/setting/teable-skill/TableSkillSection.tsx` | 转导出同名组件 |
| `src/features/app/blocks/setting/teable-skill/TableSkillPage.tsx` | 转导出同名组件 |

修改：`src/features/app/components/setting/teable-skill/index.ts` 保持导出 `TableSkillContent` / `TableSkillSection`。

## 5. Dockerfile.teable（新增）

自定义多阶段构建文件：基于 `node:24.19.0-bookworm` 安装依赖 → 构建 → 精简运行镜像。
内存受限时使用 `NODE_OPTIONS=--max-old-space-size=4096`、`OMP_NUM_THREADS=1`、`pnpm -r --workspace-concurrency=2`。

构建命令：

```bash
cd /opt/teable-develop-fixed
docker build -f Dockerfile.teable -t teable-standalone:1.10.0-offline .
```

## 备注：界面语言

界面语言由浏览器 Cookie `NEXT_LOCALE` 驱动（`en` / `zh` / `ja` / …），语言文件位于
`packages/common-i18n/src/locales/<lang>/*.json`，镜像中已包含全部 12 种语言。
若出现“选了中文仍显示英文”，多为运行期 i18n 缓存异常，重启应用容器即可恢复；
部署包内提供了 `fix-language.sh` 自检修复脚本。

## 6. 运行时离线加固：数据库迁移不再依赖 corepack（修改 2 个）

原始 `run-prisma-command.mjs` 通过 `spawnSync('pnpm', ['prisma', ...])` 调用 Prisma，
而镜像里的 `pnpm` 是 corepack 垫片，运行时会联网下载 pnpm 二进制。
在完全断网环境中，容器启动会卡在 `Downloading the pnpm 12.11.2 binary for linux-x64...`，
应用永远起不来。

修改文件（两处内容相同）：

- `packages/db-main-prisma/scripts/run-prisma-command.mjs`
- `packages/db-data-prisma/scripts/run-prisma-command.mjs`

改为优先直接执行工作区内的 `node_modules/.bin/prisma`（存在即使用），
仅在其缺失时回退到 `pnpm prisma`。

验证方式（无需数据库）：

```bash
docker run --rm --network none -w /app/packages/db-main-prisma \
  --entrypoint node teable-standalone:1.10.0-offline \
  ./scripts/run-prisma-command.mjs --version
# 输出 prisma 6.2.1 版本信息，且无任何下载动作
```

## 7. 部署配置加固（不属于源码，位于部署包内）

| 问题 | 处理 |
|---|---|
| 数据卷名随解压目录变化，换目录部署会“看起来丢数据” | 卷使用固定名 `teable-db` / `teable-data` / `teable-cache` |
| 授权文件写在容器内 `./license.lic`，容器重建即丢失 | 新增 `teable-license` 卷挂载到 `/app/.license`，并设置 `LICENSE_PATH=/app/.license/license.lic` |
| 重复执行部署脚本可能撞容器名 | `deploy.sh` 启动前按名清理容器与网络（数据卷保留） |
| 健康检查等待不足 | 后端就绪检测最长等待 120s，外层 180s |
