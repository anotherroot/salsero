<script lang="ts">
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { filterRows } from '$lib/figures/page';
	import {
		fromMeta,
		intoMeta,
		newFigureLabel,
		relationRows,
		relationTitle,
		throughMeta,
		type PositionRelation
	} from '$lib/positions/view';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';

	type FromRow = { id: number; label: string; ends: string[]; team: string | null };
	type IntoRow = { id: number; label: string; starts: string[]; team: string | null };
	type RoutineRow = { id: number; name: string; pairs: [number, number][] };

	/**
	 * Figures from here, Figures into here and In routines (as the figure page's
	 * RelationsCard): three rows with their counts, each opening a sheet with
	 * search. They grow with use, so the page never draws them in full. The two
	 * figure sheets carry New in their title row where a figure may take the
	 * position (`newFrom` / `newInto`).
	 */
	let {
		name,
		from,
		into,
		routines,
		newFrom,
		newInto,
		figureHref,
		routineHref
	}: {
		/** The position's name, for New's label. */
		name: string;
		from: FromRow[];
		into: IntoRow[];
		routines: RoutineRow[];
		/** New figure from here (`?new=1&start=`), or null where none may be made. */
		newFrom: string | null;
		newInto: string | null;
		figureHref: (id: number) => string;
		routineHref: (id: number) => string;
	} = $props();

	const rows = $derived(
		relationRows({ from: from.length, into: into.length, routines: routines.length })
	);

	let opened = $state<PositionRelation | null>(null);
	let q = $state('');
	/** Kept while the sheet closes, so its title and list do not blank mid-animation. */
	let shown = $state<PositionRelation>('from');

	const named = <T extends { label: string }>(xs: T[]) => xs.map((x) => ({ ...x, name: x.label }));
	const figures = $derived(
		shown === 'into'
			? filterRows(named(into), q).map((f) => ({ id: f.id, name: f.name, meta: intoMeta(f) }))
			: filterRows(named(from), q).map((f) => ({ id: f.id, name: f.name, meta: fromMeta(f) }))
	);
	const routineRows = $derived(filterRows(routines, q));
	const count = $derived(
		shown === 'routines' ? routines.length : (shown === 'into' ? into : from).length
	);
	const newHref = $derived(shown === 'from' ? newFrom : shown === 'into' ? newInto : null);

	function openSheet(key: PositionRelation) {
		q = '';
		shown = key;
		opened = key;
	}

	function go(href: string) {
		opened = null;
		void gotoWhenSettled(href);
	}
</script>

<!-- tabindex: where focus lands when an Unlink leaves nothing else to take it (`unlinkFocus`). -->
<ul
	class={GROUP}
	aria-label="Figures and routines through this position"
	tabindex="-1"
	data-focus="relations"
>
	{#each rows as row (row.key)}
		<li>
			{#if row.opens}
				<button
					type="button"
					aria-haspopup="dialog"
					class="flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 py-2 pr-3.5 pl-4 text-left"
					onclick={() => openSheet(row.key)}
				>
					<span class="min-w-0 flex-1 text-[16px] leading-tight font-bold text-ink"
						>{row.label}</span
					>
					<span class="text-[16px] font-bold text-muted tabular-nums">{row.count}</span>
					<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
				</button>
			{:else}
				<div class="flex min-h-[52px] items-center gap-2.5 py-2 pr-3.5 pl-4">
					<span class="min-w-0 flex-1 text-[16px] leading-tight font-bold text-ink"
						>{row.label}</span
					>
					<span class="text-[16px] font-bold text-muted">{row.count}</span>
				</div>
			{/if}
		</li>
	{/each}
</ul>

{#snippet row(href: string, title: string, meta: string)}
	<a
		{href}
		class="flex min-h-[60px] items-center gap-2.5 py-2 pr-3.5 pl-4"
		onclick={(e) => {
			e.preventDefault();
			go(href);
		}}
	>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] leading-tight font-bold text-ink">{title}</span>
			{#if meta}<span class="text-[13px] text-muted">{meta}</span>{/if}
		</span>
		<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
{/snippet}

<Sheet title={relationTitle(shown, count)} open={opened !== null} onclose={() => (opened = null)}>
	{#snippet actions()}
		{#if newHref && shown !== 'routines'}
			{@const target = newHref}
			<a
				href={target}
				class={button('tertiary', 'sm')}
				aria-label={newFigureLabel(shown, name)}
				onclick={(e) => {
					e.preventDefault();
					go(target);
				}}><Icon name="plus" size={18} />New</a
			>
		{/if}
	{/snippet}
	<div class="flex flex-col gap-3">
		<SearchField
			bind:value={q}
			placeholder={shown === 'routines' ? 'Search routines' : 'Search figures'}
			label={shown === 'routines' ? 'Search routines' : 'Search figures'}
		/>
		{#if shown === 'routines'}
			{#if routineRows.length === 0}
				<p class="px-4 py-3 text-[15px] text-muted">No routine matches.</p>
			{:else}
				<ul class={GROUP}>
					{#each routineRows as r (r.id)}
						<li>{@render row(routineHref(r.id), r.name, throughMeta(r.pairs))}</li>
					{/each}
				</ul>
			{/if}
		{:else if figures.length === 0}
			<p class="px-4 py-3 text-[15px] text-muted">No figure matches.</p>
		{:else}
			<ul class={GROUP}>
				{#each figures as f (f.id)}
					<li>{@render row(figureHref(f.id), f.name, f.meta)}</li>
				{/each}
			</ul>
		{/if}
	</div>
</Sheet>
