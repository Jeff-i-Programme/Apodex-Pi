import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveHostBash } from "./host-shell.mjs";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
export const APODEX_PI_DEFAULT_CONFIG_PATH = resolve(LIB_DIR, "../config.defaults.json");
export const APODEX_PI_CONFIG_SCHEMA_PATH = resolve(LIB_DIR, "../schemas/apodex-pi-config.schema.json");
export const APODEX_PI_CONFIG_VERSION = 2;
export const APODEX_PI_PROVIDER_CREDENTIALS = Object.freeze({
	deepseek: "DEEPSEEK_API_KEY",
	zai: "ZAI_API_KEY",
	"opencode-go": "OPENCODE_API_KEY",
});
export const APODEX_PI_THEME_CHOICES = Object.freeze([
	{ name: "apodex-pi", label: "Ocean", description: "Cool cyan, indigo, and violet for long research sessions." },
	{ name: "research-graphite", label: "Graphite", description: "Low-saturation graphite with restrained aqua accents." },
	{ name: "research-ember", label: "Ember", description: "Warm copper and amber balanced by scientific teal." },
	{ name: "dark", label: "Pi Dark", description: "Pi Core built-in dark palette." },
	{ name: "light", label: "Pi Light", description: "Pi Core built-in light palette for light terminals." },
]);

const TOP_LEVEL_KEYS = new Set([
	"$schema",
	"version",
	"pi",
	"codex",
	"research",
	"resources",
	"ui",
	"diagnostics",
]);
const CODEX_EFFORTS = new Set(["low", "medium", "high", "xhigh", "max", "ultra"]);
const UI_DENSITIES = new Set(["compact", "balanced"]);
const RUNTIME_STRIP_MODES = new Set(["auto", "always", "off"]);
const SEARCH_MODES = new Set(["auto", "on", "off"]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/;

function plainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function merge(base, override) {
	if (!plainObject(base) || !plainObject(override)) return clone(override);
	const result = clone(base);
	for (const [key, value] of Object.entries(override)) {
		result[key] = plainObject(value) && plainObject(result[key]) ? merge(result[key], value) : clone(value);
	}
	return result;
}

function positiveInteger(value, label) {
	if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
	return value;
}

function rejectSecretFields(value, path = "config") {
	if (Array.isArray(value)) {
		value.forEach((item, index) => rejectSecretFields(item, `${path}[${index}]`));
		return;
	}
	if (!plainObject(value)) return;
	for (const [key, item] of Object.entries(value)) {
		if (/(?:^|[_-])(?:api[_-]?key|password|secret|credential|private[_-]?key)(?:$|[_-])/i.test(key)) {
			throw new Error(`${path}.${key} is credential-like; keep secrets in credentials.env or .env`);
		}
		rejectSecretFields(item, `${path}.${key}`);
	}
}

function validateCodexRole(role, value) {
	if (!plainObject(value)) throw new Error(`codex.${role} must be an object`);
	if (!SAFE_ID.test(String(value.model ?? ""))) throw new Error(`codex.${role}.model is invalid`);
	if (!CODEX_EFFORTS.has(value.reasoningEffort)) throw new Error(`codex.${role}.reasoningEffort is invalid`);
}

export function validateApodexPiConfig(config) {
	if (!plainObject(config)) throw new Error("Apodex Pi config must be a JSON object");
	rejectSecretFields(config);
	for (const key of Object.keys(config)) {
		if (!TOP_LEVEL_KEYS.has(key)) throw new Error(`Unknown Apodex Pi config key: ${key}`);
	}
	if (config.version !== APODEX_PI_CONFIG_VERSION) {
		throw new Error(`Unsupported Apodex Pi config version: ${config.version}`);
	}
	validateCodexRole("advisor", config.codex?.advisor);
	validateCodexRole("executor", config.codex?.executor);
	if (!plainObject(config.codex?.retention)) throw new Error("codex.retention must be an object");
	positiveInteger(config.codex.retention.terminalDays, "codex.retention.terminalDays");
	positiveInteger(config.codex.retention.keepTerminalJobs, "codex.retention.keepTerminalJobs");
	const compact = config.research?.compaction;
	if (!plainObject(compact)) throw new Error("research.compaction must be an object");
	positiveInteger(compact.softTokens, "research.compaction.softTokens");
	positiveInteger(compact.hardTokens, "research.compaction.hardTokens");
	if (compact.softTokens >= compact.hardTokens) throw new Error("research.compaction.softTokens must be below hardTokens");
	if (!Array.isArray(compact.recentTailTokens) || !compact.recentTailTokens.length) {
		throw new Error("research.compaction.recentTailTokens must be a non-empty array");
	}
	compact.recentTailTokens.forEach((value, index) => positiveInteger(value, `research.compaction.recentTailTokens[${index}]`));
	positiveInteger(compact.summaryTargetTokens, "research.compaction.summaryTargetTokens");
	positiveInteger(compact.summaryMaxTokens, "research.compaction.summaryMaxTokens");
	if (compact.summaryTargetTokens >= compact.summaryMaxTokens) {
		throw new Error("research.compaction.summaryTargetTokens must be below summaryMaxTokens");
	}
	const search = config.research?.search;
	if (!plainObject(search) || !SAFE_ID.test(String(search.model ?? ""))) throw new Error("research.search.model is invalid");
	if (!SEARCH_MODES.has(search.enabled)) throw new Error("research.search.enabled must be auto, on, or off");
	positiveInteger(search.thinkingBudgetTokens, "research.search.thinkingBudgetTokens");
	positiveInteger(search.maxSources, "research.search.maxSources");
	positiveInteger(search.defaultMaxUses, "research.search.defaultMaxUses");
	if (search.maxSources > 50) throw new Error("research.search.maxSources must be at most 50");
	if (search.defaultMaxUses > 5) throw new Error("research.search.defaultMaxUses must be at most 5");
	if (!Array.isArray(config.resources?.skills) || config.resources.skills.some((item) => typeof item !== "string" || !item.trim())) {
		throw new Error("resources.skills must be an array of non-empty paths");
	}
	if (!plainObject(config.pi?.settings)) throw new Error("pi.settings must be an object");
	if (!UI_DENSITIES.has(config.ui?.density)) throw new Error("ui.density must be compact or balanced");
	if (!RUNTIME_STRIP_MODES.has(config.ui?.runtimeStrip)) throw new Error("ui.runtimeStrip must be auto, always, or off");
	if (!Number.isInteger(config.ui?.configPanelRows) || config.ui.configPanelRows < 3 || config.ui.configPanelRows > 20) {
		throw new Error("ui.configPanelRows must be between 3 and 20");
	}
	if (typeof config.diagnostics?.trace !== "boolean" || typeof config.diagnostics?.codexSqliteLogs !== "boolean") {
		throw new Error("diagnostics.trace and diagnostics.codexSqliteLogs must be boolean");
	}
	return config;
}

export function defaultApodexPiConfig() {
	return validateApodexPiConfig(JSON.parse(readFileSync(APODEX_PI_DEFAULT_CONFIG_PATH, "utf8")));
}

function migrateLegacyConfig(input = {}) {
	const migrated = clone(input);
	let legacyModelDefault;
	if (migrated.version === 1 || migrated.activeProfile || migrated.profiles) {
		const profile = plainObject(migrated.profiles) ? migrated.profiles[migrated.activeProfile] : null;
		if (plainObject(profile) && SAFE_ID.test(String(profile.provider ?? "")) && SAFE_ID.test(String(profile.model ?? ""))) {
			legacyModelDefault = {
				provider: String(profile.provider),
				model: String(profile.model),
				thinking: ["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(profile.thinking)
					? profile.thinking
					: "high",
			};
		}
		delete migrated.activeProfile;
		delete migrated.profiles;
		delete migrated.providerCompat;
		if (plainObject(migrated.ui)) delete migrated.ui.showProfileStatus;
		migrated.version = APODEX_PI_CONFIG_VERSION;
	}
	return { migrated, legacyModelDefault };
}

export function resolveApodexPiConfig(input = {}) {
	const defaults = defaultApodexPiConfig();
	const { migrated, legacyModelDefault } = migrateLegacyConfig(input);
	const resolved = validateApodexPiConfig(merge(defaults, migrated));
	if (legacyModelDefault) {
		Object.defineProperty(resolved, "legacyModelDefault", { value: legacyModelDefault, enumerable: false });
	}
	return resolved;
}

export function writeApodexPiConfig(path, config) {
	const resolved = resolveApodexPiConfig(config);
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	writeFileSync(path, `${JSON.stringify(resolved, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
	chmodSync(path, 0o600);
	return resolved;
}

export function ensureApodexPiConfig(path, options = {}) {
	if (!existsSync(path)) writeApodexPiConfig(path, options.defaults ?? defaultApodexPiConfig());
	const raw = JSON.parse(readFileSync(path, "utf8"));
	const resolved = resolveApodexPiConfig(raw);
	if (raw.version !== APODEX_PI_CONFIG_VERSION || Object.hasOwn(raw, "activeProfile") || Object.hasOwn(raw, "profiles")) {
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
		writeFileSync(path, `${JSON.stringify(resolved, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
		chmodSync(path, 0o600);
	}
	const schemaDestination = join(dirname(path), "schemas", "apodex-pi-config.schema.json");
	mkdirSync(dirname(schemaDestination), { recursive: true, mode: 0o700 });
	const schemaSource = resolve(options.schemaPath ?? APODEX_PI_CONFIG_SCHEMA_PATH);
	if (schemaSource !== resolve(schemaDestination)) copyFileSync(schemaSource, schemaDestination);
	return resolved;
}

export function readApodexPiConfig(path) {
	let parsed;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		if (error?.code === "ENOENT") throw new Error(`Apodex Pi config does not exist: ${path}`);
		throw new Error(`Apodex Pi config is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
	}
	return resolveApodexPiConfig(parsed);
}

export function apodexPiCredentialEnvironmentNames(config) {
	const names = new Set(Object.values(APODEX_PI_PROVIDER_CREDENTIALS));
	if (config.research.search.enabled !== "off") names.add("DEEPSEEK_API_KEY");
	return [...names];
}

export function apodexPiDeepSeekSearchEnabled(config, environment = process.env) {
	const mode = config.research.search.enabled;
	if (mode === "off") return false;
	const available = Boolean(environment.DEEPSEEK_API_KEY?.trim());
	if (mode === "on" && !available) {
		throw new Error("DEEPSEEK_API_KEY is missing while research.search.enabled is on");
	}
	return available;
}

export function apodexPiCoreSettings(config, coreVersion, existing = {}) {
	const settings = merge(plainObject(existing) ? existing : {}, config.pi.settings);
	if (config.legacyModelDefault) {
		settings.defaultProvider ??= config.legacyModelDefault.provider;
		settings.defaultModel ??= config.legacyModelDefault.model;
		settings.defaultThinkingLevel ??= config.legacyModelDefault.thinking;
		// v1 generated a curated scope on every launch. Remove it once so Pi's
		// native /model and /scoped-models regain the full authenticated catalog.
		delete settings.enabledModels;
	}
	if (coreVersion) settings.lastChangelogVersion = coreVersion;
	if (process.platform === "win32") {
		const bash = resolveHostBash(process.env, settings.shellPath);
		if (bash) settings.shellPath = bash;
	}
	applyEvalRetry(settings, process.env);
	return settings;
}

function applyEvalRetry(settings, environment = process.env) {
	const evalLike = Boolean(String(environment.APODEX_PI_TPM_GAP_MS || "").trim())
		|| Boolean(String(environment.APODEX_PI_TPM_LIMIT || "").trim())
		|| environment.APODEX_PI_FORCE_RETRY === "1";
	if (!evalLike) return;
	const current = plainObject(settings.retry) ? settings.retry : {};
	const provider = plainObject(current.provider) ? current.provider : {};
	settings.retry = {
		...current,
		enabled: true,
		maxRetries: Math.max(Number(current.maxRetries) || 0, 8),
		baseDelayMs: Math.max(Number(current.baseDelayMs) || 0, 10_000),
		provider: {
			...provider,
			maxRetries: Math.max(Number(provider.maxRetries) || 0, 5),
			maxRetryDelayMs: Math.max(Number(provider.maxRetryDelayMs) || 0, 90_000),
		},
	};
}

export function writeApodexPiAgentConfig(agentDir, config, options = {}) {
	mkdirSync(agentDir, { recursive: true, mode: 0o700 });
	const settingsPath = join(agentDir, "settings.json");
	let existingSettings = {};
	if (existsSync(settingsPath)) {
		try {
			existingSettings = JSON.parse(readFileSync(settingsPath, "utf8"));
		} catch {
			throw new Error(`Pi native settings are not valid JSON: ${settingsPath}`);
		}
	}
	const settings = apodexPiCoreSettings(config, options.coreVersion, existingSettings);
	writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
	chmodSync(settingsPath, 0o600);
}

export function apodexPiEnvironment(config) {
	const compact = config.research.compaction;
	const search = config.research.search;
	return {
		APODEX_PI_CODEX_ADVISOR_MODEL: config.codex.advisor.model,
		APODEX_PI_CODEX_ADVISOR_EFFORT: config.codex.advisor.reasoningEffort,
		APODEX_PI_CODEX_EXECUTOR_MODEL: config.codex.executor.model,
		APODEX_PI_CODEX_EXECUTOR_EFFORT: config.codex.executor.reasoningEffort,
		APODEX_PI_CODEX_RETENTION_DAYS: String(config.codex.retention.terminalDays),
		APODEX_PI_CODEX_KEEP_TERMINAL_JOBS: String(config.codex.retention.keepTerminalJobs),
		APODEX_PI_COMPACT_SOFT_TOKENS: String(compact.softTokens),
		APODEX_PI_COMPACT_HARD_TOKENS: String(compact.hardTokens),
		APODEX_PI_COMPACT_RECENT_TAIL_TOKENS: compact.recentTailTokens.join(","),
		APODEX_PI_COMPACT_SUMMARY_TARGET_TOKENS: String(compact.summaryTargetTokens),
		APODEX_PI_COMPACT_SUMMARY_MAX_TOKENS: String(compact.summaryMaxTokens),
		APODEX_PI_SEARCH_MODEL: search.model,
		APODEX_PI_SEARCH_ENABLED: search.enabled,
		APODEX_PI_SEARCH_THINKING_BUDGET_TOKENS: String(search.thinkingBudgetTokens),
		APODEX_PI_SEARCH_MAX_SOURCES: String(search.maxSources),
		APODEX_PI_SEARCH_DEFAULT_MAX_USES: String(search.defaultMaxUses),
		APODEX_PI_UI_DENSITY: config.ui.density,
		APODEX_PI_UI_RUNTIME_STRIP: config.ui.runtimeStrip,
		APODEX_PI_UI_CONFIG_PANEL_ROWS: String(config.ui.configPanelRows),
		APODEX_PI_TRACE: config.diagnostics.trace ? "1" : "0",
		PI_CODEX_SQLITE_LOGS: config.diagnostics.codexSqliteLogs ? "1" : "0",
	};
}

export function apodexPiConfigSummary(config, path) {
	return [
		`Apodex Pi config v${config.version}`,
		`Path: ${path}`,
		"Leader model/auth: Pi Core native settings (/login, /model, /scoped-models, /settings)",
		`Codex advisor: ${config.codex.advisor.model}/${config.codex.advisor.reasoningEffort}`,
		`Codex executor: ${config.codex.executor.model}/${config.codex.executor.reasoningEffort}`,
		`Codex retention: ${config.codex.retention.terminalDays} days · keep at least ${config.codex.retention.keepTerminalJobs} terminal jobs`,
		`Research compact: ${config.research.compaction.softTokens}/${config.research.compaction.hardTokens} tokens · summary target/max ${config.research.compaction.summaryTargetTokens}/${config.research.compaction.summaryMaxTokens}`,
		`Search: ${config.research.search.enabled} · deepseek/${config.research.search.model} · max ${config.research.search.maxSources} sources`,
		`UI: theme ${config.pi.settings.theme ?? "apodex-pi"} · ${config.ui.density} · runtime strip ${config.ui.runtimeStrip}`,
	].join("\n");
}
