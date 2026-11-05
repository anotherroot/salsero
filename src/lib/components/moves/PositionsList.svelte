<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { keepFilter, keptFilter } from '$lib/nav/trail.svelte';
	import { revealLit } from './moves-context';
	import { desk } from '$lib/nav/desk.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import PositionRow from '$lib/components/positions/PositionRow.svelte';
	import PositionSheet from '$lib/components/positions/PositionSheet.svelte';
	import TemplatesSheet from '$lib/components/positions/TemplatesSheet.svelte';
	import HowSheet from '$lib/components/positions/HowSheet.svelte';
	import { CHIP, GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { groupHeading } from '$lib/moves/figures';
	import { parsePositionFilter, positionsView, type PositionsLists } from '$lib/positions/filter';
	import {
		EMPTY,
		EMPTY_ACTIONS,
		GROUP_NOTE,
		MAP_ROW,
		NONE_OWN,
		NO_MATCH,
		OPTIONAL_LINE,
		TEMPLATES_BUTTON,
		listHeading,
		noPositionRow,
		positionChips,
		positionQuery,
		styleLabelOf,
		taggedLine,
		type PositionChip,
		type PositionFilter
	} from '$lib/positions/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { OpenRow } from '$lib/nav/moves-pane';

	/**
	 * The Positions list: the line on tagging, Templates and How, the search and
	 * chips, No position and the map, then the positions and each group's. The
	 * (moves) layout renders it once (`ListPane`): the phone's list page, and on
	 * the desktop the column beside an open position, No position or the map.
	 * Its sheets post to the list route's actions by name; they read their own
	 * refusals from the submit's result.
	 *
	 * The filter: the URL's on the list route; beside an item the column's own
	 * (`held`), seeded once from the trail's kept filter and kept there.
	 */
	let {
		lists: l,
		dance,
		open,
		isList,
		creating = $bindable(false)
	}: {
		lists: PositionsLists;
		dance: DanceSlug;
		/** What is open beside the list: its row is lit. */
		open: OpenRow;
		/** The list route; otherwise an item is open. */
		isList: boolean;
		/** New position; the band's + opens it too. */
		creating?: boolean;
	} = $props();

	let templating = $state(false);
	let explaining = $state(false);

	const list = $derived(resolve('/[dance]/(moves)/positions', { dance }));
	// The pages under Positions come with their own tasks: their paths are built on the list's.
	const positionHref = (id: number) => `${list}/${id}`;

	// Beside an item: the column's filter, as a query string. Server-drawn empty; seeded once up.
	let held = $state('');
	let seeded = false;
	const filter = $derived<PositionFilter>(
		parsePositionFilter(
			isList ? page.url.searchParams : new URLSearchParams(held),
			l.types,
			l.inGroupMode
		)
	);
	afterNavigate(() => {
		if (isList) {
			held = positionQuery(filter, {});
			keepFilter(list, held, held);
			// `?new=1` opens New position straight away.
			if (page.url.searchParams.get('new') === '1') creating = true;
		} else if (!seeded) {
			held = keptFilter(list);
			// The column scrolls on its own only on the desktop.
			if (desk.current) void tick().then(revealLit);
		}
		seeded = true;
	});

	const view = $derived(positionsView(l, filter));
	const filtered = $derived(!!(filter.q || filter.type || filter.gaps));
	const styleLabel = $derived(styleLabelOf(l.styleLabel));
	const chips = $derived(
		positionChips(filter, {
			types: l.types,
			typeLabel: l.styleLabel,
			gaps: l.gaps,
			groupMode: l.inGroupMode,
			hasOwn: l.hasOwn,
			untyped: l.untyped
		})
	);
	const noneCount = $derived(l.none.none + l.none.onlyStart + l.none.onlyEnd);
	// Nobody has any: no positions of the space's own or of a group, and nothing narrows the list.
	const nothing = $derived(!filtered && view.rows.length === 0 && view.groups.length === 0);

	// What is typed; follows the filter when it changes under it.
	let q = $derived(filter.q);
	let chipRow = $state<HTMLElement>();

	// A chip that is on but off to the right scrolls into view on arrival.
	onMount(() => {
		const row = chipRow;
		const on = [...(row?.querySelectorAll<HTMLElement>('label:has(input:checked)') ?? [])];
		if (!row || on.length === 0) return;
		const right = row.getBoundingClientRect().right - 16;
		const last = on[on.length - 1].getBoundingClientRect().right;
		if (last > right) row.scrollLeft += last - right;
	});

	/**
	 * Swap the filter in place: no history entry, and the search keeps its focus.
	 * Beside an item the URL is the item's: the column keeps the filter itself.
	 */
	function refilter(change: Partial<PositionFilter>, noScroll = false) {
		const qs = positionQuery(filter, change);
		if (!isList) {
			held = qs;
			keepFilter(list, qs, qs);
			return;
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the query is added
		goto(qs ? `${list}?${qs}` : list, { keepFocus: true, replaceState: true, noScroll });
	}

	function toggle(e: Event & { currentTarget: HTMLInputElement }, chip: PositionChip) {
		const change = { ...chip.change, q };
		if (positionQuery(filter, change) === positionQuery(filter, {})) {
			// Nothing would change (All while it is on): the box goes back as it was.
			e.currentTarget.checked = chip.on;
			return;
		}
		refilter(change, true);
	}

	const isOpen = (id: number) => open?.kind === 'position' && open.id === id;
	const noneOpen = $derived(open?.kind === 'no-position');
</script>

<!-- eslint-disable svelte/no-navigation-without-resolve -- the hrefs below are built on the resolved list path -->
{#if nothing}
	<div class="h-10 flex-none"></div>
	<EmptyState icon="positions" title={EMPTY.title} body={EMPTY.body}>
		{#snippet action()}
			<div class="flex flex-col items-center gap-2">
				<button type="button" class={button('primary')} onclick={() => (templating = true)}>
					<Icon name="copy" size={20} />{EMPTY_ACTIONS.templates}
				</button>
				<button type="button" class={button('secondary')} onclick={() => (creating = true)}>
					<Icon name="plus" size={20} />{EMPTY_ACTIONS.create}
				</button>
				<button type="button" class={button('tertiary')} onclick={() => (explaining = true)}>
					<Icon name="info" size={20} />{EMPTY_ACTIONS.how}
				</button>
			</div>
		{/snippet}
	</EmptyState>
	{#if l.inGroupMode}
		<p class="px-1 text-center text-[14px] leading-[1.45] text-muted">{GROUP_NOTE}</p>
	{/if}
{:else}
	<p class="px-1 text-[14px] leading-[1.45] text-ink-2">
		{#if l.inGroupMode}
			{GROUP_NOTE}
		{:else}
			<b class="text-ink">{taggedLine(l.tagged)}</b>
			{OPTIONAL_LINE}
		{/if}
	</p>
	<div class="-my-1 -ml-2.5 flex flex-none">
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (templating = true)}>
			<Icon name="copy" size={20} />{TEMPLATES_BUTTON}
		</button>
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (explaining = true)}>
			<Icon name="info" size={20} />{EMPTY_ACTIONS.how}
		</button>
	</div>

	<form
		role="search"
		onsubmit={(e) => {
			e.preventDefault();
			refilter({ q });
		}}
	>
		<SearchField
			name="q"
			bind:value={q}
			placeholder="Search positions"
			label="Search positions"
			onclear={() => refilter({ q: '' })}
		/>
	</form>

	<!--
		One line running off the right edge; the 4 px on the left keeps the first chip's ring.
		On the desktop the 360 column wraps them instead.
	-->
	<div
		role="group"
		aria-label="Filter positions"
		bind:this={chipRow}
		class="-mr-4 -ml-1 flex flex-none [scrollbar-width:none] gap-2 overflow-x-auto pr-4 pl-1 desk:mr-0 desk:flex-wrap desk:gap-x-1.5 desk:gap-y-0 desk:overflow-visible desk:pr-0 [&::-webkit-scrollbar]:hidden"
	>
		{#each chips as chip (chip.key)}
			<label class="{CHIP} group gap-1.5">
				<input
					type="checkbox"
					class="sr-only"
					checked={chip.on}
					onchange={(e) => toggle(e, chip)}
				/>{chip.label}{#if chip.count !== undefined}<!-- 75 % only on the plain chip: on accent it would fall below 4.5:1. -->
					<span class="font-bold opacity-75 group-has-checked:opacity-100">{chip.count}</span>{/if}
			</label>
		{/each}
	</div>

	{#if !filtered && (noneCount > 0 || view.rows.length + view.groups.length > 0)}
		<div class={GROUP}>
			{#if !l.inGroupMode && noneCount > 0}
				{@const r = noPositionRow(noneCount)}
				<a
					class="flex min-h-16 items-center gap-3 py-[9px] pr-3.5 pl-4 active:bg-step"
					class:bg-accent-soft={noneOpen}
					aria-current={noneOpen ? 'page' : undefined}
					href="{list}/none"
				>
					<span
						class="flex size-10 flex-none items-center justify-center rounded-xl border-2 border-dashed border-field-line text-muted"
						><Icon name="footprints" size={20} /></span
					>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-[16px] leading-[1.3] font-bold text-ink">{r.title}</span>
						<span class="text-[13px] leading-[1.35] text-muted">{r.meta}</span>
					</span>
					<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
				</a>
			{/if}
			{#if view.rows.length + view.groups.length > 0}
				<a
					class="flex min-h-16 items-center gap-3 py-[9px] pr-3.5 pl-4 active:bg-step"
					href="{list}/map"
				>
					<span
						class="flex size-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
						><Icon name="positions" size={20} /></span
					>
					<span class="min-w-0 flex-1 text-[16px] leading-[1.3] font-bold text-ink">{MAP_ROW}</span>
					<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
				</a>
			{/if}
		</div>
	{/if}

	{#if view.rows.length > 0}
		<h2 class="{SECTION_LABEL} pt-1">{listHeading(view.rows.length, l.inGroupMode)}</h2>
		<div class={GROUP}>
			{#each view.rows as r (r.id)}
				<PositionRow row={r} href={positionHref(r.id)} {styleLabel} current={isOpen(r.id)} />
			{/each}
		</div>
	{:else if filtered}
		{#if view.groups.length === 0}<EmptyState icon="search" title={NO_MATCH} />{/if}
	{:else}
		<!-- Only a group's positions so far: the person's own list starts here. -->
		<p class="rounded-2xl bg-surface px-4 py-3.5 text-[15px] text-muted">{NONE_OWN}</p>
	{/if}

	<!-- Each group's positions the person may use, under a slight heading. -->
	{#each view.groups as g (g.team.id)}
		<section aria-label={g.team.name} class="flex flex-col gap-2">
			<h2 class="flex items-center gap-1.5 {SECTION_LABEL} pt-1.5">
				<Icon name="people" size={16} />{groupHeading(g.team.name, g.rows.length)}
			</h2>
			<div class={GROUP}>
				{#each g.rows as r (r.id)}
					<PositionRow
						row={r}
						href={positionHref(r.id)}
						{styleLabel}
						group
						current={isOpen(r.id)}
					/>
				{/each}
			</div>
		</section>
	{/each}
{/if}

{#if creating}
	<PositionSheet
		open={true}
		onclose={() => (creating = false)}
		mode="new"
		action={`/${dance}/positions?/create`}
		{dance}
		defaultStyle={l.defaultStyle}
	/>
{/if}

{#if templating}
	<TemplatesSheet
		action={`/${dance}/positions?/templates`}
		open={true}
		onclose={() => (templating = false)}
		{dance}
		owned={l.owned}
		defaultStyle={l.defaultStyle}
	/>
{/if}

<HowSheet open={explaining} onclose={() => (explaining = false)} />
