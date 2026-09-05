import assert from "node:assert/strict";
import test from "node:test";
import { resolveApodexPiPaths } from "../.pi/lib/runtime-paths.mjs";

test("development launcher keeps fast-iteration state in the checkout", () => {
	const paths = resolveApodexPiPaths({
		harnessRoot: "/workspace/Apodex_Pi",
		environment: { APODEX_PI_DEV_MODE: "1" },
		platform: "linux",
	});
	assert.equal(paths.development, true);
	assert.equal(paths.credentialsPath, "/workspace/Apodex_Pi/.env");
	assert.equal(paths.configPath, "/workspace/Apodex_Pi/.pi/config.json");
	assert.equal(paths.agentDir, "/workspace/Apodex_Pi/.pi/agent");
	assert.equal(paths.sessionDir, "/workspace/Apodex_Pi/.pi/sessions");
});

test("packaged launcher separates configuration and state from installed code", () => {
	const paths = resolveApodexPiPaths({
		harnessRoot: "/opt/node/lib/node_modules/apodex_pi",
		environment: {
			XDG_CONFIG_HOME: "/home/user/.config",
			XDG_STATE_HOME: "/home/user/.local/state",
		},
		platform: "linux",
	});
	assert.equal(paths.development, false);
	assert.equal(paths.credentialsPath, "/home/user/.config/apodex_pi/credentials.env");
	assert.equal(paths.configPath, "/home/user/.config/apodex_pi/config.json");
	assert.equal(paths.agentDir, "/home/user/.local/state/apodex_pi/agent");
	assert.equal(paths.sessionDir, "/home/user/.local/state/apodex_pi/sessions");
	assert.ok(!paths.stateRoot.startsWith(paths.harnessRoot));
});
