<script lang="ts">
	import { fromTags } from '$lib/clones/from-tag';
	import { onMount, tick } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { keepFilter, keptFilter } from '$lib/nav/trail.svelte';
	import NavTile from './NavTile.svelte';
	import SyncCard from './SyncCard.svelte';
	import { outOfSyncCount } from '$lib/moves/sync';
	import { revealLit } from '$lib/components/shell/reveal';
	import { desk } from '$lib/nav/desk.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import GroupMark from '$lib/components/moves/GroupMark.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import PickerField from '$lib/components/picker/PickerField.svelte';
	import { figureRows } from '$lib/picker/build';
	import { CHIP, GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		figuresEmpty,
		figuresHeading,
		filterChips,
		filterQuery,
		showTiles,
		tileMetas,
		styleLabelsOf,
		type FigureChip,
		type FigureFilter
	} from '$lib/moves/figures';
	import {
		figuresView,
		mergeGroups,
		parseFigureFilter,
		type FiguresLists,
		type MergedFigure,
		type MergedMove
	} from '$lib/moves/filter';
	import { figureRowParts, moveMeta, movesHeading } from '$lib/moves/list';
	import { twinsChip } from '$lib/clones/twins';
	import { anyHidden, hiddenFromMembers, membersNote } from '$lib/moves/members';
	import { t } from '$lib/i18n/catalog';
	import { presetLine, withoutPreset } from '$lib/positions/view';
	import type { Dance } from '$lib/dances/dances';
	import type { OpenRow } from '$lib/nav/moves-pane';

	/**
	 * The Figures list: Coverage, the search and chips, then each move's figures,
	 * the groups' mixed in under the same moves, each marked with its group. The
	 * (moves) layout renders it once (`ListPane`), so it is the phone's list page
	 * and, on the desktop, the column beside an open figure, move or Coverage.
	 * Its form posts to the list route's action by name (a bare
	 * `?/create` would post to the open page), and a refusal is read from the
	 * submit's result: beside an item SvelteKit applies no `form` here.
	 *
	 * The filter: on the list route it is the URL's, as ever. Beside an item it is
	 * the column's own (`held`), seeded once from the trail's kept filter and kept
	 * there on every change, so the list page and a rebuilt column come back with it.
	 */
	let {
		lists,
		dance,
		open,
		isList,
		creating = $bindable(false)
	}: {
		lists: FiguresLists;
		dance: Dance;
		/** What is open beside the list: its row is lit. */
		open: OpenRow;
		/** The list route; otherwise an item is open (beside it on the desktop, alone on the phone). */
		isList: boolean;
		/** The New figure sheet; the band's + and the empty pane open it too. */
		creating?: boolean;
	} = $props();

	type Refusal = {
		field?: 'figureName' | 'name' | 'notes';
		message?: string;
		figureName?: string;
		name?: string;
		notes?: string;
		presetGone?: true;
	};
	type Preset = { side: 'start' | 'end'; id: number; name: string };

	/** The list's own path: its kept filter and search are under it. */
	const listPath = $derived(resolve('/[dance]/(moves)/figures', { dance: dance.slug }));

	// The last create's refusal, shown in the sheet until it closes.
	let refusal = $state<Refusal | null>(null);
	// New figure from a position (`&start=` / `&end=`, ruling 8): the tag the new
	// figure gets, from the list route's load. Refused because the position went since, it is dropped.
	const preset = $derived(
		refusal?.presetGone ? null : ((page.data.preset ?? null) as Preset | null)
	);
	/**
	 * New figure closed: the URL's `?new=1&start=…` goes (a replace, once the
	 * sheet's Back has landed), so the next + and a reload are untagged.
	 */
	function closeNew() {
		creating = false;
		refusal = null;
		moveId = null;
		newMove = null;
		if (!isList) return;
		const href = withoutPreset(page.url);
		if (href) void gotoWhenSettled(href, { replaceState: true, keepFocus: true, noScroll: true });
	}
	let busy = $state(false);
	/** New figure's move: a picked one (`groupId`), or a new one made with the figure (`figureName`). */
	let moveId = $state<number | null>(null);
	let newMove = $state<string | null>(null);
	const moveGroups = $derived([
		{ title: t().picker.moveField.group, entries: figureRows(lists.moveTargets) }
	]);
	// A refusal about one field names it; the rest (a style that is not the dance's) do not.
	const field = $derived(refusal?.field);
	const otherError = $derived(refusal?.message && !field ? refusal.message : null);
	const fieldErrors = $derived<Record<string, string>>(
		field && refusal?.message ? { [field]: refusal.message } : {}
	);

	// Beside an item: the column's filter, as a query string. Server-drawn empty; seeded once up.
	let held = $state('');
	let seeded = false;
	const filter = $derived<FigureFilter>(
		parseFigureFilter(isList ? page.url.searchParams : new URLSearchParams(held), dance.styles)
	);
	afterNavigate(() => {
		if (isList) {
			// The URL rules; the column carries it on when an item opens.
			held = filterQuery(filter, {});
			keepFilter(listPath, held, held);
			// `?new=1` (from the empty Today page, or a position's New figure) opens the sheet.
			if (page.url.searchParams.get('new') === '1') creating = true;
		} else if (!seeded) {
			held = keptFilter(listPath);
			// The column scrolls on its own only on the desktop.
			if (desk.current) void tick().then(revealLit);
		}
		seeded = true;
	});

	const view = $derived(figuresView(lists, filter));
	// The groups' figures under the same moves as the person's, as Lessons mixes them in.
	const moves = $derived(mergeGroups(view.figures, view.groups));
	// The figures that stand for their twins (board C7 p3): a "Twins" chip.
	const twinned = $derived(new Set(view.twinned));
	const count = $derived(moves.length);
	const figureCount = $derived(moves.reduce((n, m) => n + m.figures.length, 0));
	// Group mode has no coverage (null): its heading carries no "Yours"; nor does
	// a list with a group's figures in it.
	const inGroup = $derived(lists.unrouted === null);
	const withGroups = $derived(moves.some((m) => m.figures.some((f) => f.team)));
	const heading = $derived(
		(inGroup || withGroups) && !filter.unlinked
			? movesHeading(
					{ moves: count, figures: figureCount },
					!!(filter.q || filter.style || filter.partner || filter.sync),
					null
				)
			: figuresHeading({ moves: count, figures: figureCount }, filter)
	);
	const empty = $derived(figuresEmpty(count, filter));
	const chips = $derived(
		filterChips(filter, dance.styles, styleLabelsOf(dance.styleLabel), lists.unlinked)
	);
	// Group mode has no Coverage tile: coverage is the person's own.
	const tiles = $derived(lists.unrouted !== null ? tileMetas(lists.unrouted) : null);
	// Out of sync: the card's number counts the whole list, whatever the other filters.
	const syncN = $derived(
		outOfSyncCount(
			[...lists.mine, ...lists.groups.flatMap((g) => g.moves)].flatMap((m) => m.figures)
		)
	);
	const syncHref = $derived.by(() => {
		const qs = filterQuery(filter, { sync: filter.sync ? undefined : '1' });
		return qs ? `${listPath}?${qs}` : listPath;
	});
	// What is typed; follows the filter when it changes under it.
	let q = $derived(filter.q);

	let chipRow = $state<HTMLElement>();

	// Chips that are on but off to the right (Solo, a late style) scroll into
	// view on arrival: the last one on is brought in. Instant, so there is no
	// motion to reduce.
	onMount(() => {
		const row = chipRow;
		const on = [...(row?.querySelectorAll<HTMLElement>('label:has(input:checked)') ?? [])];
		if (!row || on.length === 0) return;
		// Bringing the last one's right edge in by exactly what it overhangs keeps
		// the first one in whenever the two fit side by side.
		const right = row.getBoundingClientRect().right - 16;
		const last = on[on.length - 1].getBoundingClientRect().right;
		if (last > right) row.scrollLeft += last - right;
	});

	/**
	 * Swap the filter in place: no history entry, and the search keeps its focus.
	 * Beside an item the URL is the item's: the column keeps the filter itself.
	 */
	function refilter(change: Partial<FigureFilter>, noScroll = false) {
		const qs = filterQuery(filter, change);
		if (!isList) {
			held = qs;
			keepFilter(listPath, qs, qs);
			return;
		}
		goto(qs ? `${listPath}?${qs}` : listPath, { keepFocus: true, replaceState: true, noScroll });
	}

	function toggle(e: Event & { currentTarget: HTMLInputElement }, chip: FigureChip) {
		// Keep what is typed in the search, submitted or not.
		const change = { ...chip.change, q };
		if (filterQuery(filter, change) === filterQuery(filter, {})) {
			// Nothing would change (All while it is on): the box goes back as it was.
			e.currentTarget.checked = chip.on;
			return;
		}
		refilter(change, true);
	}

	const isOpen = (kind: 'figure' | 'move', id: number) => open?.kind === kind && open.id === id;
</script>

{#snippet figureRow(f: MergedFigure, tags: Map<number, string>)}
	{@const lit = isOpen('figure', f.id)}
	{@const tag = tags.get(f.id)}
	<a
		class="flex min-h-16 items-center gap-2.5 py-[9px] pr-3.5 pl-4 active:bg-step"
		class:bg-accent-soft={lit}
		aria-current={lit ? 'page' : undefined}
		href={resolve('/[dance]/(moves)/figures/[id]', { dance: dance.slug, id: String(f.id) })}
	>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
				<span class="text-[16px] leading-[1.3] font-bold break-words text-ink"
					>{f.name}{#if tag}<span class="ml-1 font-normal text-muted">{tag}</span>{/if}</span
				>
				<!-- The twin icon is the kit's `link`: the kit has none of its own. -->
				{#if twinned.has(f.id)}<Badge><Icon name="link" size={14} />{twinsChip()}</Badge>{/if}
			</span>
			<!-- A group's figure: its group, as a group's lesson shows it on the Lessons list. -->
			{#if f.team}<GroupMark name={f.team.name} />{/if}
			<!-- Each part carries the dot before it, so a wrapped line never ends on "·". -->
			<span class="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[1.35] text-muted">
				{#each figureRowParts(f.team ? { ...f, hasSection: true, hasLesson: true } : f) as part, i (part.text)}
					<span class="whitespace-nowrap"
						>{#if i > 0}<span aria-hidden="true" class="mr-1.5">·</span>{/if}<span
							class={part.status
								? 'font-bold text-status'
								: part.warn
									? 'font-bold text-warn'
									: undefined}>{part.text}</span
						></span
					>
				{/each}
				{#if f.membersSee === false}
					<span class="flex items-center gap-1 whitespace-nowrap"
						><Icon name="eye-off" size={16} />{hiddenFromMembers()}</span
					>
				{/if}
			</span>
		</span>
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
{/snippet}

<!-- A move's name over its figures: the heading opens the move's page. A move
     that groups' twins folded into says where else it is (board C7 p3). -->
{#snippet moveSection(m: MergedMove)}
	{@const lit = isOpen('move', m.id)}
	<!-- Two figures of one move that share a name: a copy says where it came from. -->
	{@const tags = fromTags(m.figures)}
	<section aria-label={m.name} class="flex flex-col gap-1.5">
		<div class="flex flex-col">
			<a
				class="flex items-center gap-1 self-start py-1 text-[17px] leading-[1.3] font-bold text-ink focus-visible:outline-2 focus-visible:outline-accent {lit
					? '-ml-2.5 rounded-[10px] bg-accent-soft pr-2 pl-2.5'
					: 'rounded-lg'}"
				aria-current={lit ? 'page' : undefined}
				href={resolve('/[dance]/(moves)/moves/[id]', { dance: dance.slug, id: String(m.id) })}
			>
				{m.name}<span class="flex text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
			{#if m.also.length > 0}
				<span class="text-[13px] leading-[1.35] text-muted"
					>{moveMeta(m.figures.length, m.also)}</span
				>
			{/if}
		</div>
		<div class={GROUP}>
			{#each m.figures as f (f.id)}
				{@render figureRow(f, tags)}
			{/each}
		</div>
	</section>
{/snippet}

{#if empty === 'none'}
	<div class="h-10 flex-none"></div>
	<EmptyState icon="moves" title={t().moves.figures.empty} body={t().moves.figures.emptyBody}>
		{#snippet action()}
			<button type="button" class={button('primary')} onclick={() => (creating = true)}>
				<Icon name="plus" size={20} />
				{t().moves.newFigure}
			</button>
		{/snippet}
	</EmptyState>
{:else}
	{#if tiles && showTiles(count, filter)}
		<div class="flex flex-none gap-2">
			<NavTile
				href={resolve('/[dance]/(moves)/coverage', { dance: dance.slug })}
				icon="routine"
				title={t().moves.figures.coverage}
				meta={tiles.coverage.text}
				status={tiles.coverage.status}
				current={open?.kind === 'coverage'}
			/>
		</div>
	{/if}

	{#if syncN > 0 || filter.sync}
		<SyncCard
			kind="figure"
			n={syncN}
			on={!!filter.sync}
			href={syncHref}
			onclick={(e) => {
				if (isList) return;
				e.preventDefault();
				refilter({ sync: filter.sync ? undefined : '1' }, true);
			}}
		/>
	{/if}

	{#if anyHidden(view.figures.flatMap((m) => m.figures))}
		<p class="rounded-2xl bg-surface px-4 py-3 text-[13px] leading-[1.4] text-muted">
			{membersNote()}
		</p>
	{/if}

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
			placeholder={t().moves.figures.search}
			label={t().moves.figures.search}
			onclear={() => refilter({ q: '' })}
		/>
	</form>

	<!--
		One line running off the right edge; the 4 px on the left keeps the first chip's ring.
		On the desktop the 360 column wraps them instead.
	-->
	<div
		role="group"
		aria-label={t().moves.figures.filter}
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

	{#if empty === 'all-linked'}
		<EmptyState
			icon="check-circle"
			title={t().moves.figures.allLinked}
			body={t().moves.figures.allLinkedBody}
		/>
	{:else if empty === 'no-match'}
		<EmptyState icon="search" title={t().moves.figures.noMatch} />
	{:else}
		<h2 class="{SECTION_LABEL} pt-0.5">{heading}</h2>
		{#each moves as m (m.id)}
			{@render moveSection(m)}
		{/each}
	{/if}
{/if}

{#if creating}
	<Sheet title={t().moves.newFigure} open={true} onclose={closeNew}>
		<form
			id="new-figure"
			method="POST"
			action={`/${dance.slug}/figures?/create`}
			class="flex flex-col gap-3.5"
			use:guarded={{
				label: t().moves.newFigure,
				submit: ({ cancel }) => {
					// One figure per tap: a second tap while the first is out is dropped.
					if (busy) return cancel();
					busy = true;
					return async ({ result, update }) => {
						try {
							if (result.type === 'failure') {
								refusal = (result.data ?? {}) as Refusal;
							} else if (result.type === 'redirect') {
								// The list stays (the layout's): the sheet closes, then the new
								// figure opens once its Back has landed, with every load fresh.
								creating = false;
								refusal = null;
								moveId = null;
								newMove = null;
								await gotoWhenSettled(result.location, { invalidateAll: true });
							} else {
								await update();
							}
						} finally {
							busy = false;
						}
					};
				}
			}}
		>
			{#if otherError}<Banner kind="error">{otherError}</Banner>{/if}
			{#if preset}
				<input type="hidden" name={preset.side} value={preset.id} />
				<p
					class="flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-[14px] font-bold text-accent-text"
				>
					<span class="flex-none"><Icon name="positions" size={18} /></span>{presetLine(preset)}
				</p>
			{/if}
			<PickerField
				name="groupId"
				label={t().picker.moveField.label}
				placeholder={t().picker.moveField.placeholder}
				title={t().picker.moveField.title}
				search={t().picker.moveField.search}
				groups={moveGroups}
				nothingLeft={t().picker.moveField.none}
				bind:value={moveId}
				bind:newName={newMove}
				create={{
					label: t().picker.moveField.label,
					tag: t().picker.moveField.tag,
					name: 'figureName'
				}}
				required
				error={fieldErrors.figureName ?? null}
			/>
			<FigureFields
				{dance}
				name={refusal?.name}
				style={lists.defaultStyle}
				notes={refusal?.notes}
				errors={fieldErrors}
			/>
		</form>

		{#snippet footer()}
			<div class="flex flex-col items-center gap-2.5">
				<button
					type="submit"
					form="new-figure"
					class={button('primary', 'md', true)}
					aria-busy={busy}
					aria-label={busy ? t().moves.figures.adding : undefined}
				>
					{#if busy}<Spinner />{:else}{t().moves.figures.add}{/if}
				</button>
				<p class="text-center text-[13px] text-muted">{t().moves.figures.recordingsNext}</p>
			</div>
		{/snippet}
	</Sheet>
{/if}
