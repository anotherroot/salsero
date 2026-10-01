<script lang="ts">
	/**
	 * A card that swipes left to reveal a button underneath it: `end` (Delete).
	 * Left only — a right swipe did nothing worth the accidental triggers. The
	 * gesture arithmetic is `$lib/gestures/swipe`; this only wires pointer
	 * events to it and draws the offset.
	 *
	 * `touch-pan-y` hands vertical movement to the browser, so the page still
	 * scrolls from a card; only a horizontal move becomes a swipe.
	 */
	import type { Snippet } from 'svelte';
	import { swipe, type Side } from '$lib/gestures/swipe';

	interface Action {
		label: string;
		onclick: () => void;
	}

	interface Props {
		/** This card's `Swiped` key, on the DOM as `data-swipe` so a tap elsewhere can tell it apart. */
		key: string;
		open: Side;
		onchange: (open: Side) => void;
		end?: Action;
		disabled?: boolean;
		rounded?: string;
		children: Snippet;
	}

	let {
		key,
		open,
		onchange,
		end,
		disabled = false,
		rounded = 'rounded-xl',
		children
	}: Props = $props();

	const REVEAL = 84;
	const gesture = swipe({
		reveal: REVEAL,
		lockPx: 10,
		snap: 0.4,
		sides: () => ({ left: end !== undefined, right: false })
	});

	/** The live offset while a finger is on it; null at rest. */
	let tracking = $state<number | null>(null);
	const rest = $derived(open === 'left' ? -REVEAL : 0);
	const x = $derived(tracking ?? rest);
</script>

<div class="relative overflow-hidden {rounded}" data-swipe={key}>
	{#if end && x < 0}
		<!--
			Red under the WHOLE card, not just the button's strip: the card's
			rounded right corners would otherwise show the page through them, and
			the red would look cut off behind the curve. The container's own
			rounding clips it to the card's shape.
		-->
		<div class="absolute inset-0 bg-danger" aria-hidden="true"></div>
		<button
			type="button"
			class="absolute inset-y-0 right-0 text-[13px] font-semibold text-white"
			style="width: {REVEAL}px"
			onclick={() => {
				onchange(null);
				end.onclick();
			}}>{end.label}</button
		>
	{/if}
	<div
		role="presentation"
		class="relative touch-pan-y {tracking === null
			? 'transition-transform duration-200 motion-reduce:transition-none'
			: ''}"
		style="transform: translateX({x}px)"
		onpointerdown={(e) => {
			if (!disabled && e.button === 0) gesture.down(e.clientX, e.clientY, open);
		}}
		onpointermove={(e) => {
			const offset = gesture.move(e.clientX, e.clientY);
			if (offset === null) return;
			// Capture once it is a swipe, so a mouse dragged off the card keeps it.
			if (tracking === null) e.currentTarget.setPointerCapture(e.pointerId);
			tracking = offset;
		}}
		onpointerup={() => {
			const to = gesture.up();
			tracking = null;
			if (to !== undefined) onchange(to);
		}}
		onpointercancel={() => {
			gesture.up();
			tracking = null;
		}}
		onclickcapture={(e) => {
			// The click a swipe ends with must not also tap the card.
			if (gesture.swallow()) {
				e.stopPropagation();
				e.preventDefault();
			}
		}}
	>
		{@render children()}
	</div>
</div>
