/**
 * The music fading out as a spot slides away and in as the next one starts
 * (spec 1c.7). `audio.volume` is read-only on some phones (iOS): every set is
 * guarded, and there the cut stays. Reduced motion: no fade.
 */
/** The newest fade per element: an older one still running stops (no flutter, no fade-out after a fade-in). */
const newest = new WeakMap<HTMLAudioElement, number>();
let fades = 0;

export function fadeTo(audio: HTMLAudioElement, target: 0 | 1, ms = 400): Promise<void> {
	const mine = ++fades;
	newest.set(audio, mine);
	const set = (v: number) => {
		try {
			audio.volume = Math.max(0, Math.min(1, v));
		} catch {
			// Read-only here: the music cuts instead of fading.
		}
	};
	const reduce =
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	if (reduce || typeof requestAnimationFrame === 'undefined') {
		set(target);
		return Promise.resolve();
	}
	const from = audio.volume;
	const start = performance.now();
	return new Promise((done) => {
		const step = (now: number) => {
			if (newest.get(audio) !== mine) return done();
			const k = Math.min(1, (now - start) / ms);
			set(from + (target - from) * k);
			if (k < 1) requestAnimationFrame(step);
			else done();
		};
		requestAnimationFrame(step);
	});
}

/** Full volume now, stopping any fade: a new round or a replay always starts loud. */
export function fullVolume(audio: HTMLAudioElement): void {
	newest.set(audio, ++fades);
	try {
		audio.volume = 1;
	} catch {
		// Read-only volume: it is at full anyway.
	}
}
