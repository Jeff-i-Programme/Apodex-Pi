import { existsSync } from "node:fs";
import { join } from "node:path";
import { applyProbelabEnvAliases } from "./runtime-paths.mjs";

export function defaultScienceSkillPaths(packageRoot, env = process.env) {
	env = applyProbelabEnvAliases({ ...env });
	if (env.PROBELAB_SCIENCE === "0") return [];
	const skill = join(packageRoot, ".pi", "skills", "scientific-loop");
	return existsSync(join(skill, "SKILL.md")) ? [skill] : [];
}

export function scienceLoopExtensionEnabled(env = process.env) {
	env = applyProbelabEnvAliases({ ...env });
	return env.PROBELAB_SCIENCE !== "0";
}
