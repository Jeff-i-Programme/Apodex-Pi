import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applyHostPythonEnv, candidateBashPaths, isUsableBash, prependHostBinToPath, prependWorkspaceToPythonPath, resolveHostBash } from "../.pi/lib/host-shell.mjs";

test("skips WSL and WindowsApps bash stubs", () => {
	assert.equal(isUsableBash("C:\\Windows\\System32\\bash.exe"), false);
	assert.equal(isUsableBash("C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\bash.exe"), false);
});

test("candidate list prefers env override then Program Files Git", () => {
	const paths = candidateBashPaths({
		APODEX_PI_SHELL: "E:\\custom\\bash.exe",
		ProgramFiles: "C:\\Program Files",
	});
	assert.equal(paths[0], "E:\\custom\\bash.exe");
	assert.ok(paths.some((path) => path.endsWith("Git\\bin\\bash.exe")));
});

test("resolveHostBash uses an existing candidate without requiring Program Files", () => {
	const root = mkdtempSync(join(tmpdir(), "apodex-pi-bash-"));
	try {
		const bash = join(root, "Git", "bin", "bash.exe");
		mkdirSync(join(root, "Git", "bin"), { recursive: true });
		writeFileSync(bash, "");
		assert.equal(resolveHostBash({ APODEX_PI_SHELL: bash }, ""), bash);
		assert.equal(isUsableBash(bash), true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("prependHostBinToPath updates Path and PATH together", () => {
	const root = mkdtempSync(join(tmpdir(), "apodex-pi-path2-"));
	try {
		const bash = join(root, "Git", "bin", "bash.exe");
		mkdirSync(join(root, "Git", "bin"), { recursive: true });
		writeFileSync(bash, "");
		const bin = join(root, "Git", "bin");
		const env = { APODEX_PI_SHELL: bash, Path: "C:\\Windows\\System32", PATH: "C:\\Windows\\System32" };
		prependHostBinToPath(env);
		assert.equal(env.Path.startsWith(bin), true);
		assert.equal(env.PATH.startsWith(bin), true);
		assert.equal(env.Path.split(";").filter((p) => p === bin).length, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("prependWorkspaceToPythonPath puts the workspace first and is idempotent", () => {
	const env = { PYTHONPATH: "C:\\other" };
	prependWorkspaceToPythonPath(env, "G:\\project");
	prependWorkspaceToPythonPath(env, "G:\\project");
	assert.equal(env.PYTHONPATH.startsWith("G:\\project"), true);
	assert.equal(env.PYTHONPATH.split(";").filter((p) => p === "G:\\project").length, 1);
	assert.ok(env.PYTHONPATH.includes("C:\\other"));
});

test("applyHostPythonEnv fills UTF-8 and unbuffered without clobbering", () => {
	const env = { PYTHONUTF8: "0" };
	applyHostPythonEnv(env);
	assert.equal(env.PYTHONUTF8, "0");
	assert.equal(env.PYTHONUNBUFFERED, "1");
});
