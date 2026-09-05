import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { delimiter, dirname, join } from "node:path";

const SKIP_BASH = /[\\/](?:System32|SysWOW64|WindowsApps)[\\/]/i;

export function isUsableBash(path) {
	if (!path || typeof path !== "string") return false;
	if (SKIP_BASH.test(path)) return false;
	return existsSync(path);
}

export function candidateBashPaths(env = process.env) {
	const add = [];
	const push = (value) => {
		if (value && !add.includes(value)) add.push(value);
	};
	push(env.APODEX_PI_SHELL?.trim());
	push(env.PI_SHELL?.trim());
	if (env.ProgramFiles) push(join(env.ProgramFiles, "Git", "bin", "bash.exe"));
	if (env["ProgramFiles(x86)"]) push(join(env["ProgramFiles(x86)"], "Git", "bin", "bash.exe"));
	if (env.LOCALAPPDATA) push(join(env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"));
	if (env.USERPROFILE) {
		push(join(env.USERPROFILE, "AppData", "Local", "Programs", "Git", "bin", "bash.exe"));
		push(join(env.USERPROFILE, "scoop", "apps", "git", "current", "bin", "bash.exe"));
	}
	push("D:\\Git\\Git\\bin\\bash.exe");
	push("D:\\Tool\\Git\\Git\\bin\\bash.exe");
	push("C:\\Git\\bin\\bash.exe");
	push("C:\\Git\\Git\\bin\\bash.exe");
	return add;
}

export function resolveHostBash(env = process.env, existing = "") {
	if (isUsableBash(existing)) return existing;
	for (const path of candidateBashPaths(env)) {
		if (isUsableBash(path)) return path;
	}
	try {
		const result = spawnSync("where", ["bash.exe"], {
			encoding: "utf8",
			timeout: 5000,
			windowsHide: true,
			env,
		});
		if (result.status === 0 && result.stdout) {
			const hits = result.stdout.trim().split(/\r?\n/).map((line) => line.trim()).filter(isUsableBash);
			const gitBin = hits.find((path) => /Git[\\/]bin[\\/]bash\.exe$/i.test(path));
			if (gitBin) return gitBin;
			if (hits[0]) return hits[0];
		}
	} catch {
		// where.exe missing is fine; candidates above still apply.
	}
	return "";
}

export function prependHostBinToPath(env = process.env) {
	const bash = resolveHostBash(env, env.APODEX_PI_SHELL || "");
	if (!bash) return env;
	const bin = dirname(bash);
	const keys = Object.keys(env).filter((name) => name.toLowerCase() === "path");
	if (keys.length === 0) keys.push("PATH");
	for (const key of keys) {
		const current = env[key] || "";
		const parts = current.split(delimiter).filter((entry) => entry && entry !== bin);
		env[key] = [bin, ...parts].join(delimiter);
	}
	return env;
}

export function prependWorkspaceToPythonPath(env = process.env, workspace = "") {
	const root = typeof workspace === "string" ? workspace.trim() : "";
	if (!root) return env;
	const current = env.PYTHONPATH || "";
	const parts = current.split(delimiter).filter((entry) => entry && entry !== root);
	env.PYTHONPATH = [root, ...parts].join(delimiter);
	return env;
}

export function applyHostPythonEnv(env = process.env) {
	if (!env.PYTHONUTF8) env.PYTHONUTF8 = "1";
	if (!env.PYTHONUNBUFFERED) env.PYTHONUNBUFFERED = "1";
	if (process.platform === "win32" && !env.MSYS_NO_PATHCONV) env.MSYS_NO_PATHCONV = "1";
	return env;
}

export function resolvePython(env = process.env) {
	if (env.APODEX_PI_PYTHON?.trim()) return env.APODEX_PI_PYTHON.trim();
	const cmds = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"];
	for (const cmd of cmds) {
		try {
			const result = spawnSync(cmd, ["-c", "import sys; raise SystemExit(0)"], {
				encoding: "utf8",
				timeout: 5000,
				windowsHide: true,
				env,
			});
			if (result.status === 0) return cmd;
		} catch {
			// try the next name
		}
	}
	return process.platform === "win32" ? "python" : "python3";
}
