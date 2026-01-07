# Whale Vault DApp / NFT 金库收银台

Whale Vault 是一个围绕 **实体书 Secret Code** 的 NFT 金库与收银台 DApp，面向读者、作者和出版社三方：

- 读者：通过扫码 + 铸造 NFT 解锁 Arweave 正文、Matrix 私域社群等数字权益
- 作者 / 出版社：在管理后台查看销量、财务数据，一键提现和批量导入授权
- 平台方：运行 Go 中间层为用户提供 **免 Gas 元交易**，并做风控与统计

本仓库包含：

- 前端：React + Vite + Tailwind CSS 单页应用
- 钱包与链交互：Polkadot{.js} 扩展 + `@polkadot/api` / `@polkadot/api-contract`
- 后端：Go 实现的元交易 Relay Server + Redis 统计

---

## 1. 功能总览

### 1.1 收银台（读者侧）

完整用户流：**扫码 → 支付 / 免 Gas Mint → 成功页 → 解锁内容 / 继续扫码**。

- 扫码页 `/scan`
  - 调用摄像头扫描实体书上的 Secret Code（二维码）
  - 使用 `@yudiel/react-qr-scanner` 适配移动端摄像头
  - 扫描成功后自动跳转到 `/mint-confirm?code=...`

- 支付 Mint 页 `/mint-confirm`
  - 展示当前 Secret Code
  - 两种铸造方式：
    - 普通铸造：调用 Polkadot{.js} 钱包，直接向 Jessie 的 Ink! 合约发送 `mint(code)` 交易
    - 免 Gas 铸造：前端只做 **签名授权**，交易由后台代付 Gas（元交易）
  - 支持加载状态：发送中 / 区块确认中 / 错误提示
  - 铸造成功后**自动跳转**到成功页 `/success`

- 成功展示页 `/success`
  - 展示一个 NFT 勋章占位图和简洁的祝贺文案
  - 展示当前钱包地址与 `book_id`
  - 点击「验证访问权限」调用合约只读方法 `has_access(address, book_id)`
  - 验证通过后展示：
    - Arweave 资源链接：`https://arweave.net/{TX_ID}`
    - Matrix 私域社群入口
  - 提供「继续扫码下一本」按钮，跳回 `/scan`

### 1.2 管理后台（作者 / 出版社）

管理后台挂在 `/admin` 路由下，采用侧边栏布局，包含：

- 数据总览 `/admin/overview`
  - 卡片展示：
    - 累计销售额
    - 已 Mint 数量
    - 当前可提现余额
  - 使用 Mock 数据 + 可选链上统计进行组合展示

- 销量监控看板 `/admin/monitor`
  - 数据卡片：总销售额、已铸造 NFT 数量、待提现余额
  - 趋势图表：使用 Recharts 绘制近 30 天销售增长曲线
  - 明细表：展示最近 Mint 记录（时间、book_id、用户地址缩略、状态）
  - 可从后端 `/metrics/mint` 或合约只读方法拉取统计，并与 Mock 数据叠加

- 销量明细 `/admin/sales`
  - 表格列出每笔 Mint 记录
  - 包含时间戳、book_id、交易哈希等
  - 目前以 Mock 数据为主，可平滑切换到真实后端

- 财务提现 `/admin/withdraw`
  - 展示当前账户在合约中的「可提取余额」
  - 点击「立即提现」时：
    - 调用 Polkadot{.js} 钱包，签名执行合约 `pull_funds()`
    - 显示发送与区块确认状态
    - 提现成功后触发前端 Confetti（纸屑特效）
    - 自动刷新可提余额

- 批次创建 `/admin/batch`
  - 支持导入 CSV 文件批量配置授权：
    - 每行结构：`book_id, secret_code`
  - 前端自动对 Secret Code 计算 SHA-256 哈希（使用浏览器 `crypto.subtle.digest`）
  - 组装参数并调用合约 `add_book_batch(ids, hashes)`，实现一次性写入链上

---

## 2. 技术栈与架构

### 2.1 前端

- React 18
- Vite
- React Router v7（`react-router-dom`）
- Tailwind CSS
- Polkadot 相关：
  - `@polkadot/api`
  - `@polkadot/api-contract`
  - `@polkadot/extension-dapp`
- 扫码：`@yudiel/react-qr-scanner`
- 图表：`recharts`
- 特效：`canvas-confetti`

主要结构：

- `src/App.tsx`：路由入口
  - `/` 首页（入口卡片 + 简要销量看板）
  - `/scan` 扫码页
  - `/mint-confirm` 支付 / 元交易确认页
  - `/success` 成功 + 解锁内容页
  - `/settings` 链配置页
  - `/admin/*` 管理后台布局与子路由

- 钱包相关
  - `src/hooks/usePolkadotWallet.ts`：统一封装 Polkadot{.js} 扩展连接与账户选择
  - `src/components/NavBar.tsx`：连接 / 断开钱包按钮 + 账户选择器

- 链配置
  - `src/state/useChainConfig.ts`:
    - `endpoint`：节点 WebSocket 地址（默认 `wss://ws.azero.dev`）
    - `contractAddress`：Ink! 合约地址
    - `abiUrl`：ABI JSON 文件 URL
    - 持久化到 `localStorage.chainConfig`

- 后端地址配置
  - `src/config/backend.ts`:
    - `export const BACKEND_URL = 'http://localhost:8080'`
    - 用于元交易中间层和监控接口

### 2.2 后端（Middle-layer / Relay Server）

位置：`backend/main.go`

职责：

- 接收前端生成的合约调用数据（`Contracts.call`）
- 使用平台账户（`RELAYER_SEED`）代用户发送交易，支付 Gas
- 对同一 IP 做频率限制和封禁
- 记录成功的 Mint 日志到 Redis，用于前端看板

依赖：

- `github.com/centrifuge/go-substrate-rpc-client/v4`
- `github.com/gorilla/mux`
- `golang.org/x/time/rate`
- `github.com/redis/go-redis/v9`

---

## 3. 安装与运行

### 3.1 前端 DApp

#### 安装依赖

```bash
npm install
```

#### 开发模式

```bash
npm run dev
```

默认通过 Vite 启动开发服务器（通常是 `http://localhost:5173`）。

#### 打包构建

```bash
npm run build
```

产物输出到 `dist/` 目录，可使用任意静态服务器托管。

### 3.2 后端 Relay Server

#### 前置依赖

- Go 1.20+
- Redis 实例（本地或远程）

#### 环境变量

- `WS_ENDPOINT`（可选）
  - Substrate / Aleph Zero / Astar 等链的 WebSocket 节点
  - 默认：`wss://ws.azero.dev`

- `RELAYER_SEED`（必需）
  - 平台方代付 Gas 的账户种子（sr25519）
  - 用于在链上签名并发送 `Contracts.call`

- `REDIS_ADDR`（可选）
  - Redis 地址，默认 `127.0.0.1:6379`

#### 启动后端

```bash
cd backend
go run main.go
```

默认监听：`http://localhost:8080`

同时应用了宽松的 CORS 设置，方便前端本地调试。

---

## 4. 前端主要页面说明

### 4.1 首页 `/`

- 文件：`src/pages/Home.tsx`
- 功能：
  - 左侧卡片：项目简介 + 「扫描 Secret Code」按钮（跳转 `/scan`）
  - 右侧卡片：可扩展的销量展示组件（`SalesBoard`）

### 4.2 扫码页 `/scan`

- 文件：`src/pages/Scan.tsx`
- 功能：
  - 调用摄像头扫描二维码
  - 从扫码结果提取 `rawValue` 作为 Secret Code
  - 成功后跳转：`/mint-confirm?code={encodedCode}`

### 4.3 Mint 确认页 `/mint-confirm`

- 文件：`src/pages/MintConfirm.tsx`
- 功能：
  - 展示从 URL 中解析的 `code` 与可选参数 `book_id`、`ar`
  - 按钮：
    - 「确认 Mint」：直接使用扩展钱包发起 `mint(code)`
    - 「免 Gas 铸造」：走元交易流程 `mint_meta`
  - 状态展示：发送中 / 区块确认中 / 错误提示
  - 成功后自动跳转至 `/success?book_id=...&ar=...`

### 4.4 成功展示页 `/success`

- 文件：`src/pages/Success.tsx`
- 功能：
  - 展示 NFT 勋章占位图与成功文案
  - 从 URL 中读取：
    - `book_id`：书籍编号
    - `ar`：Arweave 交易 ID
  - 读取当前钱包地址（优先使用 `localStorage.selectedAddress`）
  - 按钮：
    - 「验证访问权限」：调用合约 `has_access(address, book_id)`
    - 验证通过后：
      - 显示「打开 Arweave 内容」按钮（新窗口）
      - 显示「进入 Matrix 私域社群」入口
    - 验证失败时给出错误提示
  - 「继续扫码下一本」：`<Link to="/scan">`，引导用户进入下一次收银流程

### 4.5 管理后台

- 布局：
  - `src/admin/AdminLayout.tsx`：侧边栏 + 嵌套路由结构

- 子页面：
  - `src/admin/OverviewPage.tsx`：数据总览
  - `src/admin/MonitorPage.tsx`：销量监控看板（图表 + 明细）
  - `src/admin/SalesPage.tsx`：销量明细列表
  - `src/admin/WithdrawPage.tsx`：财务提现
  - `src/admin/BatchPage.tsx`：批次创建（CSV 导入 + SHA-256 + add_book_batch）

---

## 5. 钱包与链配置

### 5.1 链参数配置

- 页面：`/settings`
- Hook：`useChainConfig`（`src/state/useChainConfig.ts`）
- 字段：
  - `endpoint`：节点 WebSocket 地址
  - `contractAddress`：Ink! 合约地址
  - `abiUrl`：ABI JSON 文件地址
- 配置保存到 `localStorage.chainConfig`，前端所有合约调用均依赖此配置。

### 5.2 钱包连接与账户选择

- Hook：`usePolkadotWallet`（`src/hooks/usePolkadotWallet.ts`）
- 功能：
  - 调用 `web3Enable('Whale Vault DApp')` 与 `web3Accounts()` 拉取扩展账户
  - 管理 `accounts` 列表与当前选中账户 `selected`
  - 支持切换账户与断开连接
  - 将选中的地址持久化到 `localStorage.selectedAddress`
  - 提供 `isConnected` 等布尔状态

导航栏组件 `NavBar` 通过该 Hook 实现：

- 「连接钱包」按钮：触发扩展授权
- 「断开」按钮：清空选择
- `AccountSelector`：展示并切换当前账户

---

## 6. 后端 HTTP 接口说明

### 6.1 POST `/relay/mint`

用途：元交易转发。前端构造好 `Contracts.call` 的编码数据，由后端使用平台账户代签名和发送。

#### 请求体（JSON）

```json
{
  "dest": "合约地址（SS58）",
  "value": "0",
  "gasLimit": "估算得到的 gas（字符串）",
  "storageDepositLimit": "可选，存储押金上限（字符串或 null）",
  "dataHex": "0x 前缀的 call 数据十六进制字符串",
  "signer": "用户地址（用于风控和日志）"
}
```

> 实际上 `gasLimit` 和 `storageDepositLimit` 会在链端再次计算，但前端会先用合约 `query` 估算一遍。

#### URL 查询参数

- `book_id`（可选）：书籍编号，用于日志记录与前端看板展示。

#### 响应体（JSON）

```json
{
  "status": "submitted" | "error",
  "txHash": "0x... 可选",
  "error": "错误信息，可选"
}
```

- `status = "submitted"`：成功提交到链上，`txHash` 为交易哈希（in-block 或 finalized 哈希）。
- `status = "error"`：请求不合法、频率超限或链上错误。

#### 风控机制

- 使用 `golang.org/x/time/rate` 为每个 IP 限速
- 使用 Redis 记录失败次数：
  - 同一 IP 在一定时间内连续 3 次失败 → 写入 `ban:ip` key，封禁 1 小时
- 所有成功的 Mint 请求会记录到 Redis 列表 `mint:logs`

### 6.2 GET `/metrics/mint`

用途：为前端管理后台提供 Mint 日志，用于构建销量图表和明细。

#### 响应样例

```json
[
  {
    "timestamp": 1710000000,
    "tx_hash": "0x1234...",
    "book_id": "1"
  },
  ...
]
```

前端可按时间排序、按 `book_id` 分组统计等。

---

## 7. 与合约的主要交互点

> 以下为前端使用到的合约接口名称，具体参数类型与链上实现需与实际 Ink! 合约保持一致。

- `mint(code: String)`
  - 用户自费 Gas 的铸造函数

- `mint_meta(signer, code, signature, nonce, deadline)`
  - 元交易版铸造函数
  - 前端对约定格式的消息签名，后端代付 Gas

- `has_access(address, book_id) -> bool`
  - 成功页中用于验证用户是否拥有访问该书籍内容的权限

- `pull_funds()`
  - 管理后台财务页调用
  - 将作者 / 出版社地址在合约中的可提现余额转出到当前账户

- `add_book_batch(ids: Vec<BookId>, hashes: Vec<Hash>)`
  - 批次创建页调用
  - 一次性写入多本书籍的授权哈希

- `get_withdrawable(address) -> Balance`（假定名称）
  - 用于查询某地址当前可提取余额
  - 前端在提现页只读调用，展示「当前地址可提取余额」

---

## 8. 典型使用流程（读者视角）

1. 打开 DApp，点击首页「扫描 Secret Code」进入 `/scan`
2. 授权浏览器使用摄像头，扫描实体书封底的二维码
3. 扫描成功 → 自动跳转到 `/mint-confirm?code=...`
4. 选择：
   - 普通「确认 Mint」：弹出 Polkadot{.js} 扩展确认交易，用户自付 Gas
   - 「免 Gas 铸造」：仅签名授权消息，由平台账户代付 Gas
5. 交易成功 → 自动跳转 `/success?book_id=...&ar=...`
6. 在成功页点击「验证访问权限」，通过后：
   - 打开 Arweave 正文内容
   - 加入 Matrix 私域社群
7. 如果有下一本书，点击「继续扫码下一本」再次进入 `/scan`

---

## 9. 典型使用流程（作者 / 出版社视角）

1. 打开 DApp，连接钱包，使用作者 / 出版社账户登录
2. 进入管理后台 `/admin/overview` 查看数据总览
3. 在 `/admin/monitor` 看板中观察近 30 天销量趋势与最新 Mint 明细
4. 在 `/admin/batch` 导入 CSV 文件，批量配置书籍授权：
   - `book_id,secret_code` → 前端计算 SHA-256 哈希 → 调用 `add_book_batch`
5. 在 `/admin/withdraw` 查看可提取余额，并点击「立即提现」调用 `pull_funds()` 将收益转入当前地址

---

## 10. 后续可扩展方向

本 README 基于当前实现状态总结，后续可以在此基础上扩展：

- 将 Mock 数据完全替换为真实链上统计与后端 `/metrics/mint`
- 为作者 / 出版社增加多角色权限控制
- 增加多链配置与热切换（例如在配置中支持多个预设网络）
- 为合约与后端接口补充单元测试与集成测试

