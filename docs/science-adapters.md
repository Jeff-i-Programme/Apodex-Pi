# Science adapters（可选层）

默认 Research Pi 行为不变。科学技能只在工作区看起来像 typed-action 科学环境，或显式打开时挂上。

## 不破坏原能力

- 不改 `APPEND_SYSTEM.md`、不改 `research-runtime.ts`、不改默认 extension 列表。
- 普通科研仓库（只有源码和 README）**不会**加载 science skills。
- `RESEARCH_PI_SCIENCE=0` 强制关闭，即使工作区带 `.pi/science-env.json`。

## 何时自动挂上

| 工作区特征 | 额外 skill |
|---|---|
| `ew_examples/` 或 `run_task.py`（Executable World / TRACE 练习） | `traces-typed-action` |
| DiscoveryWorld 包布局 | `traces-typed-action` |
| `benchmark/datasets/`（ScienceAgentBench 一类） | `science-code-loop` |
| `.pi/science-env.json` 或 `RESEARCH_PI_SCIENCE=1` | 两套都挂 |

## 适配器 CLI（无模型）

从 harness 根目录：

```powershell
python adapters/science/cli.py self-check
python adapters/science/cli.py dw-self-check
python adapters/science/cli.py run-program --cwd <workspace> --code-file program.py --output results/out.csv
```

`run-program` 做语法检查、短执行、检查指定输出文件是否写出；缺包/错路径时给出改写提示。DiscoveryWorld 会话层只保证：动作后 tick、USE 补齐仪器与样品、读数进 oldest/outlier/contaminated 笔记本。没有具名场景脚本。

## 跑 TRACE 练习题（Executable World）

工作区指向 example kit 后，Pi 会自动带上 `traces-typed-action`。用法与师兄原来一致，只是多了一份科学提交纪律：

```powershell
$env:RESEARCH_PI_DEV_MODE = "1"
node bin/pi.mjs --workspace <executable-world-examples> --full-access --provider apodex --model apodex-1.1 -p -a "@prompt.md"
```

对照：同一工作区设 `RESEARCH_PI_SCIENCE=0` 即回到仅 `research-briefing` 的原技能集。
