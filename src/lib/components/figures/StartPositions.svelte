<script lang="ts">
	import { untrack } from 'svelte';
	import { focusAfterRemoval } from '$lib/focus';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { FIELD, LABEL } from '$lib/components/ui/styles';

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
		initial
	}: {
		positions: { id: number; name: string; archived: boolean }[];
		initial: number[];
	} = $props();

	let chosen = $state<number[]>(untrack(() => [...initial]));

	// An archived position already tagged stays chosen and posts back. Dropping it
	// would wipe the tag just for opening the page — a bug this form has had once
	// before — so only the "add" list filters archived ones out.
	const addable = $derived(positions.filter((p) => !p.archived && !chosen.includes(p.id)));
	const uid = $props.id();

	/** A chip is gone: focus goes to the next chip, else the dropdown that adds one. */
	function remove(id: number) {
		const keys = chosen.map((o) => `${uid}-start-${o}`);
		chosen = chosen.filter((o) => o !== id);
		void focusAfterRemoval(keys, `${uid}-start-${id}`, `${uid}-add`);
	}
</script>

<div>
	<span class={LABEL}>Starts from</span>

	{#each chosen as id (id)}
		<input type="hidden" name="startIds" value={id} />
	{/each}

	<div class="flex flex-wrap items-center gap-x-1.5">
		{#each chosen as id (id)}
			{@const p = positions.find((o) => o.id === id)}
			{@const name = `${p?.name ?? `#${id}`}${p?.archived ? ' (archived)' : ''}`}
			<button
				data-focus="{uid}-start-{id}"
				type="button"
				aria-label="Remove {name}"
				onclick={() => remove(id)}
				class="group flex h-11 flex-none cursor-pointer items-center rounded-full"
			>
				<span
					class="flex h-[34px] items-center gap-1 rounded-full bg-accent-soft pr-2 pl-3.5 text-[14px] font-bold text-accent-text group-active:brightness-95"
					>{name}<Icon name="close" size={16} /></span
				>
			</button>
		{:else}
			<span class="flex min-h-11 items-center pl-1 text-[14px] text-muted"
				>No position · fits anywhere</span
			>
		{/each}
	</div>

	{#if addable.length > 0}
		<div class="mt-1">
			<label class={LABEL} for="{uid}-add">Add a start position</label>
			<div class="relative">
				<select
					id="{uid}-add"
					data-focus="{uid}-add"
					aria-label="Add a start position"
					value=""
					onchange={(e) => {
						const id = Number(e.currentTarget.value);
						if (id) chosen = [...chosen, id];
						// Snap back to the placeholder so the same option can be re-picked
						// after a remove, and so the control never reads as a current value.
						e.currentTarget.value = '';
					}}
					class="own-arrow {FIELD} cursor-pointer appearance-none pr-10 text-muted"
				>
					<option value="">Choose a position…</option>
					{#each addable as position (position.id)}
						<option value={position.id}>{position.name}</option>
					{/each}
				</select>
				<span
					class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted"
					aria-hidden="true"><Icon name="chevron-down" size={20} /></span
				>
			</div>
		</div>
	{/if}
</div>
