import assert from "node:assert/strict";
import test from "node:test";
import {
	combinedProviderWaitMs,
	estimateTokensFromPayload,
	providerRequestWaitMs,
	waitMsForTokenWindow,
} from "../.pi/lib/tpm-pace.mjs";

test("no wait when gap is unset or zero", () => {
	assert.equal(providerRequestWaitMs(1_000, 0, 0), 0);
	assert.equal(providerRequestWaitMs(1_000, 0, ""), 0);
	assert.equal(providerRequestWaitMs(1_000, 900, undefined), 0);
});

test("waits out the remaining gap after the previous response", () => {
	assert.equal(providerRequestWaitMs(10_000, 9_000, 5_000), 4_000);
	assert.equal(providerRequestWaitMs(15_000, 9_000, 5_000), 0);
});

test("token window waits until the rolling minute has room", () => {
	assert.ok(estimateTokensFromPayload({ messages: [{ content: "abcd".repeat(20) }] }) > 10);
	assert.equal(waitMsForTokenWindow(60_000, [{ t: 1_000, tokens: 40_000 }], 10_000, 100_000), 0);
	assert.equal(waitMsForTokenWindow(60_000, [{ t: 10_000, tokens: 90_000 }], 20_000, 100_000), 10_000);
	assert.equal(
		combinedProviderWaitMs(60_000, 50_000, 5_000, [{ t: 10_000, tokens: 90_000 }], 20_000, 100_000),
		10_000,
	);
	assert.equal(waitMsForTokenWindow(60_000, [], 10_000, 0), 0);
});
