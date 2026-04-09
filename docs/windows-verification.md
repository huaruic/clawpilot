# CatClaw Windows 支持验收文档

## 一、本机验证（macOS 上可完成）

这些步骤在当前 macOS 开发环境上执行，验证代码逻辑和构建配置正确。

### 1.1 代码质量验证

```bash
# 类型检查
npm run typecheck

# 单元测试
npm test
```

预期：全部通过，无报错。

### 1.2 资源文件检查

```bash
# 确认 icon.ico 存在且大于 0 字节
ls -la build/icon.ico

# 确认所有必要图标都在
ls build/icon.png build/icon.icns build/icon.ico
```

### 1.3 预打包验证脚本

```bash
node scripts/verify-package-resources.mjs
```

预期：输出 `Pre-package verification passed.`

### 1.4 代码审查清单

手动确认以下改动点：

| 检查项 | 文件 | 预期 |
|--------|------|------|
| 标题栏 macOS 用 `hiddenInset` | `src/main/AppLifecycle.ts` | `process.platform === 'darwin'` 分支 |
| 标题栏 Windows 用 `hidden` + `titleBarOverlay` | `src/main/AppLifecycle.ts` | 非 darwin 分支有 `titleBarOverlay` |
| 关闭窗口 Windows 退出 | `src/main/AppLifecycle.ts` | `window-all-closed` 事件中 `!== 'darwin'` 调用 `handleQuit` |
| Tray 图标 Windows 用 `icon.png` | `src/main/index.ts` | 非 darwin 走 `build/icon.png` |
| Preload 暴露 `platform` | `src/preload/index.ts` | `platform: process.platform` |
| 类型声明有 `platform` | `src/renderer/src/api/ipc.ts` | `CatClawAPI` 接口包含 `platform: string` |
| Sidebar 间距按平台 | `src/renderer/src/components/layout/AppSidebar.tsx` | darwin `pt-10`，其他 `pt-2` |
| NSIS 配置有 ico | `package.json` | `win.icon` = `build/icon.ico` |

---

## 二、跨平台打包验证（macOS 上交叉编译）

electron-builder 支持在 macOS 上交叉编译 Windows 安装包（不需要 Windows 机器）。

### 2.1 安装 Wine（可选，用于 NSIS 打包）

macOS 上交叉编译 Windows NSIS 安装包需要 Wine：

```bash
brew install --cask wine-stable
```

> 如果不想装 Wine，可以跳过此步，直接在 Windows 机器/CI 上打包。

### 2.2 执行 Windows 打包

```bash
npm run package:win
```

预期输出：
- 生成 `dist/CatClaw Setup 1.0.0.exe`（NSIS 安装程序）
- 无报错

### 2.3 检查打包产物

```bash
# 确认安装包存在
ls -la dist/*.exe

# 确认产物大小合理（通常 80-200MB，含 Electron + Node runtime）
du -sh dist/*.exe
```

---

## 三、Windows 真机验证

以下步骤必须在 Windows 10/11 机器上执行。可以使用：
- 物理 Windows 机器
- 虚拟机（VMware / Parallels / VirtualBox）
- GitHub Actions Windows runner（推荐用于 CI）

### 3.1 环境准备

准备一台干净的 Windows 10 (1607+) 或 Windows 11 机器，不需要预装 Node.js。

### 3.2 安装验证

1. 将 `dist/CatClaw Setup 1.0.0.exe` 复制到 Windows 机器
2. 双击运行安装程序

**检查项：**
- [ ] 安装向导显示 CatClaw 图标（非默认 Electron 图标）
- [ ] 可以选择安装目录（非一键安装）
- [ ] 安装过程无报错
- [ ] 桌面快捷方式图标正确
- [ ] 开始菜单快捷方式图标正确

### 3.3 启动验证

1. 双击桌面快捷方式启动 CatClaw

**检查项：**
- [ ] 应用正常启动，无白屏/崩溃
- [ ] 任务栏图标显示彩色 CatClaw 图标（非黑色模板图标）
- [ ] 窗口标题栏：右上角有原生最小化/最大化/关闭按钮（白色符号，深色背景）
- [ ] 窗口可拖拽（点击标题栏区域拖动）

### 3.4 界面验证

**Sidebar 布局：**
- [ ] Sidebar 顶部没有过大的空白区域（macOS 红绿灯预留空间不应出现）
- [ ] Logo + 状态指示器正常显示
- [ ] 导航菜单项正常点击

**窗口操作：**
- [ ] 最小化按钮正常工作
- [ ] 最大化按钮正常工作（窗口最大化 + 恢复）
- [ ] 关闭按钮正常工作

### 3.5 系统托盘验证

- [ ] 系统托盘区域显示 CatClaw 图标
- [ ] 鼠标悬停显示 tooltip "CatClaw"
- [ ] 左键点击托盘图标：窗口显示/聚焦
- [ ] 右键点击托盘图标：弹出菜单（打开 CatClaw / 状态 / 退出）

### 3.6 关闭行为验证

**关闭窗口 = 退出应用（Windows 预期行为）：**
- [ ] 点击窗口关闭按钮 → 应用完全退出（非最小化到托盘）
- [ ] 托盘图标消失
- [ ] 任务管理器中 CatClaw 进程不再存在

**对比 macOS 行为（确认没有回归）：**
- macOS 上关闭窗口 → 应用保持后台运行（托盘模式）
- 通过 Cmd+Q 或 Dock 右键退出

### 3.7 功能验证（如已配置 Provider）

如果有可用的 LLM provider API key：
- [ ] 配置 Provider → 验证 API Key
- [ ] OpenClaw 自动启动（状态变为 Running）
- [ ] 发送聊天消息 → 收到流式回复
- [ ] 聊天过程中应用无卡顿/崩溃

### 3.8 进程管理验证

```powershell
# 在 PowerShell 中查看 CatClaw 相关进程
Get-Process | Where-Object { $_.ProcessName -like '*CatClaw*' -or $_.ProcessName -like '*node*' }
```

- [ ] 启动后有 CatClaw 主进程 + Node 子进程（OpenClaw）
- [ ] 退出后所有相关进程都已终止（无残留进程）

### 3.9 卸载验证

1. 通过 Windows 设置 → 应用 → 卸载 CatClaw
- [ ] 卸载过程无报错
- [ ] 桌面快捷方式已删除
- [ ] 开始菜单项已删除

---

## 四、使用 GitHub Actions CI 自动打包（推荐）

无需 Windows 机器，在 GitHub Actions 上自动构建并上传安装包。

创建 `.github/workflows/package-win.yml`：

```yaml
name: Package Windows

on:
  workflow_dispatch:       # 手动触发
  push:
    branches: [feat/windows-support]

jobs:
  build-win:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npm run bootstrap
      - run: npm run build
      - run: node scripts/verify-package-resources.mjs
      - run: npx electron-builder --win

      - uses: actions/upload-artifact@v4
        with:
          name: catclaw-win-installer
          path: dist/*.exe
          retention-days: 7
```

使用方式：
1. Push 代码到 `feat/windows-support` 分支，或在 GitHub Actions 页面手动触发
2. 等待构建完成（约 5-10 分钟）
3. 在 Actions run 页面下载 `catclaw-win-installer` artifact
4. 将下载的 `.exe` 转移到 Windows 机器上执行第三节的验证

---

## 五、快速验证矩阵（总览）

| 阶段 | 环境 | 验证内容 | 通过标准 |
|------|------|---------|---------|
| 代码 | macOS | typecheck + test | 0 errors, 283 tests pass |
| 资源 | macOS | icon.ico 存在 | 文件 > 0 bytes |
| 打包 | macOS/CI | `npm run package:win` | 生成 .exe 无报错 |
| 安装 | Windows | 运行安装程序 | 图标正确，可选目录 |
| UI | Windows | 标题栏 + sidebar | 原生控制按钮，无多余空白 |
| 托盘 | Windows | 系统托盘图标 | 彩色图标，菜单正常 |
| 关闭 | Windows | 关闭窗口 | 应用退出，进程清理 |
| 卸载 | Windows | 系统卸载 | 干净移除 |
