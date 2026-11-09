<script lang="ts">
	import type { Snippet } from 'svelte';
	import { claimBottom, pinBar } from '$lib/nav/chrome.svelte';
	import { PAGE_WIDTH, type PageWidth } from '$lib/nav/frame';

	/**
	 * Pinned to the bottom of a page. `fade`: no border, the page scrolls under a fade. Callers add `pb-28` to their scroll content.
	 *
	 * Without `mode` it sits above the tab bar when one shows (`--pin-bottom`, set by
	 * the layout; 0 where there is none). With `mode` (an edit's Save) it takes the
	 * bottom edge and the tab bar steps aside while it is mounted.
	 *
	 * `card`: on a card page (`CardFrame`) the desktop has no bottom to pin to; the bar
	 * sits at the foot of the card instead, part of its content. The phone pins it as ever.
	 */
	let {
		children,
		fade = false,
		mode = false,
		width = 'one',
		card = false,
		class: extra = ''
	}: {
		children: Snippet;
		fade?: boolean;
		mode?: boolean;
		width?: PageWidth;
		card?: boolean;
		class?: string;
	} = $props();

	claimBottom(() => mode);
	// A layout's toast (SavedToast) sits above it, and the offline strip above its height.
	let height = $state(0);
	pinBar(() => height);

	// The phone's foot padding, written as a class on a card page so the desktop can drop it
	// (an inline style would outrank it). Its value is the inline style's.
	const pad = $derived(
		`calc(12px + ${mode ? 'var(--safe-bottom)' : 'var(--pin-safe, var(--safe-bottom))'})`
	);
</script>

<div
	class="{extra} fixed inset-x-0 z-20 px-4 desk:left-(--pane-left) {fade
		? 'bg-linear-to-b from-ground/0 to-ground to-[34%] pt-7'
		: 'border-t border-hairline bg-ground pt-3'} {card
		? 'pb-(--bar-pb) desk:static desk:z-auto desk:border-0 desk:bg-transparent desk:bg-none desk:p-0'
		: ''}"
	style:--bar-w="{PAGE_WIDTH[width]}px"
	style:--bar-pb={card ? pad : undefined}
	style:bottom={mode ? '0px' : 'var(--pin-bottom, 0px)'}
	style:padding-bottom={card ? undefined : pad}
	bind:offsetHeight={height}
>
	<div class="mx-auto max-w-[560px] desk:max-w-(--bar-w)">{@render children()}</div>
</div>
