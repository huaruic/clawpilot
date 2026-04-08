# CatClaw

[English](README.md) | [简体中文](README.zh-CN.md)

CatClaw 是一个基于 OpenClaw 的零配置本地 AI Agent 桌面应用。

它把本地 OpenClaw runtime 封装在桌面界面之后，提供聊天、Provider 配置、技能管理、工作区控制，以及更适合终端用户的本地运行体验。

## 为什么是 CatClaw

- 不需要手工搭建 OpenClaw，即可运行本地 AI Agent 桌面端
- 通过图形界面管理 Provider 和本地模型兜底能力
- 将 agent runtime、会话状态和工作区数据保留在本机
- 把 OpenClaw 从开发者 CLI 工作流包装成可分发桌面产品

## 当前状态

- 应用框架：Electron + React + TypeScript
- Runtime 形态：内置 OpenClaw sidecar + 内置 Node.js runtime
- 当前重点：本地桌面工作流与打包分发
- 当前测试打包重点：macOS Apple Silicon

## 功能

- 本地 OpenClaw runtime 管理，支持启动、停止、重启
- 基于 OpenClaw gateway 的聊天界面
- 支持 OpenAI-compatible、Anthropic、OpenRouter、Ollama 的 Provider 配置
- Skills 浏览和本地技能管理
- 本地工作区选择与切换
- 为诊断和发布打包预留的基础能力

## 下载

桌面安装包应通过 GitHub Releases 分发。

- 发布产物不应提交到 Git 仓库主分支
- 未签名的 macOS 测试包首次启动时，可能需要在 `隐私与安全性` 中手动放行

## 本地开发

```bash
npm install
npm run bootstrap
npm run dev
```

如需在本机生成 macOS 测试包：

```bash
npm run package:mac:test
```

## Runtime 打包策略

CatClaw 不会把打包后的 runtime 二进制直接提交到 Git 历史。

- Runtime 版本定义在 `runtime-manifest.json`
- `npm run bootstrap` 会下载固定版本的 OpenClaw 包和平台 Node.js runtime
- 生成产物写入 `.catclaw-runtime/`
- `electron-builder` 会把 `.catclaw-runtime/` 打进最终桌面应用

## 仓库结构

- `src/`：Electron main、preload、renderer 源码
- `scripts/`：bootstrap 和打包辅助脚本
- `docs/`：运行手册和实现说明
- `resources/`：仅保留轻量仓库资源

## 路线图

- 完成 macOS 和 Windows 的正式发布打包链路
- 加强诊断、日志和 runtime 可观测性
- 完善 onboarding 与本地模型配置引导
- 完成发布签名与 notarization 流程

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安全

见 [SECURITY.md](SECURITY.md)。

## 许可证

MIT。见 [LICENSE](LICENSE)。
