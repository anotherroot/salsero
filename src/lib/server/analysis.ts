/** Validate the worker's analysis payload before it touches the database. Pure. */

/** ~55 minutes of beats at 360 BPM — far past any song we accept (15 min). */
const MAX_TIMES = 20_000;

function times(v: unknown, name: string): number[] | string {
	if (!Array.isArray(v) || !v.every((x) => typeof x === 'number' && Number.isFinite(x) && x >= 0)) {
		return `${name} must be an array of non-negative numbers`;
	}
	if (v.length > MAX_TIMES) return `too many ${name}`;
	for (let i = 1; i < v.length; i++) if (v[i] < v[i - 1]) return `${name} must be ascending`;
	return v as number[];
}

export function parseAnalysis(
	body: unknown
): { beats: number[]; downbeats: number[]; durationS: number } | string {
	if (typeof body !== 'object' || body === null) return 'body must be an object';
	const b = body as Record<string, unknown>;
	const beats = times(b.beats, 'beats');
	if (typeof beats === 'string') return beats;
	if (beats.length === 0) return 'no beats found';
	const downbeats = times(b.downbeats, 'downbeats');
	if (typeof downbeats === 'string') return downbeats;
	const durationS = b.durationS;
	if (typeof durationS !== 'number' || !Number.isFinite(durationS) || durationS <= 0) {
		return 'durationS must be a positive number';
	}
	return { beats, downbeats, durationS };
}
