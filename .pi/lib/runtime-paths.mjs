import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Legacy APODEX_PI_* names remain readable as aliases for PROBELAB_*. */
const ENV_ALIAS_SUFFIXES = [
	"CONFIG_DIR",
	"STATE_DIR",
	"CONFIG_FILE",
	"DEV_MODE",
	"FULL_ACCESS",
	"TRACE",
	"SHELL",
	"PYTHON",
	"SCIENCE",
	"RUNTIME_DIR",
	"RUNTIME_ROOTS",
	"ALLOW_HOME_RUNTIME_ROOTS",
	"INITIAL_SESSION_MODE",
	"UI_DENSITY",
	"UI_RUNTIME_STRIP",
	"UI_CONFIG_PANEL_ROWS",
	"TPM_GAP_MS",
	"TPM_LIMIT",
	"FORCE_RETRY",
	"SEARCH_MODEL",
	"SEARCH_ENABLED",
	"SEARCH_THINKING_BUDGET_TOKENS",
	"SEARCH_MAX_SOURCES",
	"SEARCH_DEFAULT_MAX_USES",
	"COMPACT_SOFT_TOKENS",
	"COMPACT_HARD_TOKENS",
	"COMPACT_RECENT_TAIL_TOKENS",
	"COMPACT_SUMMARY_TARGET_TOKENS",
	"COMPACT_SUMMARY_MAX_TOKENS",
	"CODEX_ADVISOR_MODEL",
	"CODEX_ADVISOR_EFFORT",
	"CODEX_EXECUTOR_MODEL",
	"CODEX_EXECUTOR_EFFORT",
	"CODEX_RETENTION_DAYS",
	"CODEX_KEEP_TERMINAL_JOBS",
];

/**
 * Copy APODEX_PI_* into PROBELAB_* when the new name is unset.
 * Mutates and returns the same environment object.
 */
export function applyProbelabEnvAliases(environment = process.env) {
	for (const suffix of ENV_ALIAS_SUFFIXES) {
		const next = `PROBELAB_${suffix}`;
		const prev = `APODEX_PI_${suffix}`;
		if (environment[next] === undefined && environment[prev] !== undefined) {
			environment[next] = environment[prev];
		}
	}
	return environment;
}

function withAliases(environment) {
	return applyProbelabEnvAliases({ ...environment });
}

function defaultConfigRoot(environment, platform) {
	if (environment.PROBELAB_CONFIG_DIR) return resolve(environment.PROBELAB_CONFIG_DIR);
	if (environment.XDG_CONFIG_HOME) return resolve(environment.XDG_CONFIG_HOME, "probelab");
	if (platform === "win32") return resolve(environment.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Probelab");
	return resolve(homedir(), ".config", "probelab");
}

function defaultStateRoot(environment, platform) {
	if (environment.PROBELAB_STATE_DIR) return resolve(environment.PROBELAB_STATE_DIR);
	if (environment.XDG_STATE_HOME) return resolve(environment.XDG_STATE_HOME, "probelab");
	if (platform === "win32") {
		return resolve(environment.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Probelab", "state");
	}
	return resolve(homedir(), ".local", "state", "probelab");
}

export function resolveProbelabPaths(options) {
	const harnessRoot = resolve(options.harnessRoot);
	const environment = withAliases(options.environment ?? process.env);
	const platform = options.platform ?? process.platform;
	const development = environment.PROBELAB_DEV_MODE === "1";
	const configRoot = development ? harnessRoot : defaultConfigRoot(environment, platform);
	const stateRoot = development ? join(harnessRoot, ".pi") : defaultStateRoot(environment, platform);
	const configPath = environment.PROBELAB_CONFIG_FILE
		? resolve(environment.PROBELAB_CONFIG_FILE)
		: development
			? join(harnessRoot, ".pi", "config.json")
			: join(configRoot, "config.json");
	return {
		development,
		harnessRoot,
		configRoot,
		configPath,
		stateRoot,
		credentialsPath: development ? join(harnessRoot, ".env") : join(configRoot, "credentials.env"),
		agentDir: join(stateRoot, "agent"),
		sessionDir: join(stateRoot, "sessions"),
		memoryDir: join(stateRoot, "memory"),
		runtimeDir: join(stateRoot, "runtime"),
		codexDir: join(stateRoot, "codex"),
		capabilityDir: join(stateRoot, "capabilities"),
		traceDir: join(stateRoot, "agent", "traces"),
	};
}

export function probelabStateRoot(harnessRoot, environment = process.env) {
	return resolveProbelabPaths({ harnessRoot, environment }).stateRoot;
}
