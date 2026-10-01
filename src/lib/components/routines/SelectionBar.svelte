<script lang="ts">
	/**
	 * The long-press selection's actions. A greyed action still takes a tap — to
	 * say why it is greyed, which a disabled button could not.
	 */
	interface Props {
		count: number;
		/** Why Make routine cannot run, or null when it can. */
		extractBlocked: string | null;
		onabove: () => void;
		onbelow: () => void;
		onduplicate: () => void;
		onextract: () => void;
		ondelete: () => void;
	}

	let { count, extractBlocked, onabove, onbelow, onduplicate, onextract, ondelete }: Props =
		$props();

	let hint = $state<string | null>(null);
	// A reason belongs to the selection it was given for: tapping a second slot
	// makes "Select one slot…" stale, and the bar should not keep saying it.
	$effect(() => {
		void count;
		void extractBlocked;
		hint = null;
	});
	const oneOnly = $derived(count === 1 ? null : 'Select one slot to add next to it.');

	const run = (why: string | null, action: () => void) => () => {
		hint = why;
		if (why === null) action();
	};
</script>

{#snippet item(label: string, icon: string, why: string | null, action: () => void, danger = false)}
	<!-- Five across a phone: a long label wraps to two lines rather than squeezing. -->
	<button
		type="button"
		aria-disabled={why !== null}
		class="flex flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-center text-[11px] leading-tight {why
			? 'opacity-40'
			: ''} {danger ? 'text-danger' : 'text-ink'}"
		onclick={run(why, action)}
		><span class="text-[17px] leading-none" aria-hidden="true">{icon}</span><span>{label}</span
		></button
	>
{/snippet}

<div
	class="fixed inset-x-0 z-30 mx-auto max-w-[560px] border-t border-line bg-surface/95 px-2 py-2 backdrop-blur"
	style="bottom: calc(4.5rem + env(safe-area-inset-bottom))"
>
	{#if hint}
		<p class="px-2 pb-1.5 text-[12px] text-ink-2" role="status">{hint}</p>
	{/if}
	<div class="grid grid-cols-5 gap-1">
		{@render item('Add above', '↑+', oneOnly, onabove)}
		{@render item('Add below', '↓+', oneOnly, onbelow)}
		{@render item('Duplicate', '⧉', null, onduplicate)}
		{@render item('Make routine', '↻', extractBlocked, onextract)}
		{@render item('Delete', '🗑', null, ondelete, true)}
	</div>
</div>
