<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';

	/**
	 * Where does it end? — a slot's end chosen in the routine (spec 2026-11-11,
	 * slot end, board »Tap na čip konca«). One full-width button per end of the
	 * slot's main figure; one tap picks. An end an alternative cannot reach is
	 * greyed with why; one the slot below does not start in stays open, with a
	 * warning. `canClear`: something is chosen, and a quiet button at the foot
	 * takes it back.
	 */
	interface Choice {
		id: number;
		name: string;
		pressed: boolean;
		/** Why it cannot be chosen; null when it can. */
		why: string | null;
		/** What choosing it costs: the slot below does not start there. */
		warn: string | null;
	}

	let {
		open,
		figure,
		slot,
		choices,
		canClear,
		onpick,
		onclose
	}: {
		open: boolean;
		figure: string;
		slot: number;
		choices: Choice[];
		canClear: boolean;
		onpick: (id: number | null) => void;
		onclose: () => void;
	} = $props();
</script>

<Sheet
	{open}
	{onclose}
	title={t().routine.end.title}
	sub={t().routine.end.sub(figure, slot)}
	size="small"
>
	<div class="flex flex-col gap-2">
		{#each choices as c (c.id)}
			<button
				type="button"
				disabled={c.why !== null}
				aria-pressed={c.pressed}
				onclick={() => onpick(c.id)}
				class="flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] bg-surface px-4 py-2 text-left text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:bg-disabled-bg disabled:text-disabled-ink aria-pressed:bg-accent aria-pressed:text-on-accent"
			>
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[17px] leading-tight font-extrabold">{c.name}</span>
					{#if c.why}
						<span class="text-[12.5px] font-semibold">{c.why}</span>
					{:else if c.warn && !c.pressed}
						<span class="text-[12.5px] font-bold text-warn">{c.warn}</span>
					{/if}
				</span>
				{#if c.pressed}<Icon name="check" size={20} />{/if}
			</button>
		{/each}
	</div>
	{#if canClear}
		<button
			type="button"
			onclick={() => onpick(null)}
			class="mt-2 cursor-pointer py-2.5 text-[14px] font-bold text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
			>{t().routine.end.clear}</button
		>
	{/if}
</Sheet>
