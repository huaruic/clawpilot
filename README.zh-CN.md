<p align="center">
  <img src="build/icon.png" width="120" alt="CatClaw Logo" />
</p>

<h1 align="center">CatClaw</h1>

<p align="center">
  <strong>隐私优先的本地 AI Agent 桌面应用</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> &bull;
  <a href="#为什么选择-catclaw">为什么选择 CatClaw</a> &bull;
  <a href="#快速开始">快速开始</a> &bull;
  <a href="#架构">架构</a> &bull;
  <a href="#开发">开发</a> &bull;
  <a href="#贡献">贡献</a>
</p>

<p align="center">
  <a href="https://github.com/huaruic/catclaw/releases"><img src="https://img.shields.io/badge/平台-macOS%20%7C%20Windows-blue" alt="Platform" /></a>
  <a href="https://github.com/huaruic/catclaw"><img src="https://img.shields.io/badge/electron-36+-47848F?logo=electron" alt="Electron" /></a>
  <a href="https://github.com/huaruic/catclaw"><img src="https://img.shields.io/badge/react-19-61DAFB?logo=react" alt="React" /></a>
  <a href="https://github.com/huaruic/catclaw/releases"><img src="https://img.shields.io/github/downloads/huaruic/catclaw/total?color=%23027DEB" alt="Downloads" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
</p>

<p align="center">
  <a href="https://catclaw.app">官网</a> &bull;
  <a href="README.md">English</a> &bull;
  简体中文
</p>

---

## 概述

CatClaw 是一款基于 [OpenClaw](https://github.com/nicepkg/openclaw) 的**本地 AI Agent 桌面应用**。它将命令行 AI 编排工具转化为美观、易用的桌面体验 — 无需终端操作。

在本地运行 AI Agent，数据完全私有。与多家 LLM 提供商对话，管理**微信、飞书、Telegram、钉钉**等消息渠道，定时执行自动化任务，通过技能系统扩展 Agent 能力 — 所有数据保留在你的本机上。

CatClaw 是一款**支持离线运行的 ChatGPT 桌面替代方案**，适合重视隐私和数据安全的用户。

<!-- 
## 截图

<p align="center">
  <img src="docs/screenshot.png" width="800" alt="CatClaw 截图" />
</p>
-->

---

## 为什么选择 CatClaw

使用 AI Agent 不应该需要精通命令行。CatClaw 让强大的 AI 技术通过一个尊重你时间和隐私的界面触手可及。

| 痛点 | CatClaw 方案 |
|------|-------------|
| 复杂的 CLI 配置 | 一键安装 + 引导式设置向导 |
| 手写配置文件 | 可视化设置，实时验证 |
| 进程管理 | 自动管理 runtime 生命周期 |
| 多个 AI 提供商 | 统一的 Provider 配置面板 |
| 技能/插件安装 | 内置技能浏览器，一键安装 |
| 渠道对接 | 可视化多渠道配置（微信、飞书、Telegram、钉钉） |

### 内置 OpenClaw

CatClaw 直接构建于官方 [OpenClaw](https://github.com/nicepkg/openclaw) 核心之上。运行时嵌入在应用内部，提供「开箱即用」的完整体验。严格跟进上游 OpenClaw 确保获得最新能力、稳定性改进和生态兼容性。

---

## 功能特性

### 零配置门槛

从安装到首次 AI 对话，全程通过直观的图形界面完成。无需终端命令、YAML 文件或环境变量。CatClaw 是真正的**零配置本地 AI 桌面应用**。

### 智能对话界面

通过现代化的聊天体验与 AI Agent 交流。支持多会话、消息历史、富 Markdown 渲染和多 Agent 路由。每个 Agent 可独立配置 Provider 和模型。

### 多渠道管理

同时配置和监控多个 AI 消息渠道，每个渠道独立运行，支持按账号绑定 Agent。

已支持**微信、飞书/Lark、Telegram、钉钉** — 在一个桌面应用中统一管理所有平台的 AI 机器人。

### 可扩展技能系统

通过预置技能扩展 AI Agent 能力。在集成的技能面板中浏览、安装和管理技能 — 无需包管理器。文档处理、网页搜索和 Agent 自我提升等技能开箱可用。

### 安全的 Provider 集成

连接多个 AI 提供商 — **OpenAI、Anthropic、OpenRouter、Ollama** 以及任何 OpenAI 兼容接口。API 密钥安全存储，自动健康检查确保连接可靠。

### 自适应主题

浅色模式、深色模式或跟随系统主题。CatClaw 自动适配你的偏好。

---

## 适用人群

**普通用户** — 无需技术背景即可运行本地 AI 助手，用于聊天、写作和日常任务。你的对话完全保留在本机。

**开发者** — 灵活的 Provider 配置、通过 Ollama 支持本地模型、可扩展的技能系统。在本地构建和测试 AI Agent，然后再部署上线。

**团队与企业** — 将 AI Agent 部署到消息渠道（微信、飞书、钉钉），用于客户服务、内部自动化和团队效率提升。敏感数据不出内网。

---

## 快速开始

### 系统要求

- **操作系统**：macOS 11+（Apple Silicon 和 Intel）或 Windows 10+
- **内存**：最低 4 GB RAM（推荐 8 GB）
- **存储**：1 GB 可用磁盘空间

### 安装

#### 预构建版本（推荐）

从 [Releases 页面](https://github.com/huaruic/catclaw/releases) 下载适合你平台的最新版本，或访问 [catclaw.app](https://catclaw.app)。

#### 从源码构建

```bash
git clone https://github.com/huaruic/catclaw.git
cd catclaw
npm install
npm run bootstrap
npm run dev
```

如需在本机生成 macOS 测试包：

```bash
npm run package:mac:test
```

### 首次启动

设置向导将引导你完成：

1. **AI Provider** — 添加 OpenAI、Anthropic 的 API Key，或通过 Ollama 连接本地模型
2. **渠道配置** — 可选连接消息渠道（微信、飞书等）
3. **验证** — 测试配置是否正常后进入主界面

---

## 架构

CatClaw 采用双进程架构，内嵌 OpenClaw 运行时：

```
┌─────────────────────────────────────────────────────┐
│                 CatClaw 桌面应用                      │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Electron 主进程                                │  │
│  │  • 窗口与应用生命周期管理                         │  │
│  │  • OpenClaw 运行时监管                           │  │
│  │  • 系统集成（托盘、通知）                         │  │
│  │  • Provider 与渠道配置                           │  │
│  └──────────────────┬─────────────────────────────┘  │
│                     │ IPC                             │
│  ┌──────────────────▼─────────────────────────────┐  │
│  │  React 渲染进程                                 │  │
│  │  • 组件化 UI（React 19）                        │  │
│  │  • 状态管理（Zustand）                          │  │
│  │  • 富 Markdown 聊天渲染                         │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────┘
                       │ WebSocket / HTTP
┌──────────────────────▼───────────────────────────────┐
│  OpenClaw Gateway（内置运行时）                        │
│  • AI Agent 编排与消息路由                             │
│  • 多渠道管理（微信、飞书等）                           │
│  • 技能/插件执行环境                                   │
│  • Provider 抽象层                                    │
└──────────────────────────────────────────────────────┘
```

### 设计原则

- **进程隔离** — AI 运行时在独立进程中运行，确保 UI 流畅
- **隐私优先** — 所有数据保留本地，无遥测、无云端同步
- **优雅恢复** — 内置重连、超时和退避机制
- **安全存储** — API 密钥使用系统原生钥匙串

---

## 开发

### 技术栈

| 层级 | 技术 |
|------|-----|
| 运行时 | Electron 36+ |
| UI 框架 | React 19 + TypeScript |
| 样式 | Tailwind CSS + shadcn/ui |
| 状态 | Zustand |
| 构建 | Vite (electron-vite) + electron-builder |
| 测试 | Vitest |
| 动画 | Framer Motion |
| 图标 | Lucide React |

### 可用命令

```bash
# 开发
npm install                # 安装依赖
npm run bootstrap          # 下载 OpenClaw 运行时 + Node.js
npm run dev                # 启动开发模式（热重载）

# 质量
npm run lint               # 运行 ESLint
npm run typecheck          # TypeScript 类型检查

# 测试
npm test                   # 运行单元测试
npm run test:watch         # 监听模式运行测试

# 构建与打包
npm run build              # 生产构建
npm run package:mac        # 打包 macOS 版本
npm run package:win        # 打包 Windows 版本
```

### 项目结构

```
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── services/      # Provider、运行时、渠道服务
│   │   ├── state/         # 运行时状态管理
│   │   ├── ipc/           # IPC 处理器
│   │   └── utils/         # 工具函数与日志
│   ├── preload/           # 安全 IPC 桥接
│   └── renderer/          # React UI
│       ├── components/    # 可复用 UI 组件
│       ├── pages/         # 聊天、设置、技能、渠道
│       └── stores/        # Zustand 状态管理
├── scripts/               # Bootstrap 和打包辅助脚本
├── resources/             # 应用图标和托盘资源
└── docs/                  # 运行手册和实现说明
```

---

## 路线图

- 完成 macOS 和 Windows 正式发布打包
- 接入更多消息渠道
- 加强诊断、日志和运行时可观测性
- 完善 onboarding 与本地模型配置引导
- 完成发布签名与公证流程
- Linux 支持

---

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安全

见 [SECURITY.md](SECURITY.md)。

## 许可证

MIT。见 [LICENSE](LICENSE)。
