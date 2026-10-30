# 统一授权平台（ULP）接入说明

本项目已接入统一授权平台 License Format v1，**只验签、不签发**；私钥只存在于 ULP 服务端。

## 1. 产品信息

| 项 | 值 |
| --- | --- |
| product | `teable` |
| 公钥 | `apps/nestjs-backend/src/features/license/license.constants.ts` |
| 签名算法 | RSA-2048 / PKCS#1 v1.5 / SHA-256 |
| 授权文件 | `LICENSE_PATH`，默认 `./license.lic` |

## 2. 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `LICENSE_ENFORCE` | `true` | 是否强制校验；仅本地开发可设为 `false` |
| `LICENSE_PATH` | `./license.lic` | 授权文件路径，必须位于持久化卷 |
| `LICENSE_PUBLIC_KEY` | 内置公钥 | 覆盖公钥 PEM（可选） |
| `LICENSE_MACHINE_CODE` | 自动计算 | 容器场景显式固定机器码 |

时间回拨检查点固定为授权文件同目录的 `license-clock.dat`，同样必须持久化。

## 3. 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/license/status` | 授权状态（HTTP 200 + 统一 `code`） |
| GET | `/api/license/machine-code` | 本机机器码 |
| POST | `/api/license/upload` | 上传 `.lic`（字段名 `file`，≤1 MiB） |
| POST | `/api/license/reload` | 强制重新读取授权文件 |

业务接口在授权无效时返回 403（初始化失败为 503），响应体包含统一状态码；
`/api/license/*`、`/api/health`、`/api/auth/*`、`/api/user/*`、`/api/settings` 为恢复通路，
始终放行。SockJS 实时连接（`/sockjs`）在授权无效时会直接拒绝。

## 4. 运维步骤

1. 在 ULP 创建/选择 `teable` 项目并签发授权（通用授权机器码写 `*`；
   机器绑定授权先取 `/api/license/machine-code`）；
2. 将 `.lic` 放到 `LICENSE_PATH` 指向的位置（或调用上传接口）；
3. 页面会自动重新检测；也可 `POST /api/license/reload`。
