<script lang="ts">
	/**
	 * A toast that a swipe left or right takes away. The arithmetic is
	 * `$lib/gestures/dismiss`; this wires pointer events to it, draws the offset
	 * and the fade, and calls `ondismiss` once the toast is off.
	 *
	 * `onhold` says when a finger is on it (true) and when it lets go and the
	 * toast stays (false), so the owner's timer does not take it from under the
	 * finger. `key` is the toast's id: a new toast starts back at home.
	 *
	 * `touch-pan-y` leaves vertical movement to the page.
	 */
	import type { Snippet } from 'svelte';
	import { dismiss, fade, offscreen } from '$lib/gestures/dismiss';

	interface Props {
		key: number | string;
		ondismiss: () => void;
		onhold?: (held: boolean) => void;
		children: Snippet;
	}

	let { key, ondismiss, onhold, children }: Props = $props();

	const gesture = dismiss();
	let el: HTMLElement | undefined = $state();
	/** The live offset while a finger is on it; null at rest. */
	let tracking = $state<number | null>(null);
	/** Where it went when thrown off; null while it is here. */
	let gone = $state<number | null>(null);
	let width = 0;
	let held = false;
	let leaving: ReturnType<typeof setTimeout> | undefined;

	const x = $derived(gone ?? tracking ?? 0);

	$effect(() => {
		void key;
		tracking = null;
		gone = null;
		// A new toast, or this one gone: no finger holds its clock.
		return () => {
			clearTimeout(leaving);
			hold(false);
		};
	});

	function hold(on: boolean) {
		if (held === on) return;
		held = on;
		onhold?.(on);
	}

	function release(t: number) {
		const to = gesture.up(t);
		tracking = null;
		if (to === 'left' || to === 'right') {
			gone = offscreen(to, width);
			// Not on transitionend: reduced motion has no transition to end.
			leaving = setTimeout(() => {
				hold(false);
				ondismiss();
			}, 180);
		} else hold(false);
	}
</script>

<div
	bind:this={el}
	role="presentation"
	class="touch-pan-y select-none {tracking === null
		? 'transition-[transform,opacity] duration-200 motion-reduce:transition-none'
		: ''}"
	style:transform="translateX({x}px)"
	style:opacity={fade(x, width)}
	onpointerdown={(e) => {
		if (gone !== null || e.button !== 0) return;
		width = el?.offsetWidth ?? 0;
		gesture.down(e.clientX, e.clientY, e.timeStamp, width);
		hold(true);
	}}
	onpointermove={(e) => {
		const offset = gesture.move(e.clientX, e.clientY, e.timeStamp);
		if (offset === null) return;
		// Capture once it is a swipe, so a mouse dragged off the toast keeps it.
		if (tracking === null) e.currentTarget.setPointerCapture(e.pointerId);
		tracking = offset;
	}}
	onpointerup={(e) => release(e.timeStamp)}
	onpointercancel={() => {
		gesture.up(0);
		tracking = null;
		hold(false);
	}}
	onclickcapture={(e) => {
		// The click a swipe ends with must not also press Undo.
		if (gesture.swallow()) {
			e.stopPropagation();
			e.preventDefault();
		}
	}}
>
	{@render children()}
</div>
