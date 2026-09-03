import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { detectScienceWorkspace, extraSkillPathsForWorkspace } from "../.pi/lib/science-workspace.mjs";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("ordinary research workspace does not attach science skills", () => {
	const temp = mkdtempSync(join(tmpdir(), "research-pi-science-"));
	try {
		mkdirSync(join(temp, "src"));
		writeFileSync(join(temp, "README.md"), "# experiment\n");
		const detected = detectScienceWorkspace(temp);
		assert.equal(detected.traces, false);
		assert.equal(detected.code, false);
		assert.deepEqual(extraSkillPathsForWorkspace(temp, packageRoot, {}), []);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});

test("RESEARCH_PI_SCIENCE=0 disables even a marked science workspace", () => {
	const temp = mkdtempSync(join(tmpdir(), "research-pi-science-off-"));
	try {
		mkdirSync(join(temp, ".pi"), { recursive: true });
		writeFileSync(join(temp, ".pi", "science-env.json"), '{"enabled":true}\n');
		assert.equal(detectScienceWorkspace(temp).marker, true);
		assert.deepEqual(extraSkillPathsForWorkspace(temp, packageRoot, { RESEARCH_PI_SCIENCE: "0" }), []);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});

test("executable-world layout attaches the typed-action skill only", () => {
	const temp = mkdtempSync(join(tmpdir(), "research-pi-science-ew-"));
	try {
		mkdirSync(join(temp, "ew_examples"));
		writeFileSync(join(temp, "run_task.py"), "print(1)\n");
		const skills = extraSkillPathsForWorkspace(temp, packageRoot, {});
		assert.equal(skills.length, 1);
		assert.match(skills[0], /traces-typed-action$/);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});

test("science-agentbench layout attaches the code-loop skill only", () => {
	const temp = mkdtempSync(join(tmpdir(), "research-pi-science-sab-"));
	try {
		mkdirSync(join(temp, "benchmark", "datasets"), { recursive: true });
		const skills = extraSkillPathsForWorkspace(temp, packageRoot, {});
		assert.equal(skills.length, 1);
		assert.match(skills[0], /science-code-loop$/);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});

test("RESEARCH_PI_SCIENCE=1 attaches both science skills", () => {
	const temp = mkdtempSync(join(tmpdir(), "research-pi-science-force-"));
	try {
		const skills = extraSkillPathsForWorkspace(temp, packageRoot, { RESEARCH_PI_SCIENCE: "1" });
		assert.equal(skills.length, 2);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});
