/** Pace provider HTTP calls under a per-minute token budget. No-op unless env is set. */

const WINDOW_MS = 60_000;

export function providerRequestWaitMs(now, lastEnd, gapMs) {
	const gap = Number(gapMs);
	if (!Number.isFinite(gap) || gap <= 0) return 0;
	const wait = lastEnd + gap - now;
	return wait > 0 ? Math.ceil(wait) : 0;
}

export function estimateTokensFromPayload(payload) {
	try {
		const n = JSON.stringify(payload ?? "").length;
		return Math.max(0, Math.ceil(n / 4));
	} catch {
		return 0;
	}
}

export function waitMsForTokenWindow(now, stamps, nextTokens, limitPerMin) {
	const limit = Number(limitPerMin);
	const next = Math.max(0, Number(nextTokens) || 0);
	if (!Number.isFinite(limit) || limit <= 0) return 0;
	const recent = (Array.isArray(stamps) ? stamps : []).filter((item) => now - Number(item?.t) < WINDOW_MS);
	const used = recent.reduce((sum, item) => sum + Math.max(0, Number(item?.tokens) || 0), 0);
	if (used + next <= limit) return 0;
	const sorted = [...recent].sort((a, b) => Number(a.t) - Number(b.t));
	let remaining = used;
	for (const item of sorted) {
		remaining -= Math.max(0, Number(item.tokens) || 0);
		const wait = Number(item.t) + WINDOW_MS - now;
		if (remaining + next <= limit) return Math.max(0, Math.ceil(wait));
	}
	return WINDOW_MS;
}

export function combinedProviderWaitMs(now, lastEnd, gapMs, stamps, nextTokens, limitPerMin) {
	return Math.max(
		providerRequestWaitMs(now, lastEnd, gapMs),
		waitMsForTokenWindow(now, stamps, nextTokens, limitPerMin),
	);
}
