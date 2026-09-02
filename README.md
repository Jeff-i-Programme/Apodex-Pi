# Apodex-Pi

本机 Windows 启动记录。Node 22、源码目录 `G:\project\Research-Pi`、模型 Apodex 1.1。

## 依赖

- Node.js `>= 22.19`（本机 `v22.22.0`）
- Git Bash：`D:\Git\Git\bin\bash.exe`（不在 `C:\Program Files\Git`）
- Python 3（本机 `python`，跑 Executable World 时用）

Git 全局代理若指向 `127.0.0.1:7890` 且 Clash 没开，clone / push 要临时关掉：

```powershell
git -c http.proxy= -c https.proxy= <command>
```

## 安装

```powershell
cd G:\project\Research-Pi
npm install --ignore-scripts
```

开发模式把配置和状态写在仓库的 `.pi/`，不要走全局 `~/.config`。

```powershell
$env:RESEARCH_PI_DEV_MODE = "1"
node bin/pi.mjs setup
node bin/pi.mjs paths
node bin/pi.mjs --version   # 0.84.2
```

`setup` 会生成 `.env` 和 `.pi/config.json`。不要提交 `.env`、`.pi/agent/`、`.pi/config.json`。

## 模型

Research-Pi 用自己的 `.pi/agent/`，不会读 `~\.pi\agent`。把已有的 Apodex 配置拷过去：

```powershell
Copy-Item $env:USERPROFILE\.pi\agent\models.json .pi\agent\models.json
```

`settings.json` 里需要：

```json
{
  "defaultProvider": "apodex",
  "defaultModel": "apodex-1.1",
  "defaultThinkingLevel": "low",
  "shellPath": "D:\\Git\\Git\\bin\\bash.exe"
}
```

不要用 PowerShell `Set-Content` 写这个文件，它会带 UTF-8 BOM，启动时报 `Pi native settings are not valid JSON`。用无 BOM 的 UTF-8。

确认模型：

```powershell
$env:RESEARCH_PI_DEV_MODE = "1"
node bin/pi.mjs --list-models apodex
```

## 启动

bash 工具不读 `settings.json` 的 `shellPath`，只找 `C:\Program Files\Git\bin\bash.exe` 和 PATH。每次启动前把 Git Bash 放进 PATH。Windows 上沙箱不可用，必须 `--full-access`。

交互：

```powershell
$env:RESEARCH_PI_DEV_MODE = "1"
$env:Path = "D:\Git\Git\bin;" + $env:Path
node bin/pi.mjs --workspace G:\project\your-project --full-access --provider apodex --model apodex-1.1
```

非交互（`-p` 打印，`-a` 信任项目）。Prompt 用 `@文件` 传入，不要写单独的 `--`，0.84.2 会把它当成未知参数。

```powershell
$env:RESEARCH_PI_DEV_MODE = "1"
$env:Path = "D:\Git\Git\bin;" + $env:Path
node bin/pi.mjs `
  --workspace G:\project\your-project `
  --full-access `
  --provider apodex `
  --model apodex-1.1 `
  --thinking low `
  -p -a `
  --no-context-files `
  "@G:\path\to\prompt.md"
```

PowerShell 里参数用数组更稳：

```powershell
$piArgs = @(
  "G:\project\Research-Pi\bin\pi.mjs",
  "--workspace", "G:\project\your-project",
  "--full-access",
  "--provider", "apodex",
  "--model", "apodex-1.1",
  "--thinking", "low",
  "-p", "-a",
  "--no-context-files",
  "@G:\path\to\prompt.md"
)
& node @piArgs
```

## Executable World

练习题在 `G:\project\executable-world-examples`。已跑通 `verify_solutions`，分数 `1.0`。

```powershell
cd G:\project\executable-world-examples
.\run_research_pi_task.ps1 -Task verify_solutions
```

脚本会设置 `RESEARCH_PI_DEV_MODE`、把 `D:\Git\Git\bin` 加入 PATH，并用 `--full-access` 调上面的 `bin/pi.mjs`。
