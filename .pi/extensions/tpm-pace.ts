import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	combinedProviderWaitMs,
	estimateTokensFromPayload,
} from "../lib/tpm-pace.mjs";

export default function (pi: ExtensionAPI) {
	let lastEnd = 0;
	let pendingTokens = 0;
	const stamps: { t: number; tokens: number }[] = [];
	pi.on("before_provider_request", async (event) => {
		pendingTokens = estimateTokensFromPayload(event?.payload);
		const wait = combinedProviderWaitMs(
			Date.now(),
			lastEnd,
			process.env.RESEARCH_PI_TPM_GAP_MS,
			stamps,
			pendingTokens,
			process.env.RESEARCH_PI_TPM_LIMIT,
		);
		if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
	});
	pi.on("after_provider_response", (event) => {
		lastEnd = Date.now();
		const status = Number(event?.status);
		stamps.push({
			t: lastEnd,
			tokens: status === 429 ? Math.max(pendingTokens, 1) : pendingTokens,
		});
		if (stamps.length > 80) stamps.splice(0, stamps.length - 80);
		if (status === 429) {
			stamps.push({ t: lastEnd, tokens: Number(process.env.RESEARCH_PI_TPM_LIMIT) || 100_000 });
		}
	});
}
