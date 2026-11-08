import { untrack } from 'svelte';
import { elapsedMs, followVisibility, STOPPED, type Stopwatch } from '$lib/exercises/stopwatch';

/**
 * The exercise page's time: counted from when the page mounted, only while it
 * is visible (a locked phone or a hidden tab adds nothing), and saved by Done
 * as `duration_s`. Nothing types it. Call during a component's init.
 *
 * `seconds` reads the wall clock when it is read, so the value taken at a tap
 * is exact; the 1 s tick, run only while the page is visible, is what redraws
 * the band. `restart()` counts again from 0 (another exercise opened in the
 * same page). `carried`: the time a trip to the player brought back
 * (`clock-trip.ts`), which this one goes on from; `watch` is what the page
 * leaves there when it opens the player.
 */
export function pageClock(carried: Stopwatch | null = null): {
	readonly seconds: number;
	readonly watch: Stopwatch;
	restart(): void;
} {
	let watch = $state<Stopwatch>(carried ?? STOPPED);
	/** Bumped by the tick, so a reader of `seconds` redraws once a second. */
	let beat = $state(0);

	const visible = () => document.visibilityState === 'visible';

	$effect(() => {
		let timer: ReturnType<typeof setInterval> | undefined;
		const follow = () => {
			// untrack: the effect runs once, at mount; `watch` and `beat` are its writes.
			untrack(() => {
				watch = followVisibility(watch, visible(), Date.now());
				beat++;
			});
			clearInterval(timer);
			timer = visible() ? setInterval(() => beat++, 1000) : undefined;
		};
		follow();
		document.addEventListener('visibilitychange', follow);
		return () => {
			document.removeEventListener('visibilitychange', follow);
			clearInterval(timer);
		};
	});

	return {
		get watch() {
			return { ...watch };
		},
		get seconds() {
			void beat;
			return Math.floor(elapsedMs(watch, Date.now()) / 1000);
		},
		restart() {
			watch = followVisibility(STOPPED, visible(), Date.now());
			beat++;
		}
	};
}
