<script lang="ts">
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import {
		filterRows,
		relationRows,
		relationTitle,
		routineUseMeta,
		sortRoutines,
		type RelationKey
	} from '$lib/figures/page';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import type { RoutineUse } from '$lib/routines/coverage';
	import { t } from '$lib/i18n/catalog';

	/**
	 * Follows from, Leads to and In routines (figure page rework, option B2):
	 * three rows with their counts, each opening a sheet with search. They grow
	 * with use, so the page never draws them in full.
	 */
	let {
		follows,
		leads,
		routines,
		mine,
		mineLabel,
		figureHref,
		routineHref
	}: {
		follows: { id: number; name: string }[];
		leads: { id: number; name: string }[];
		/** The routines in the figure's own space. */
		routines: RoutineUse[];
		/** The person's own routines using a group's figure ("In your routines"). */
		mine: RoutineUse[];
		/** The group's name when `mine` sits beside a group's routines, else null. */
		mineLabel: string | null;
		figureHref: (id: number) => string;
		routineHref: (id: number) => string;
	} = $props();

	const rows = $derived(
		relationRows({
			follows: follows.length,
			leads: leads.length,
			routines: routines.length + mine.length
		})
	);

	let opened = $state<RelationKey | null>(null);
	let q = $state('');
	/** Kept while the sheet closes, so its title and list do not blank mid-animation. */
	let shown = $state<RelationKey>('follows');

	const figures = $derived(filterRows(shown === 'leads' ? leads : follows, q));
	const groupRoutines = $derived(sortRoutines(filterRows(routines, q)));
	const myRoutines = $derived(sortRoutines(filterRows(mine, q)));
	const count = $derived(
		shown === 'routines'
			? routines.length + mine.length
			: (shown === 'leads' ? leads : follows).length
	);

	function openSheet(key: RelationKey) {
		q = '';
		shown = key;
		opened = key;
	}

	function go(href: string) {
		opened = null;
		void gotoWhenSettled(href);
	}
</script>

<ul class={GROUP} aria-label={t().figure.relations.label}>
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

{#snippet routineList(list: RoutineUse[])}
	<ul class={GROUP}>
		{#each list as use (use.id)}
			<li>
				<a
					href={routineHref(use.id)}
					class="flex min-h-[60px] items-center gap-2.5 py-2 pr-3.5 pl-4"
					onclick={(e) => {
						e.preventDefault();
						go(routineHref(use.id));
					}}
				>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-[16px] leading-tight font-bold text-ink">{use.name}</span>
						<span class="text-[13px] text-muted"
							>{routineUseMeta(use)}{#if use.loops}
								· <span class="font-bold text-done">{t().figure.relations.loops}</span>{/if}</span
						>
					</span>
					<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
				</a>
			</li>
		{/each}
	</ul>
{/snippet}

<Sheet title={relationTitle(shown, count)} open={opened !== null} onclose={() => (opened = null)}>
	<div class="flex flex-col gap-3">
		<SearchField
			bind:value={q}
			placeholder={shown === 'routines'
				? t().figure.relations.searchRoutines
				: t().figure.relations.searchFigures}
			label={shown === 'routines'
				? t().figure.relations.searchRoutines
				: t().figure.relations.searchFigures}
		/>
		{#if shown === 'routines'}
			{#if groupRoutines.length + myRoutines.length === 0}
				<p class="px-4 py-3 text-[15px] text-muted">{t().figure.relations.noRoutine}</p>
			{:else if mineLabel !== null}
				{#if groupRoutines.length > 0}
					<h3 class={SECTION_LABEL}>{mineLabel}</h3>
					{@render routineList(groupRoutines)}
				{/if}
				{#if myRoutines.length > 0}
					<h3 class={SECTION_LABEL}>{t().moves.heading.yours}</h3>
					{@render routineList(myRoutines)}
				{/if}
			{:else}
				{@render routineList(sortRoutines([...groupRoutines, ...myRoutines]))}
			{/if}
		{:else if figures.length === 0}
			<p class="px-4 py-3 text-[15px] text-muted">{t().figure.relations.noFigure}</p>
		{:else}
			<ul class={GROUP}>
				{#each figures as item (item.id)}
					<li>
						<a
							href={figureHref(item.id)}
							class="flex min-h-12 items-center gap-2.5 py-2 pr-3.5 pl-4"
							onclick={(e) => {
								e.preventDefault();
								go(figureHref(item.id));
							}}
						>
							<span class="min-w-0 flex-1 text-[16px] leading-tight font-bold text-ink"
								>{item.name}</span
							>
							<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</Sheet>
