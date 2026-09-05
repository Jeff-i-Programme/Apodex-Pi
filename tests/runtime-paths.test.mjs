import assert from "node:assert/strict";
import test from "node:test";
import { resolveApodexPiPaths } from "../.pi/lib/runtime-paths.mjs";

test("development launcher keeps fast-iteration state in the checkout", () => {
	const paths = resolveApodexPiPaths({
		harnessRoot: "/workspace/Apodex-Pi",
		environment: { APODEX_PI_DEV_MODE: "1" },
		platform: "linux",
	});
	assert.equal(paths.development, true);
	assert.equal(paths.credentialsPath, "/workspace/Apodex-Pi/.env");
	assert.equal(paths.configPath, "/workspace/Apodex-Pi/.pi/config.json");
	assert.equal(paths.agentDir, "/workspace/Apodex-Pi/.pi/agent");
	assert.equal(paths.sessionDir, "/workspace/Apodex-Pi/.pi/sessions");
});

test("packaged launcher separates configuration and state from installed code", () => {
	const paths = resolveApodexPiPaths({
		harnessRoot: "/opt/node/lib/node_modules/apodex-pi",
		environment: {
			XDG_CONFIG_HOME: "/home/user/.config",
			XDG_STATE_HOME: "/home/user/.local/state",
		},
		platform: "linux",
	});
	assert.equal(paths.development, false);
	assert.equal(paths.credentialsPath, "/home/user/.config/apodex-pi/credentials.env");
	assert.equal(paths.configPath, "/home/user/.config/apodex-pi/config.json");
	assert.equal(paths.agentDir, "/home/user/.local/state/apodex-pi/agent");
	assert.equal(paths.sessionDir, "/home/user/.local/state/apodex-pi/sessions");
	assert.ok(!paths.stateRoot.startsWith(paths.harnessRoot));
});
