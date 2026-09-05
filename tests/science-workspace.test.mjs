import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { defaultScienceSkillPaths, scienceLoopExtensionEnabled } from "../.pi/lib/science-workspace.mjs";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const scientificLoop = join(packageRoot, ".pi", "skills", "scientific-loop");

test("ordinary research workspace still loads the scientific-loop skill", () => {
	const temp = mkdtempSync(join(tmpdir(), "apodex-pi-science-"));
	try {
		mkdirSync(join(temp, "src"));
		writeFileSync(join(temp, "README.md"), "# experiment\n");
		const skills = defaultScienceSkillPaths(packageRoot, {});
		assert.deepEqual(skills, [scientificLoop]);
		assert.equal(scienceLoopExtensionEnabled({}), true);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});

test("executable-world and dataset folders get the same unified skill, not a fork", () => {
	const temp = mkdtempSync(join(tmpdir(), "apodex-pi-science-ew-"));
	try {
		mkdirSync(join(temp, "ew_examples"));
		writeFileSync(join(temp, "run_task.py"), "print(1)\n");
		mkdirSync(join(temp, "benchmark", "datasets"), { recursive: true });
		assert.deepEqual(defaultScienceSkillPaths(packageRoot, {}), [scientificLoop]);
		assert.deepEqual(defaultScienceSkillPaths(packageRoot, { APODEX_PI_SCIENCE: "1" }), [scientificLoop]);
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
});

test("APODEX_PI_SCIENCE=0 is the only off switch, for comparing original Pi", () => {
	assert.deepEqual(defaultScienceSkillPaths(packageRoot, { APODEX_PI_SCIENCE: "0" }), []);
	assert.equal(scienceLoopExtensionEnabled({ APODEX_PI_SCIENCE: "0" }), false);
	assert.equal(scienceLoopExtensionEnabled({ APODEX_PI_SCIENCE: "1" }), true);
});
