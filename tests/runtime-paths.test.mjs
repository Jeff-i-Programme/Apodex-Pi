import assert from "node:assert/strict";
import test from "node:test";
import { resolveProbelabPaths } from "../.pi/lib/runtime-paths.mjs";

test("development launcher keeps fast-iteration state in the checkout", () => {
	const paths = resolveProbelabPaths({
		harnessRoot: "/workspace/Probelab",
		environment: { PROBELAB_DEV_MODE: "1" },
		platform: "linux",
	});
	assert.equal(paths.development, true);
	assert.equal(paths.credentialsPath, "/workspace/Probelab/.env");
	assert.equal(paths.configPath, "/workspace/Probelab/.pi/config.json");
	assert.equal(paths.agentDir, "/workspace/Probelab/.pi/agent");
	assert.equal(paths.sessionDir, "/workspace/Probelab/.pi/sessions");
});

test("packaged launcher separates configuration and state from installed code", () => {
	const paths = resolveProbelabPaths({
		harnessRoot: "/opt/node/lib/node_modules/probelab",
		environment: {
			XDG_CONFIG_HOME: "/home/user/.config",
			XDG_STATE_HOME: "/home/user/.local/state",
		},
		platform: "linux",
	});
	assert.equal(paths.development, false);
	assert.equal(paths.credentialsPath, "/home/user/.config/probelab/credentials.env");
	assert.equal(paths.configPath, "/home/user/.config/probelab/config.json");
	assert.equal(paths.agentDir, "/home/user/.local/state/probelab/agent");
	assert.equal(paths.sessionDir, "/home/user/.local/state/probelab/sessions");
	assert.ok(!paths.stateRoot.startsWith(paths.harnessRoot));
});

test("legacy APODEX_PI_* environment names alias to PROBELAB_*", () => {
	const paths = resolveProbelabPaths({
		harnessRoot: "/workspace/Probelab",
		environment: { APODEX_PI_DEV_MODE: "1" },
		platform: "linux",
	});
	assert.equal(paths.development, true);
	assert.equal(paths.configPath, "/workspace/Probelab/.pi/config.json");
});
