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
 * same page).
 *
 * `idle`: created (or restarted) at 0 and not counting until `start()` — the
 * desktop's exercise Today opens by itself waits for a tap or key in its pane.
 * `start()` is idempotent, and does nothing to a clock already counting.
 */
export function pageClock(opts?: { idle?: boolean }): {
	readonly seconds: number;
	start(): void;
	restart(opts?: { idle?: boolean }): void;
} {
	let watch = $state<Stopwatch>(STOPPED);
	/** Bumped by the tick, so a reader of `seconds` redraws once a second. */
	let beat = $state(0);
	/** Waiting for `start()`: the watch stays stopped, whatever the page's visibility. */
	let idle = opts?.idle ?? false;

	const visible = () => document.visibilityState === 'visible';

	$effect(() => {
		let timer: ReturnType<typeof setInterval> | undefined;
		const follow = () => {
			// untrack: the effect runs once, at mount; `watch` and `beat` are its writes.
			untrack(() => {
				if (!idle) watch = followVisibility(watch, visible(), Date.now());
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
		get seconds() {
			void beat;
			return Math.floor(elapsedMs(watch, Date.now()) / 1000);
		},
		start() {
			if (!idle) return;
			idle = false;
			watch = followVisibility(STOPPED, visible(), Date.now());
			beat++;
		},
		restart(again) {
			idle = again?.idle ?? false;
			watch = idle ? STOPPED : followVisibility(STOPPED, visible(), Date.now());
			beat++;
		}
	};
}
