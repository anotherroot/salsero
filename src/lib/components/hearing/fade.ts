/**
 * The music fading out as a spot slides away and in as the next one starts
 * (spec 1c.7). `audio.volume` is read-only on some phones (iOS): every set is
 * guarded, and there the cut stays. Reduced motion: no fade.
 */
export function fadeTo(audio: HTMLAudioElement, target: 0 | 1, ms = 400): Promise<void> {
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
			const k = Math.min(1, (now - start) / ms);
			set(from + (target - from) * k);
			if (k < 1) requestAnimationFrame(step);
			else done();
		};
		requestAnimationFrame(step);
	});
}
