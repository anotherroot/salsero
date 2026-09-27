<script lang="ts">
	import { untrack } from 'svelte';

	/**
	 * The handholds a figure can start from, as a compact picker: one dropdown
	 * that adds, and a removable chip per choice.
	 *
	 * It replaced a column of one checkbox per position, which ran to ten rows
	 * for salsa and pushed everything below it off a phone screen.
	 *
	 * **Key this component on the figure's id.** It seeds its own state from
	 * `initial` once, and SvelteKit reuses a component across a same-route
	 * navigation — so without a key, opening the next figure would show the
	 * previous one's tags. The key is what makes the seeding correct; the
	 * `untrack` only says that reading `initial` once is deliberate.
	 */
	let {
		positions,
		initial,
		neutralName
	}: {
		positions: { id: number; name: string; neutral: boolean; archived: boolean }[];
		initial: number[];
		neutralName: string;
	} = $props();

	let chosen = $state<number[]>(untrack(() => [...initial]));

	// An archived position already tagged stays chosen and posts back. Dropping it
	// would wipe the tag just for opening the page — a bug this form has had once
	// before — so only the "add" list filters archived ones out.
	const addable = $derived(positions.filter((p) => !p.archived && !chosen.includes(p.id)));
</script>

<div>
	<span class="text-[13px] font-medium">Starts from</span>

	{#each chosen as id (id)}
		<input type="hidden" name="startIds" value={id} />
	{/each}

	<div class="mt-1 flex flex-wrap items-center gap-1.5">
		{#each chosen as id (id)}
			{@const p = positions.find((o) => o.id === id)}
			<button
				type="button"
				onclick={() => (chosen = chosen.filter((o) => o !== id))}
				class="flex h-8 items-center gap-1.5 rounded-full bg-accent/15 pr-2 pl-3 text-[13px] font-medium text-accent"
			>
				{p?.name ?? `#${id}`}{p?.archived ? ' (archived)' : ''}
				<span aria-hidden="true" class="text-[15px] leading-none">×</span>
				<span class="sr-only">Remove</span>
			</button>
		{:else}
			<span class="text-[13px] text-muted">{neutralName}</span>
		{/each}
	</div>

	{#if addable.length > 0}
		<select
			aria-label="Add a start position"
			value=""
			onchange={(e) => {
				const id = Number(e.currentTarget.value);
				if (id) chosen = [...chosen, id];
				// Snap back to the placeholder so the same option can be re-picked
				// after a remove, and so the control never reads as a current value.
				e.currentTarget.value = '';
			}}
			class="mt-1.5 h-11 w-full rounded-xl border border-line bg-raised px-3 text-[15px]"
		>
			<option value="">Add a start position…</option>
			{#each addable as position (position.id)}
				<option value={position.id}>{position.name}</option>
			{/each}
		</select>
	{/if}
</div>
