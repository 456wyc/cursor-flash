# Cursor state.vscdb Manager — Design Spec

**Date:** 2026-07-30  
**Status:** Ready for user review  

**Project:** `cursor-flash` (working title)

## Problem

Cursor 的 `state.vscdb`（典型路径 `%APPDATA%\Cursor\User\globalStorage\state.vscdb`）会膨胀到数十 GB，占满系统盘。实测本机约 **21.15 GB**，主要来自 `cursorDiskKV`（约 138 万行），其中 `bubbleId:`（聊天气泡）估算约 **10.5 GB**，`agentKv:` 约 **0.9 GB**。

用户需要：**查看占用结构，并按类型 / 会话 / 时间选择性清理，且在 C 盘已满时仍能真正回收磁盘空间。**

## Goals

1. 可视化（及 CLI）查看 `state.vscdb` 占用构成  
2. 按 **数据类型 ∩ 会话 ∩ 时间** 选择性清理  
3. 安全可控：可配置安全档；默认写入前关闭 Cursor、预览确认  
4. 真正腾空间：默认 **跨盘重建新库**；可选就地 `VACUUM`  
5. 架构可扩展：Core 共用；Web + 最小 CLI；日后可包 Desktop  

## Non-Goals (v1)

- 不修改 Cursor 程序本身，不做官方插件注入  
- 不保证清理后 Cursor UI 历史「完美还原」——清理聊天/会话即接受历史不可用  
- 不做自动 undo（回滚依赖用户备份）  
- 默认不清理 `ItemTable`（设置/实验配置等）  
- v1 不交付独立 Desktop 安装包（预留 WebView 外壳接口即可）  

## Architecture

```
React Web (Vite)  +  CLI (Typer)  [日后 Desktop = WebView 壳]
        │                  │
        └────────┬─────────┘
                 ▼
     Service layer (FastAPI handlers / CLI commands)
                 ▼
                    Core
   ┌─────────────┼─────────────┐
   Mode1 Index   Mode2 Live    Mode3 Export
   (扫描建索引)   (在线只读)     (导出分析包)
                 │
          FilterEngine (类型 ∩ 会话 ∩ 时间)
                 │
   Safety → Backup → Reclaim(执行清理并腾空间) → Verify
                 │
            state.vscdb
```

**主路径说明：** C 盘已满时，**不在原库就地 DELETE+VACUUM**。默认走跨盘 **filter-copy rebuild**：按 Filter 把「保留行」写入目标盘新库，校验后替换；删除效果与腾空间一次完成。仅当空闲空间足够时，才提供「就地 DELETE + VACUUM」作为可选路径。

### Components

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `core.db` | 定位库路径、只读/写入连接、进程占用检测 | OS / sqlite3 |
| `core.catalog` | key 前缀分类、风险分级、与 composer 关联规则 | — |
| `core.analyze.mode1` | 全量/增量扫描，写入本地索引库（仅元数据） | db, catalog |
| `core.analyze.mode2` | 无索引在线查询（抽样、单 key、小结果集） | db, catalog |
| `core.analyze.mode3` | 导出分析包（JSON/SQLite report）到指定盘 | mode1 或扫描流 |
| `core.filter` | 统一过滤条件 → 匹配 key 集合 / 预估字节 | catalog, index |
| `core.safety` | 安全档、Cursor 进程检测、确认门槛 | db |
| `core.backup` | 备份到指定路径（可跨盘） | — |
| `core.clean` | 就地 DELETE（可选路径）；可选级联 `composerHeaders` | filter, safety |
| `core.reclaim` | 默认跨盘 filter-copy 重建；可选就地 VACUUM；校验与替换 | filter, safety, backup |
| `api` | FastAPI：扫描、查询、预览、执行、进度 | core.* |
| `cli` | Typer 最小命令集 | core.* / service |
| `web` | React 仪表盘 | api |

## Data Model

### Source DB tables

- `cursorDiskKV(key, value)` — 体积主力  
- `composerHeaders(composerId, workspaceId, createdAt, lastUpdatedAt, …, value)` — 会话元数据  
- `ItemTable(key, value)` — **v1 默认只读展示，不进清理目标**  

### Cleanable categories (`cursorDiskKV` key prefixes)

| Prefix | Meaning | Risk |
|--------|---------|------|
| `bubbleId:` | 聊天气泡 | 高（历史内容） |
| `agentKv:` | Agent blob 缓存 | 较低 |
| `composer.content.` | Composer 内容块 | 中 |
| `checkpointId:` | 检查点 | 中 |
| `composerData:` | 会话主体 | 高 |
| `ofsContent:` / `inlineDiff:` / `codeBlock*` / `messageRequestContext:` 等 | 快照/diff/上下文 | 中低 |

未知前缀归入 `other`，默认可查看、清理时需显式勾选。

### Filter model

```text
Filter = {
  categories: string[],      # 前缀类别
  composer_ids: string[],    # 空 = 不限
  older_than: datetime|null,
  newer_than: datetime|null,
  cascade_headers: bool      # 是否同时删 composerHeaders
}
```

时间优先取 `composerHeaders.lastUpdatedAt` / `createdAt`；KV 行无可靠时间时，随所属 composer 或归入「未知时间」桶（清理未知时间需显式允许）。

### Mode1 index (local, configurable path; recommend non-C)

存元数据，**不存 value 正文**：

- key, prefix/category, composer_id (parsed), size_bytes, optional timestamp  
- 聚合表：by_category、by_composer  
- 索引与源库 mtime/size 校验；源库变化则标记 stale 并提示重扫  

## Analysis Modes

1. **Mode1 Index（默认）**：扫描建索引 → UI/CLI 秒开聚合与筛选  
2. **Mode2 Live**：不建索引，直接只读查询（抽样、状态、小范围 list）  
3. **Mode3 Export**：将聚合/明细导出到其他盘；可基于 Mode1 索引或扫描流生成；勾选结果可再交给 `clean`  

三种模式共用 `FilterEngine` 与清理执行引擎。

## Safety & Space Reclaim

### Safety levels (configurable; default **B**)

| Level | Behavior |
|-------|----------|
| **A Strong** | 必须关闭 Cursor；强制备份；强制预览确认 |
| **B Medium (default)** | 只读可热看；写入前必须关 Cursor；备份可选但 UI 强提示 |
| **C Aggressive** | 允许尝试热写（明确高风险警告；默认不启用） |

写入路径一律：`SafetyGate → 预览（行数/估算字节）→ 二次确认 → 执行`。

### Reclaim strategies

- **Cross-disk filter-copy rebuild（默认）**：在目标盘创建新库，复制 **未匹配 Filter 的保留行**（及未纳入清理的表，如默认保留的 `ItemTable`）→ 校验行数/抽样 → Cursor 关闭下原子替换（原库改名为 `state.vscdb.pre-rebuild-<timestamp>`，再移入新库）。不要求 C 盘先有大块空闲空间。  
- **In-place DELETE + VACUUM（可选）**：仅当安全门与磁盘空闲检查通过时可用；空闲不足则拒绝并引导跨盘重建。  

中断/失败：**永不覆盖原库**；保留临时新库与操作日志。

### Backup

- 支持完整文件复制到指定目录（可跨盘）  
- 操作日志记录：过滤条件、删除计数、备份路径、重建路径、时间戳  

## UI (React)

导航：

1. **总览** — 库路径、文件大小、索引状态、Cursor 进程状态、安全档、类别占用卡片  
2. **按类型** — 类别勾选与估算  
3. **按会话** — 会话列表（标题/工作区/大小/时间）勾选  
4. **按时间** — 时间范围 + 与类型/会话组合  
5. **清理预览** — 将删摘要 → Apply（走安全门）  
6. **设置/安全** — 安全档、库路径、索引路径、备份默认目录、重建目标盘  
7. **导出分析包** — Mode3  

进度与长任务（扫描/重建）通过 **job id + 轮询** `GET /jobs/{id}` 展示（v1 不做 SSE）。

## CLI (minimal)

```text
vscdb status
vscdb scan [--index-dir PATH]
vscdb list categories|composers [--filter ...]
vscdb export-report --out PATH
vscdb clean --preview --categories ... --older-than ...
vscdb clean --apply  ...   # 受安全档约束
vscdb rebuild --target PATH
vscdb vacuum
```

## API (sketch)

- `GET /status`  
- `POST /scan` → job  
- `GET /stats/categories` / `GET /stats/composers`  
- `POST /export`  
- `POST /clean/preview` / `POST /clean/apply`  
- `POST /reclaim/rebuild` / `POST /reclaim/vacuum`  
- `GET /jobs/{id}`  

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Cursor running on write | Block (unless level C + explicit override) |
| DB locked | Block write; explain |
| Insufficient space for VACUUM | Refuse; suggest cross-disk rebuild |
| Rebuild interrupted | Keep temp DB + log; leave original intact |
| Replace failed | Rollback rename if needed; original preserved |
| Stale index | Warn; allow Mode2 or force rescan |

## Tech Stack

- **Python 3.11+**：Core、FastAPI、Typer、sqlite3  
- **React + Vite**：Web UI  
- **平台**：v1 以 **Windows** 为第一目标（路径/进程检测按 Win 实现）；路径解析预留可扩展  
- **索引/配置**：默认放在可配置目录（建议非系统盘，如 `E:\cursor-vscdb-tool\`）  
- 日后 Desktop：`pywebview` / Tauri 壳嵌入同一 Web，不重写 Core 

## Testing Strategy

- 单元：前缀解析、Filter 组合、安全门判定、空间检查逻辑（假文件系统/假进程）  
- 集成：用小型合成 `state.vscdb` fixture（含多前缀与 headers）跑 scan → preview → clean → rebuild  
- 手动：对本机只读 scan/status；写入测试仅在备份副本上执行  
- 禁止在未备份的生产库上跑破坏性自动化  

## Project Layout (proposed)

```text
cursor-flash/
  docs/superpowers/specs/
  src/cursor_vscdb/     # Core + FastAPI + Typer 入口
  web/                  # React + Vite
  tests/
  README.md
```

Core 以纯 Python 包形式供 API/CLI import，避免两套逻辑。

## Success Criteria

1. Mode1 全量扫描约 140 万行级库时，目标在约 **10 分钟内**完成并展示类别/会话占用（量级与抽样估算一致；机器差异允许浮动）
2. 能按类型、会话、时间组合预览将删行数与估算字节  
3. 在 Cursor 关闭且备份后，能完成清理 + 跨盘重建，且 C 盘上原库体积显著下降  
4. CLI `status` / `scan` / `clean --preview` 可用  
5. 失败路径不损坏原库  

## Open Decisions (resolved in brainstorming)

- 形态：Core + Web + 最小 CLI（日后 Desktop）  
- 清理粒度：类型 + 会话 + 时间全支持  
- 安全：可配置，默认 B  
- 栈：Python + FastAPI + React  
- 空间回收：默认跨盘 filter-copy 重建 + 可选就地 DELETE/VACUUM  
- 分析：Mode1/2/3 均支持，默认 Mode1  
- 平台：Windows first；长任务用 job 轮询  
