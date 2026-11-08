<script lang="ts">
	import type { Snippet } from 'svelte';
	import { sheetStack } from '$lib/sheets/history.svelte';

	/**
	 * What sits beside the map (spec 2026-11-08-map-walk): the tray at rest, a
	 * position's sheet when one is tapped, the walk while walking. On the phone a
	 * bottom sheet over the map's foot (the tray's height at rest, about 380 px with
	 * a position or a walk, scrolling inside); on the desktop a 320 px card floating
	 * over the map's right. `height` is its measured height, the room the map leaves
	 * at its foot on the phone.
	 *
	 * Not the app's `Sheet`: it is not modal, the map keeps taking taps while it is
	 * up. It uses the same history plumbing: while it holds a position or a walk it
	 * holds one entry (`sheetStack`), so Back calls `onclose` (back to the tray).
	 * Its owner closing it (Escape, a tap on empty space) goes back over the entry.
	 * `tryLeave` is asked first on Back: a walk with figures asks through Unsaved
	 * changes. Without it, Back always closes.
	 * A new position in place of the last keeps the same entry.
	 */
	let {
		mode,
		onclose,
		tryLeave,
		height = $bindable(0),
		children
	}: {
		mode: 'tray' | 'position' | 'walk';
		onclose: () => void;
		tryLeave?: (leave: () => void) => void;
		height?: number;
		children: Snippet;
	} = $props();

	const up = $derived(mode !== 'tray');

	/** The entry while up. Not state: nothing renders from it. */
	let key: number | null = null;

	$effect(() => {
		if (up && key === null) {
			key = sheetStack.open({
				// Read at Back's moment: the mode may have changed since the entry was made.
				tryLeave: (leave) => (tryLeave ? tryLeave(leave) : leave()),
				close: () => onclose()
			});
		}
		if (!up) release();
	});

	/** Closed by its owner, or unmounted while up: its entry goes too. */
	function release() {
		if (key === null) return;
		const k = key;
		key = null;
		sheetStack.closedByOwner(k);
	}
	$effect(() => release);
</script>

<div
	data-map-panel
	bind:offsetHeight={height}
	class="absolute inset-x-0 bottom-0 z-10 flex [scrollbar-width:none] flex-col gap-2.5 overflow-y-auto overscroll-contain rounded-t-[24px] bg-surface px-[18px] pt-2.5 pb-3.5 shadow-[0_-6px_24px_rgb(0_0_0/0.12)] *:shrink-0 desk:top-3 desk:right-3 desk:bottom-auto desk:left-auto desk:h-auto desk:max-h-[calc(100%-24px)] desk:w-[320px] desk:rounded-2xl desk:p-5 desk:shadow-[0_1px_2px_rgb(0_0_0/0.08),0_6px_20px_rgb(0_0_0/0.12)] {mode ===
	'walk'
		? 'h-[min(400px,62%)]'
		: up
			? 'h-[min(380px,62%)]'
			: ''}"
>
	<div
		aria-hidden="true"
		class="h-[5px] w-10 flex-none self-center rounded-full bg-track desk:hidden"
	></div>
	{@render children()}
</div>
