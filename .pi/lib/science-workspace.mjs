import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SCIENCE_SKILLS = {
	traces: "traces-typed-action",
	code: "science-code-loop",
};

function hasAny(workspace, relPaths) {
	return relPaths.some((rel) => existsSync(join(workspace, rel)));
}

export function detectScienceWorkspace(workspace) {
	const traces = hasAny(workspace, [
		"ew_examples",
		"run_task.py",
		join("ew", "executable-world-examples-main", "run_task.py"),
	]);
	const discovery = hasAny(workspace, [
		"discoveryworld",
		join("discoveryworld", "DiscoveryWorldAPI.py"),
		join("discoveryworld", "DiscoveryWorldAPI", "__init__.py"),
	]);
	const scienceCode = hasAny(workspace, [
		join("benchmark", "datasets"),
		"pred_results",
	]);
	const markerPath = join(workspace, ".pi", "science-env.json");
	let marker = false;
	if (existsSync(markerPath)) {
		try {
			const raw = JSON.parse(readFileSync(markerPath, "utf8"));
			marker = raw === true || raw?.enabled !== false;
		} catch {
			marker = true;
		}
	}
	return {
		traces: traces || discovery || marker,
		code: scienceCode || marker,
		discovery,
		marker,
	};
}

export function extraSkillPathsForWorkspace(workspace, packageRoot, env = process.env) {
	if (env.RESEARCH_PI_SCIENCE === "0") return [];
	const forced = env.RESEARCH_PI_SCIENCE === "1";
	const detected = detectScienceWorkspace(workspace);
	const skills = [];
	if (forced || detected.traces) {
		skills.push(join(packageRoot, ".pi", "skills", SCIENCE_SKILLS.traces));
	}
	if (forced || detected.code) {
		skills.push(join(packageRoot, ".pi", "skills", SCIENCE_SKILLS.code));
	}
	return skills.filter((skill) => existsSync(join(skill, "SKILL.md")));
}
