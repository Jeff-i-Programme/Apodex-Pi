import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("Pi launcher always wires host shell, TPM pace, and the unified scientific loop", () => {
	const launcher = readFileSync(join(packageRoot, "bin", "pi.mjs"), "utf8");
	assert.match(launcher, /prependHostBinToPath/);
	assert.match(launcher, /prependWorkspaceToPythonPath/);
	assert.match(launcher, /applyHostPythonEnv/);
	assert.match(launcher, /tpm-pace\.ts/);
	assert.match(launcher, /science-loop\.ts/);
	assert.match(launcher, /defaultScienceSkillPaths/);
	assert.equal(existsSync(join(packageRoot, ".pi", "skills", "science-code-loop", "SKILL.md")), false);
	assert.equal(existsSync(join(packageRoot, ".pi", "skills", "traces-typed-action", "SKILL.md")), false);
	assert.equal(existsSync(join(packageRoot, ".pi", "skills", "scientific-loop", "SKILL.md")), true);
	const contract = readFileSync(join(packageRoot, ".pi", "APPEND_SYSTEM.md"), "utf8");
	assert.match(contract, /Scientific instruments, hidden worlds, and named artifacts/);
	assert.match(contract, /hard gate/);
	assert.match(contract, /honeypot/);
	assert.match(contract, /wrapper and field names the brief lists/);
	const skill = readFileSync(join(packageRoot, ".pi", "skills", "scientific-loop", "SKILL.md"), "utf8");
	assert.match(skill, /same error or the same observation repeats/);
	assert.match(skill, /Do not idle or wander/);
	assert.match(skill, /Closed container/);
	assert.match(skill, /If a scored result is zero/);
	assert.match(skill, /Submit matches the brief's object/);
	assert.match(skill, /ep\.act\("submit"/);
	assert.doesNotMatch(skill, /\bGail\b|\bPlork\b|Statue of a spheroid/i);
	assert.doesNotMatch(skill, /run_all|scanpy|radiocarbon|DISCOVERY_FEED/i);
});
