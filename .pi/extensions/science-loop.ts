import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { applyHostPythonEnv, prependWorkspaceToPythonPath, resolvePython } from "../lib/host-shell.mjs";
import { scienceLoopExtensionEnabled } from "../lib/science-workspace.mjs";

const harnessRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function scienceCli(): string {
	return join(harnessRoot, "adapters", "science", "cli.py");
}

function runPython(args: string[], cwd: string, timeoutMs: number, signal?: AbortSignal): Promise<{ code: number; stdout: string; stderr: string }> {
	return new Promise((resolveRun) => {
		const child = spawn(resolvePython(), args, {
			cwd,
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
			env: applyHostPythonEnv(prependWorkspaceToPythonPath({ ...process.env }, cwd)),
		});
		let stdout = "";
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill();
			resolveRun({ code: 1, stdout, stderr: `${stderr}\nTimeout after ${timeoutMs}ms` });
		}, timeoutMs);
		const onAbort = () => {
			child.kill();
		};
		signal?.addEventListener("abort", onAbort, { once: true });
		child.stdout?.on("data", (chunk) => {
			stdout += String(chunk);
		});
		child.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.on("error", (error) => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			resolveRun({ code: 1, stdout, stderr: error instanceof Error ? error.message : String(error) });
		});
		child.on("close", (code) => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", onAbort);
			resolveRun({ code: code ?? 1, stdout, stderr });
		});
	});
}

export default function (pi: ExtensionAPI) {
	if (!scienceLoopExtensionEnabled()) return;

	pi.registerTool({
		name: "science_run_program",
		label: "Science Run Program",
		description:
			"Syntax-check and short-execute a scientific Python program, then report whether the named output file exists. Spawns Python directly (does not need Git Bash). Use whenever the scientific deliverable is a program plus a result artifact.",
		promptSnippet: "Run a scientific program and check that the required output file was written",
		promptGuidelines: [
			"Call science_run_program after writing or revising a scientific program that must produce a named output.",
			"A zero exit without the output file is failure; feed the returned error/repair_hint back and revise.",
			"Do not pip-install missing libraries; rewrite with libraries already importable (see repair_hint).",
		],
		parameters: Type.Object({
			code: Type.Optional(Type.String({ description: "Full Python source; omit if codeFile is set" })),
			codeFile: Type.Optional(Type.String({ description: "Path to the program relative to the workspace" })),
			outputPath: Type.Optional(Type.String({ description: "Required output file relative to cwd; success requires this file to exist" })),
			cwd: Type.Optional(Type.String({ description: "Working directory; defaults to the session workspace" })),
			timeoutSec: Type.Optional(Type.Number({ description: "Seconds; default 45" })),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const cwd = String(params.cwd || ctx.cwd);
			const timeoutSec = Math.max(5, Number(params.timeoutSec || 45));
			let codeFile = params.codeFile ? String(params.codeFile) : "";
			if (!codeFile && params.code) {
				const scratch = join(cwd, ".pi", "runtime", "science-run.py");
				await mkdir(join(cwd, ".pi", "runtime"), { recursive: true });
				await writeFile(scratch, String(params.code), "utf8");
				codeFile = scratch;
			}
			if (!codeFile) {
				return { content: [{ type: "text", text: JSON.stringify({ success: 0, error: "Provide code or codeFile" }) }] };
			}
			const args = [scienceCli(), "run-program", "--cwd", cwd, "--code-file", codeFile, "--timeout", String(timeoutSec)];
			if (params.outputPath) args.push("--output", String(params.outputPath));
			const result = await runPython(args, cwd, (timeoutSec + 20) * 1000, signal);
			let parsed: Record<string, unknown> = {};
			try {
				parsed = JSON.parse((result.stdout || "").trim() || "{}");
			} catch {
				parsed = { parse_error: true, stdout: String(result.stdout || "").slice(-1500) };
			}
			return {
				content: [{ type: "text", text: JSON.stringify({ ...parsed, runner_exit: result.code, stderr_tail: String(result.stderr || "").slice(-800) }) }],
				details: parsed,
			};
		},
	});

	pi.registerTool({
		name: "science_note_measurement",
		label: "Science Note Measurement",
		description:
			"Append one instrument or experiment reading and return oldest / outlier / contaminated labels over the working notebook. Spawns Python directly. Does not replace record_experiment.",
		promptSnippet: "Note a scientific reading; oldest / outlier / contaminated are computed from the notebook",
		promptGuidelines: [
			"Record the raw reading here; call record_experiment only when the reading changes a research judgment.",
			"Prefer labels the environment actually used (name, numeric values, contaminated/oldest/outlier in the text).",
		],
		parameters: Type.Object({
			key: Type.String({ description: "Stable id of the measured object or run" }),
			name: Type.Optional(Type.String({ description: "Object or sample name" })),
			text: Type.Optional(Type.String({ description: "Raw instrument or program text" })),
			vals: Type.Optional(Type.Array(Type.Number(), { description: "Numeric readings if already parsed" })),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const args = [
				scienceCli(),
				"note",
				"--cwd",
				ctx.cwd,
				"--key",
				String(params.key),
				"--name",
				String(params.name || ""),
				"--text",
				String(params.text || ""),
			];
			if (Array.isArray(params.vals) && params.vals.length) args.push("--vals", params.vals.join(","));
			const result = await runPython(args, ctx.cwd, 15000, signal);
			let parsed: Record<string, unknown> = {};
			try {
				parsed = JSON.parse((result.stdout || "").trim() || "{}");
			} catch {
				parsed = { parse_error: true, stdout: String(result.stdout || "").slice(-1500), stderr: String(result.stderr || "").slice(-400) };
			}
			return {
				content: [{ type: "text", text: JSON.stringify(parsed) }],
				details: parsed,
			};
		},
	});

	pi.registerTool({
		name: "science_prepare_action",
		label: "Science Prepare Action",
		description:
			"Normalize a typed world action against the current observation: complete USE with instrument then sample, and rewrite USE(key) to OPEN(door). Generic primitives only. Does not execute the action.",
		promptSnippet: "Prepare a USE/OPEN action from the current inventory and reachable objects",
		promptGuidelines: [
			"Call before executing USE when arg2 is missing or when the object in hand might be a key.",
			"Locked doors: OPEN the door; do not USE the key.",
			"Then execute the returned action in the environment and tick/advance if the API has one.",
		],
		parameters: Type.Object({
			uiJson: Type.String({ description: "JSON of the current observation: inventoryObjects, accessibleEnvironmentObjects" }),
			actionJson: Type.String({ description: "JSON of the intended action, e.g. {\"action\":\"USE\",\"arg1\":2}" }),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const args = [
				scienceCli(),
				"prepare-action",
				"--ui-json",
				String(params.uiJson || ""),
				"--action-json",
				String(params.actionJson || ""),
			];
			const result = await runPython(args, ctx.cwd, 15000, signal);
			let parsed: Record<string, unknown> = {};
			try {
				parsed = JSON.parse((result.stdout || "").trim() || "{}");
			} catch {
				parsed = { parse_error: true, stdout: String(result.stdout || "").slice(-1500), stderr: String(result.stderr || "").slice(-400) };
			}
			return {
				content: [{ type: "text", text: JSON.stringify(parsed) }],
				details: parsed,
			};
		},
	});
}
