import { homedir } from "node:os";
import { join, resolve } from "node:path";

function defaultConfigRoot(environment, platform) {
	if (environment.APODEX_PI_CONFIG_DIR) return resolve(environment.APODEX_PI_CONFIG_DIR);
	if (environment.XDG_CONFIG_HOME) return resolve(environment.XDG_CONFIG_HOME, "apodex_pi");
	if (platform === "win32") return resolve(environment.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Apodex_Pi");
	return resolve(homedir(), ".config", "apodex_pi");
}

function defaultStateRoot(environment, platform) {
	if (environment.APODEX_PI_STATE_DIR) return resolve(environment.APODEX_PI_STATE_DIR);
	if (environment.XDG_STATE_HOME) return resolve(environment.XDG_STATE_HOME, "apodex_pi");
	if (platform === "win32") {
		return resolve(environment.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Apodex_Pi", "state");
	}
	return resolve(homedir(), ".local", "state", "apodex_pi");
}

export function resolveApodexPiPaths(options) {
	const harnessRoot = resolve(options.harnessRoot);
	const environment = options.environment ?? process.env;
	const platform = options.platform ?? process.platform;
	const development = environment.APODEX_PI_DEV_MODE === "1";
	const configRoot = development ? harnessRoot : defaultConfigRoot(environment, platform);
	const stateRoot = development ? join(harnessRoot, ".pi") : defaultStateRoot(environment, platform);
	const configPath = environment.APODEX_PI_CONFIG_FILE
		? resolve(environment.APODEX_PI_CONFIG_FILE)
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

export function apodexPiStateRoot(harnessRoot, environment = process.env) {
	return resolveApodexPiPaths({ harnessRoot, environment }).stateRoot;
}
