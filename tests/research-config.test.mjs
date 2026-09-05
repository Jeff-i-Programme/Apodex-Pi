import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import researchConfigExtension, { compactConfigPath, themeSelectItems } from "../.pi/extensions/research-config.ts";
import {
	defaultApodexPiConfig,
	ensureApodexPiConfig,
	readApodexPiConfig,
	apodexPiCoreSettings,
	apodexPiCredentialEnvironmentNames,
	apodexPiDeepSeekSearchEnabled,
	apodexPiEnvironment,
	resolveApodexPiConfig,
	writeApodexPiAgentConfig,
	writeApodexPiConfig,
} from "../.pi/lib/research-config.mjs";

test("Apodex Pi config owns research runtime settings, not the Leader model catalog", () => {
	const config = defaultApodexPiConfig();
	assert.equal(config.version, 2);
	assert.equal(Object.hasOwn(config, "activeProfile"), false);
	assert.equal(Object.hasOwn(config, "profiles"), false);
	assert.equal(Object.hasOwn(config, "providerCompat"), false);
	assert.equal(config.codex.executor.model, "gpt-5.6-sol");
	assert.deepEqual(config.codex.retention, { terminalDays: 30, keepTerminalJobs: 200 });
	assert.equal(config.research.compaction.hardTokens, 384 * 1024);
	assert.deepEqual(config.research.compaction.recentTailTokens, [24 * 1024, 32 * 1024, 40 * 1024]);
	assert.equal(config.research.compaction.summaryTargetTokens, 8 * 1024);
	assert.equal(config.research.compaction.summaryMaxTokens, 16 * 1024);
	assert.equal(config.research.search.model, "deepseek-v4-flash");
	assert.equal(config.ui.density, "balanced");
	assert.equal(config.pi.settings.theme, "apodex-pi");
});

test("eval TPM env turns retry back on even if settings had it disabled", () => {
	const previousGap = process.env.APODEX_PI_TPM_GAP_MS;
	process.env.APODEX_PI_TPM_GAP_MS = "25000";
	try {
		const settings = apodexPiCoreSettings({
			pi: { settings: { retry: { enabled: false, maxRetries: 0, provider: { maxRetries: 0 } } } },
			codex: defaultApodexPiConfig().codex,
			research: defaultApodexPiConfig().research,
			ui: defaultApodexPiConfig().ui,
			diagnostics: defaultApodexPiConfig().diagnostics,
			resources: {},
			version: 2,
		}, "0.84.2", { retry: { enabled: false, maxRetries: 0 } });
		assert.equal(settings.retry.enabled, true);
		assert.ok(settings.retry.maxRetries >= 8);
		assert.ok(settings.retry.provider.maxRetries >= 5);
		assert.ok(settings.retry.baseDelayMs >= 10_000);
	} finally {
		if (previousGap === undefined) delete process.env.APODEX_PI_TPM_GAP_MS;
		else process.env.APODEX_PI_TPM_GAP_MS = previousGap;
	}
});

test("partial runtime config merges over defaults and rejects ambiguous or secret fields", () => {
	const config = resolveApodexPiConfig({ codex: { executor: { model: "gpt-5.6-luna" } } });
	assert.equal(config.codex.executor.model, "gpt-5.6-luna");
	assert.equal(config.codex.executor.reasoningEffort, "max");
	assert.throws(() => resolveApodexPiConfig({ typoSetting: true }), /Unknown Apodex Pi config key/);
	assert.throws(() => resolveApodexPiConfig({ research: { compaction: { softTokens: 500_000 } } }), /below hardTokens/);
	assert.throws(
		() => resolveApodexPiConfig({ research: { compaction: { summaryTargetTokens: 20_000, summaryMaxTokens: 10_000 } } }),
		/below summaryMaxTokens/,
	);
	assert.throws(() => resolveApodexPiConfig({ research: { search: { enabled: "sometimes" } } }), /auto, on, or off/);
	assert.throws(() => resolveApodexPiConfig({ codex: { retention: { terminalDays: 0 } } }), /positive integer/);
	assert.throws(() => resolveApodexPiConfig({ pi: { settings: { api_key: "do-not-store-here" } } }), /credential-like/);
});

test("v1 profile config migrates once into Pi native defaults and removes the curated scope", () => {
	const root = mkdtempSync(join(tmpdir(), "apodex-pi-config-migrate-"));
	try {
		const defaults = defaultApodexPiConfig();
		const configPath = join(root, "config.json");
		writeFileSync(configPath, `${JSON.stringify({
			...defaults,
			version: 1,
			activeProfile: "go-flash",
			profiles: { "go-flash": { provider: "opencode-go", model: "deepseek-v4-flash", thinking: "max" } },
			providerCompat: { obsolete: true },
			ui: { ...defaults.ui, showProfileStatus: true },
		}, null, 2)}\n`);
		const config = ensureApodexPiConfig(configPath);
		const persisted = JSON.parse(readFileSync(configPath, "utf8"));
		assert.equal(persisted.version, 2);
		assert.equal(Object.hasOwn(persisted, "activeProfile"), false);
		assert.equal(Object.hasOwn(persisted, "profiles"), false);
		assert.equal(Object.hasOwn(persisted, "providerCompat"), false);
		assert.equal(Object.hasOwn(persisted.ui, "showProfileStatus"), false);

		const agentDir = join(root, "agent");
		writeApodexPiAgentConfig(agentDir, config, { coreVersion: "0.84.2" });
		const settings = JSON.parse(readFileSync(join(agentDir, "settings.json"), "utf8"));
		assert.equal(settings.defaultProvider, "opencode-go");
		assert.equal(settings.defaultModel, "deepseek-v4-flash");
		assert.equal(settings.defaultThinkingLevel, "max");
		assert.equal(Object.hasOwn(settings, "enabledModels"), false);
		assert.equal(existsSync(join(agentDir, "models.json")), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("normal launches preserve Pi native model scope and custom models", () => {
	const root = mkdtempSync(join(tmpdir(), "apodex-pi-native-models-"));
	try {
		const agentDir = join(root, "agent");
		const config = defaultApodexPiConfig();
		writeApodexPiAgentConfig(agentDir, config);
		const settingsPath = join(agentDir, "settings.json");
		const modelsPath = join(agentDir, "models.json");
		const nativeSettings = {
			defaultProvider: "new-provider",
			defaultModel: "new-model",
			defaultThinkingLevel: "high",
			enabledModels: ["new-provider/new-model:high"],
			theme: "research-ember",
		};
		writeFileSync(settingsPath, `${JSON.stringify(nativeSettings, null, 2)}\n`);
		writeFileSync(modelsPath, "{\"providers\":{\"new-provider\":{}}}\n");
		const modelsBefore = readFileSync(modelsPath, "utf8");
		writeApodexPiAgentConfig(agentDir, config, { coreVersion: "0.84.2" });
		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
		assert.equal(settings.defaultProvider, "new-provider");
		assert.equal(settings.defaultModel, "new-model");
		assert.equal(settings.defaultThinkingLevel, "high");
		assert.deepEqual(settings.enabledModels, ["new-provider/new-model:high"]);
		assert.equal(readFileSync(modelsPath, "utf8"), modelsBefore);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("config persistence creates a private v2 file and schema", () => {
	const root = mkdtempSync(join(tmpdir(), "apodex-pi-config-"));
	try {
		const configPath = join(root, "config.json");
		const config = ensureApodexPiConfig(configPath);
		assert.equal(config.version, 2);
		assert.equal(statSync(configPath).mode & 0o777, 0o600);
		assert.ok(statSync(join(root, "schemas", "apodex-pi-config.schema.json")).isFile());
		const changed = writeApodexPiConfig(configPath, { ...config, ui: { ...config.ui, density: "compact" } });
		assert.equal(readApodexPiConfig(configPath).ui.density, "compact");
		assert.equal(changed.ui.density, "compact");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("config exports runtime environment without a second Leader model selection", () => {
	const environment = apodexPiEnvironment(defaultApodexPiConfig());
	assert.equal(Object.hasOwn(environment, "APODEX_PI_ACTIVE_PROFILE"), false);
	assert.equal(environment.APODEX_PI_CODEX_ADVISOR_MODEL, "gpt-5.6-sol");
	assert.equal(environment.APODEX_PI_CODEX_RETENTION_DAYS, "30");
	assert.equal(environment.APODEX_PI_CODEX_KEEP_TERMINAL_JOBS, "200");
	assert.equal(environment.APODEX_PI_COMPACT_HARD_TOKENS, String(384 * 1024));
	assert.equal(environment.APODEX_PI_SEARCH_MODEL, "deepseek-v4-flash");
	assert.equal(environment.APODEX_PI_UI_DENSITY, "balanced");
});

test("legacy credential file support and native search are independent of Leader selection", () => {
	const config = defaultApodexPiConfig();
	assert.deepEqual(apodexPiCredentialEnvironmentNames(config).sort(), ["DEEPSEEK_API_KEY", "OPENCODE_API_KEY", "ZAI_API_KEY"]);
	assert.equal(apodexPiDeepSeekSearchEnabled(config, { OPENCODE_API_KEY: "go-key" }), false);
	assert.equal(apodexPiDeepSeekSearchEnabled(config, { DEEPSEEK_API_KEY: "ds-key" }), true);
	assert.equal(apodexPiDeepSeekSearchEnabled(resolveApodexPiConfig({ research: { search: { enabled: "off" } } }), {}), false);
	assert.throws(
		() => apodexPiDeepSeekSearchEnabled(resolveApodexPiConfig({ research: { search: { enabled: "on" } } }), {}),
		/DEEPSEEK_API_KEY is missing/,
	);
});

test("Codex, compact, and search modules consume the configured runtime environment", () => {
	const root = resolve(new URL("..", import.meta.url).pathname);
	const codex = pathToFileURL(join(root, ".pi", "lib", "codex-jobs.mjs")).href;
	const compact = pathToFileURL(join(root, ".pi", "lib", "research-compact.mjs")).href;
	const search = pathToFileURL(join(root, ".pi", "lib", "deepseek-web-search.mjs")).href;
	const script = `
		const codex = await import(${JSON.stringify(codex)});
		const compact = await import(${JSON.stringify(compact)});
		const search = await import(${JSON.stringify(search)});
		const parsed = search.parseDeepSeekWebSearchResponse({content:[{type:"web_search_tool_result",content:[1,2,3].map(i=>({type:"web_search_result",url:"https://example.com/"+i,title:"S"+i}))}]});
		console.log(JSON.stringify({advisor:codex.defaultCodexModel("advisor"),executor:codex.defaultCodexModel("executor"),effort:codex.defaultCodexReasoningEffort("advisor"),retentionDays:codex.DEFAULT_CODEX_RETENTION_DAYS,keepTerminal:codex.DEFAULT_CODEX_KEEP_TERMINAL_JOBS,soft:compact.RESEARCH_SOFT_COMPACT_TOKENS,hard:compact.RESEARCH_HARD_COMPACT_TOKENS,tail:compact.RESEARCH_RECENT_TAIL_SCHEDULE,summaryTarget:compact.RESEARCH_SUMMARY_TARGET_TOKENS,summaryMax:compact.RESEARCH_SUMMARY_MAX_TOKENS,sources:parsed.sources.length}));
	`;
	const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
		encoding: "utf8",
		env: {
			...process.env,
			APODEX_PI_CODEX_ADVISOR_MODEL: "gpt-advisor-configured",
			APODEX_PI_CODEX_EXECUTOR_MODEL: "gpt-executor-configured",
			APODEX_PI_CODEX_ADVISOR_EFFORT: "high",
			APODEX_PI_CODEX_RETENTION_DAYS: "17",
			APODEX_PI_CODEX_KEEP_TERMINAL_JOBS: "33",
			APODEX_PI_COMPACT_SOFT_TOKENS: "111",
			APODEX_PI_COMPACT_HARD_TOKENS: "222",
			APODEX_PI_COMPACT_RECENT_TAIL_TOKENS: "7,8",
			APODEX_PI_COMPACT_SUMMARY_TARGET_TOKENS: "9",
			APODEX_PI_COMPACT_SUMMARY_MAX_TOKENS: "18",
			APODEX_PI_SEARCH_MAX_SOURCES: "2",
		},
	});
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(JSON.parse(result.stdout), {
		advisor: "gpt-advisor-configured",
		executor: "gpt-executor-configured",
		effort: "high",
		retentionDays: 17,
		keepTerminal: 33,
		soft: 111,
		hard: 222,
		tail: [7, 8],
		summaryTarget: 9,
		summaryMax: 18,
		sources: 2,
	});
});

test("/config keeps Apodex Pi themes while exposing Pi Core model commands", async () => {
	const root = mkdtempSync(join(tmpdir(), "apodex-pi-config-ui-"));
	const previousPath = process.env.APODEX_PI_CONFIG_FILE;
	try {
		const configPath = join(root, "config.json");
		process.env.APODEX_PI_CONFIG_FILE = configPath;
		ensureApodexPiConfig(configPath);
		const commands = new Map();
		const handlers = new Map();
		const notices = [];
		let selectedTheme;
		let autocompleteFactory;
		const pi = {
			on(name, handler) { handlers.set(name, handler); },
			registerCommand(name, command) { commands.set(name, command); },
		};
		researchConfigExtension(pi);
		assert.equal(handlers.has("model_select"), false);
		assert.equal(handlers.has("thinking_level_select"), false);
		const ctx = {
			hasUI: true,
			ui: {
				getAllThemes: () => ["apodex-pi", "research-graphite", "research-ember", "dark", "light"].map((name) => ({ name })),
				setTheme(name) { selectedTheme = name; return { success: true }; },
				notify(message) { notices.push(message); },
				addAutocompleteProvider(factory) { autocompleteFactory = factory; },
			},
		};
		await commands.get("config").handler("", ctx);
		assert.match(notices.at(-1), /\/login/);
		assert.match(notices.at(-1), /\/model/);
		assert.match(notices.at(-1), /\/scoped-models/);
		assert.equal(autocompleteFactory, undefined);
		await commands.get("config").handler("theme research-graphite", ctx);
		assert.equal(selectedTheme, "research-graphite");
		assert.equal(readApodexPiConfig(configPath).pi.settings.theme, "research-graphite");
		await commands.get("config").handler("use old-profile", ctx);
		assert.match(notices.at(-1), /Usage:/);
	} finally {
		if (previousPath === undefined) delete process.env.APODEX_PI_CONFIG_FILE;
		else process.env.APODEX_PI_CONFIG_FILE = previousPath;
		rmSync(root, { recursive: true, force: true });
	}
	assert.equal(compactConfigPath("/Users/polaris/Documents/Utils/Pi/.pi/config.json"), "…/Utils/Pi/.pi/config.json");
	const themes = themeSelectItems(defaultApodexPiConfig());
	assert.match(themes[0].label, /^● Ocean/);
	assert.ok(themes.some((item) => item.value === "research-ember"));
});
