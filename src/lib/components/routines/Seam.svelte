<script lang="ts">
	/**
	 * Between two rows that do not connect — in the hands or on the count — a
	 * warn box saying what is missing, with the two ways to build: After {above}
	 * builds down from the slot above, Before {below} up into the slot below. A
	 * seam that connects draws nothing at all, so an unfinished routine shows
	 * exactly where the work is.
	 *
	 * Bridge closes the gap in one step: figures that fit BOTH slots. Only drawn
	 * when there is such a figure — a button that opens an empty list is a
	 * promise the page cannot keep.
	 */
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	interface Props {
		label: string;
		/** 1-based numbers of the slots either side, for the buttons' names. */
		above: number;
		below: number;
		onafter: () => void;
		onbefore: () => void;
		/** Present only when something fits both sides. */
		onbetween?: () => void;
	}

	let { label, above, below, onafter, onbefore, onbetween }: Props = $props();
</script>

{#snippet pill(
	text: string,
	icon: IconName,
	name: string,
	onclick: () => void,
	primary: boolean = false
)}
	<!-- 44 px to tap, a 36 px pill to see. -->
	<button
		type="button"
		class="flex h-11 flex-none cursor-pointer items-center"
		aria-label={name}
		{onclick}
	>
		<span
			class="flex h-9 items-center gap-1.5 rounded-[18px] pr-3.5 pl-2.5 text-[14px] font-extrabold whitespace-nowrap {primary
				? 'bg-accent text-on-accent'
				: 'bg-surface text-accent-text'}"><Icon name={icon} size={18} />{text}</span
		>
	</button>
{/snippet}

<div
	role="group"
	aria-label="Slots {above} and {below} do not connect"
	class="flex flex-col gap-0.5 rounded-[14px] border-l-[3px] border-warn bg-warn-soft pt-2.5 pr-2.5 pb-1 pl-3"
>
	<p class="flex items-start gap-[7px] text-[13px] leading-[1.35] font-bold text-warn">
		<span class="mt-px flex-none"><Icon name="warning" size={16} /></span>{label}
	</p>
	<div class="flex flex-wrap gap-1.5">
		{@render pill(`After ${above}`, 'arrow-down', `Add after slot ${above}`, onafter)}
		{@render pill(`Before ${below}`, 'arrow-up', `Add before slot ${below}`, onbefore)}
		{#if onbetween}
			{@render pill(
				'Bridge',
				'plus',
				`Add between slot ${above} and slot ${below}`,
				onbetween,
				true
			)}
		{/if}
	</div>
</div>
