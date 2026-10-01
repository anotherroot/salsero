<script lang="ts">
	/**
	 * Between two rows that do not connect — in the hands or on the count — a
	 * red line with the two ways to build: ↓+ down from the slot above, ↑+ up
	 * into the slot below. A seam that connects draws nothing at all, so an
	 * unfinished routine shows exactly where the work is.
	 */
	interface Props {
		label: string;
		/** 1-based numbers of the slots either side, for the buttons' names. */
		above: number;
		below: number;
		onafter: () => void;
		onbefore: () => void;
	}

	let { label, above, below, onafter, onbefore }: Props = $props();

	const button =
		'relative h-8 rounded-full border-[1.5px] border-danger bg-plane px-3 text-[12px] font-semibold text-danger';
</script>

<div class="pt-1.5">
	<div class="relative flex items-center justify-center gap-3">
		<span class="absolute inset-x-2 top-1/2 border-t-2 border-danger/50" aria-hidden="true"></span>
		<button type="button" class={button} onclick={onafter} aria-label="Add after slot {above}"
			>↓+</button
		>
		<button type="button" class={button} onclick={onbefore} aria-label="Add before slot {below}"
			>↑+</button
		>
	</div>
	<p class="mt-1 text-center text-[11px] text-danger">{label}</p>
</div>
