<script lang="ts">
	/**
	 * A card that swipes sideways to reveal a button underneath: `end` (Delete)
	 * on the right, revealed by swiping left; `start` (Open) on the left,
	 * revealed by swiping right. The gesture arithmetic is `$lib/gestures/swipe`;
	 * this only wires pointer events to it and draws the offset.
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
		open: Side;
		onchange: (open: Side) => void;
		end?: Action;
		start?: Action;
		disabled?: boolean;
		rounded?: string;
		children: Snippet;
	}

	let {
		open,
		onchange,
		end,
		start,
		disabled = false,
		rounded = 'rounded-xl',
		children
	}: Props = $props();

	const REVEAL = 84;
	const gesture = swipe({
		reveal: REVEAL,
		lockPx: 10,
		snap: 0.4,
		sides: () => ({ left: end !== undefined, right: start !== undefined })
	});

	/** The live offset while a finger is on it; null at rest. */
	let tracking = $state<number | null>(null);
	const rest = $derived(open === 'left' ? -REVEAL : open === 'right' ? REVEAL : 0);
	const x = $derived(tracking ?? rest);
</script>

<div class="relative overflow-hidden {rounded}">
	{#if end && x < 0}
		<button
			type="button"
			class="absolute inset-y-0 right-0 bg-danger text-[13px] font-semibold text-white"
			style="width: {REVEAL}px"
			onclick={() => {
				onchange(null);
				end.onclick();
			}}>{end.label}</button
		>
	{/if}
	{#if start && x > 0}
		<button
			type="button"
			class="absolute inset-y-0 left-0 bg-accent text-[13px] font-semibold text-accent-ink"
			style="width: {REVEAL}px"
			onclick={() => {
				onchange(null);
				start.onclick();
			}}>{start.label}</button
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
