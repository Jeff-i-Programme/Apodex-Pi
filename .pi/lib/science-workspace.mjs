import { existsSync } from "node:fs";
import { join } from "node:path";

export function defaultScienceSkillPaths(packageRoot, env = process.env) {
	if (env.RESEARCH_PI_SCIENCE === "0") return [];
	const skill = join(packageRoot, ".pi", "skills", "scientific-loop");
	return existsSync(join(skill, "SKILL.md")) ? [skill] : [];
}

export function scienceLoopExtensionEnabled(env = process.env) {
	return env.RESEARCH_PI_SCIENCE !== "0";
}
