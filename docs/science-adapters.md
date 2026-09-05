# Scientific loop（默认能力，不是开关）

TRACE 交的是**一个 agent**。typed-action 世界、仪器读数、必须写出指定产物的科学程序，是同一套方法的不同条款，不是按文件夹选的两条线路。

默认每次启动 Pi 都会：

1. 把科学方法写进 `.pi/APPEND_SYSTEM.md`（与师兄的科研契约同一份）
2. 加载 `research-briefing` **和** `scientific-loop`
3. 注册 `science_run_program`、`science_note_measurement`、`science_prepare_action`（与 `record_experiment` 并列的一等工具；直接 spawn Python，不依赖 Git Bash）
4. Windows 上由 Research Pi 启动链路探测 Git Bash 并写入 `shellPath`（`.pi/lib/host-shell.mjs`），把 Git `bin` 放到 PATH 最前，并把**当前工作区**放进 `PYTHONPATH`，这样子目录里的脚本也能 `import` 工作区根上的包。不是科学层另开一条路。
5. 可选 `RESEARCH_PI_TPM_GAP_MS`：两次模型请求之间的最小间隔（默认 0）。`RESEARCH_PI_TPM_LIMIT`：按滚动一分钟的估计 token 再排队，避免打满基座 TPM。评测脚本会打开 Pi 的 429/断线重试；不要把 `retry.enabled` 关死。

普通写代码、记笔记、Codex 协作仍走原契约；观察里没有隐藏世界或指定产物时，不要去强制 USE 或跑程序闭环。

`RESEARCH_PI_SCIENCE=0` 只用于对照师兄原版（关掉科学 skill 和这三个工具）。不要用它在 TRACE 上分流。

迁不走的评测环已经按同样逻辑写进 `scientific-loop`：同一观察重复三次要换探针、有可交互物就不要空等、开门后穿过、容器先开再拿、硬门槛没过还有提交次数就改再交。条款按当前观察启用，不绑练习套件的动作名或具名场景。

## 两套能力如何同时发挥作用

| 当前观察 | 用什么 |
|---|---|
| 隐藏世界 / typed action / 预算动作 | 合法动作、便宜探测、测完记下、在预算内提交可验证结果；`science_prepare_action` 补齐 USE，钥匙改 OPEN |
| 仪器读数 | `science_note_measurement`；用 oldest / outlier / contaminated 选题，不要记场景名 |
| 必须写出指定文件的科学程序 | 写完整程序 → `science_run_program` → 指定产物必须存在；缺重包则改写 pandas/numpy/sklearn 等 |
| 读数或运行真正改了判断 | `record_experiment`（笔记本不能代替实验账本） |

同一回合可以三件事都做：先动作，再记读数，再跑一段分析程序。

## 适配器 CLI（无模型）

从 harness 根目录：

```powershell
python adapters/science/cli.py self-check
python adapters/science/cli.py dw-self-check
python adapters/science/cli.py run-program --cwd <workspace> --code-file program.py --output results/out.csv
python adapters/science/cli.py note --cwd <workspace> --key sample-1 --name sample-a --vals 0.4,0.4
python adapters/science/cli.py prepare-action --ui-json "{...}" --action-json "{\"action\":\"USE\",\"arg1\":2}"
```

`run-program`：语法检查、短执行、检查指定输出是否写出。`note`：追加读数并返回 oldest / outlier / contaminated。`prepare-action`：按当前观察补齐 USE（仪器→样品），钥匙改为 OPEN。DiscoveryWorld 会话层只保证动作后 tick。没有具名场景脚本。

## 跑 TRACE 练习题（Executable World）

用法与师兄原来一致。科学纪律现在是默认的，不依赖工作区文件夹名。

```powershell
$env:RESEARCH_PI_DEV_MODE = "1"
node bin/pi.mjs --workspace <executable-world-examples> --full-access --provider apodex --model apodex-1.1 -p -a "@prompt.md"
```

对照原版：同一命令前设 `RESEARCH_PI_SCIENCE=0`。

三方对照（师兄原版 Pi / 用户原 harness / 融合版）用 harness 里的 `harness/examples/run_three_way_compare.py`，单 key、顺序、禁止并发。
