# Cursor Flash

[English](README.md) | **中文**

检查并选择性清理 Cursor 的 `state.vscdb`——存放聊天气泡、Agent 缓存、Composer 会话等全局状态的 SQLite 数据库。该文件膨胀到几十 GB 时会占满系统盘；本工具帮你**看清空间占用**，并通过筛选复制重建**安全回收磁盘空间**。

## 功能

- **检查** — 扫描 `state.vscdb`，生成本地元数据索引（键前缀、Composer ID、大小），不复制 value 内容。
- **分析** — 按类型、会话、时间范围查看占用；可导出报告。
- **预览** — 写入前估算匹配的行数与字节数。
- **清理 / 回收** — 将*保留*的行复制到新库（C: 盘满时的默认策略，建议写到其他盘），校验后再可选替换原库。

Web UI（React）与 CLI（`cursor-flash`）共用同一套 Python 核心与 FastAPI 服务。

## 默认路径

| 资源 | 默认位置 |
|------|----------|
| Cursor 在用数据库 | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| 工具目录（索引 + 备份） | 存在 `E:` 时为 `E:\cursor-flash\` |
| 工具目录（回退） | `%LOCALAPPDATA%\cursor-flash\`（或用户主目录） |
| 索引库 | `<工具目录>\index.sqlite` |
| 备份 | `<工具目录>\backups\` |

可通过 CLI 参数（`--db`、`--index`、`--backup-dir`）或 API / 应用上下文覆盖路径。

## 安全档位

写入前的可配置安全闸门（默认 **B**）：

| 档位 | 名称 | 行为 |
|------|------|------|
| **A** | 强 | 必须关闭 Cursor；写入前**必须备份**；建议先预览 |
| **B** | 中 *(默认)* | Cursor 运行时可只读；**写入需先关闭 Cursor**；备份可选但强烈建议 |
| **C** | 激进 | 允许显式开启热写尝试（高风险，不推荐） |

所有写入路径：安全检查 → 预览 → 确认 → 执行。重建失败**不会**覆盖原数据库。

### 重要：未做好准备切勿替换在用库

**切勿**在未准备好时对在用的 `state.vscdb` 使用 `--replace`（CLI）或 `replace_original=true`（API），除非你已：

1. **完全退出 Cursor**（无 `Cursor.exe` 进程），并且  
2. **已创建备份**（`--backup-dir` / `do_backup=true`）到已知位置（最好在其他磁盘）。

在 Cursor 仍打开或无备份时替换，可能导致会话库损坏或数据无法恢复。

## 推荐流程（C: 盘已满）

系统盘空间紧张时，**不要**依赖在 C: 上做原地 `DELETE + VACUUM`。请用跨盘筛选复制重建：

1. **扫描** — 构建/更新索引（`cursor-flash scan` 或网页总览 → 扫描）。
2. **筛选** — 选择类型、会话和/或时间范围（网页或 CLI 参数）。
3. **预览** — 确认行数与预估字节（`cursor-flash clean --preview …` 或清理预览页）。
4. **重建到 E:** — 把新库写到非 C: 路径，例如 `E:\cursor-flash\new-state.vscdb`（`--dest` / API `dest_db`）。此时**先不要**替换原库。
5. **关闭 Cursor** — 完全退出应用。
6. **替换** — 仅在备份完成且 Cursor 已关闭后，再用 `--replace`（或界面勾选「替换原库」）执行。

CLI 示例：

```bash
cursor-flash status
cursor-flash scan
cursor-flash list categories
cursor-flash clean --preview --categories bubbleId
cursor-flash clean --apply --categories bubbleId --dest E:/cursor-flash/new-state.vscdb
# 关闭 Cursor，确认备份存在后：
cursor-flash clean --apply --categories bubbleId --dest E:/cursor-flash/new-state.vscdb --replace
```

## 开发环境

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
uvicorn cursor_flash.api.app:app --host 127.0.0.1 --port 8787
cd web && npm install && npm run dev
```

### 安装后常用命令

CLI（安装后可用 `cursor-flash`）：

```bash
cursor-flash status
cursor-flash scan
cursor-flash list categories
cursor-flash clean --preview --categories bubbleId
```

本地 API 地址：`http://127.0.0.1:8787`（接口在 `/api/…`）。

Web 开发服务器：**http://localhost:5173**（将 `/api` 代理到 8787）。需同时运行 API 与前端开发服务。

生产前端构建：

```bash
cd web && npm run build
python scripts/sync_web_dist.py   # 可选：同步到包内 web_dist/
```

生产构建后，单个 uvicorn 可同时提供 API 与 UI：

```bash
uvicorn cursor_flash.api.app:app --host 127.0.0.1 --port 8787
# 打开 http://127.0.0.1:8787/
```

## 桌面版

桌面壳是一层薄 **pywebview** 窗口，复用同一套 FastAPI + React UI（无需另写 GUI）。

### 从源码运行

```bash
pip install -e ".[desktop]"
cd web && npm install && npm run build
cd .. && python scripts/sync_web_dist.py
cursor-flash-desktop
```

可选参数：`--port`、`--width`、`--height`、`--db`、`--index`、`--backup-dir`。

### Windows 发布包构建

```bash
python scripts/build_desktop.py
# → dist/CursorFlash.exe
# → dist/CursorFlash-windows-x64-vX.Y.Z.zip
```

需要 Node.js、Python 3.11+，以及 Edge WebView2（Windows 10/11 一般已预装）。

也可从 [GitHub Releases](https://github.com/456wyc/cursor-flash/releases) 下载预构建的 Windows 包。

## 项目结构

```text
src/cursor_flash/   Python 核心、FastAPI、Typer CLI、桌面启动器
web/                React + Vite 控制台
packaging/          PyInstaller 规格
scripts/            sync_web_dist.py、build_desktop.py
tests/              pytest 夹具与集成测试
```

## 平台

以 Windows 为主（默认路径、`Cursor.exe` 进程检测）。需要 Python 3.11+。桌面版通过 pywebview 使用 Edge WebView2。
