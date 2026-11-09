/**
 * In-memory rate limits for the connector's open endpoints (one node process
 * serves both hosts). Keyed by client address. Lost on restart, which only
 * forgives.
 */

type Window = { from: number; count: number };

function limiter(windowMs: number, max: number) {
	const seen = new Map<string, Window>();
	const live = (key: string, now: number): Window | null => {
		const w = seen.get(key);
		if (!w || now - w.from >= windowMs) return null;
		return w;
	};
	return {
		over: (key: string, now: number) => (live(key, now)?.count ?? 0) >= max,
		count: (key: string, now: number) => {
			const w = live(key, now);
			if (w) w.count++;
			else seen.set(key, { from: now, count: 1 });
			if (seen.size > 10_000) {
				for (const [k, v] of seen) if (now - v.from >= windowMs) seen.delete(k);
			}
		},
		reset: () => seen.clear()
	};
}

/** Failed token requests: 30 per address per 15 minutes. Only failures count. */
export const tokenFailures = limiter(15 * 60_000, 30);
/** Registrations: 20 per address per hour. */
export const registrations = limiter(60 * 60_000, 20);

/** For specs. */
export function resetOAuthLimits() {
	tokenFailures.reset();
	registrations.reset();
}
