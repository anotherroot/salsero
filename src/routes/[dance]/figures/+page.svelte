<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import MovesScreen from '$lib/components/moves/MovesScreen.svelte';
	import NavTile from '$lib/components/moves/NavTile.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import { CHIP, GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		figuresEmpty,
		groupHeading,
		figuresHeading,
		filterChips,
		filterQuery,
		showTiles,
		tileMetas,
		type FigureChip,
		type FigureFilter
	} from '$lib/moves/figures';
	import { figureRowParts, moveMeta, movesHeading } from '$lib/moves/list';
	import { TWINS_CHIP } from '$lib/clones/twins';
	import { HIDDEN_FROM_MEMBERS, MEMBERS_NOTE, anyHidden } from '$lib/moves/members';
	import { presetLine, withoutPreset } from '$lib/positions/view';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// `?new=1` (from the empty Today page, or a position's New figure) opens the sheet straight away.
	let creating = $state(page.url.searchParams.get('new') === '1');
	// New figure from a position (`&start=` / `&end=`, ruling 8): the tag the new
	// figure gets. Refused because the position went since, it is dropped.
	const preset = $derived(form && 'presetGone' in form ? null : data.preset);
	/**
	 * New move closed: the URL's `?new=1&start=…` goes (a replace, once the
	 * sheet's Back has landed), so the next + and a reload are untagged.
	 */
	function closeNew() {
		creating = false;
		const href = withoutPreset(page.url);
		if (href) void gotoWhenSettled(href, { replaceState: true, keepFocus: true, noScroll: true });
	}
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form?.message) creating = true;
	});
	let busy = $state(false);
	// A refusal about one field names it; the rest (a style that is not the dance's) do not.
	const field = $derived(form && 'field' in form ? form.field : undefined);
	const otherError = $derived(form?.message && !field ? form.message : null);
	const fieldErrors = $derived<Record<string, string>>(
		field && form?.message ? { [field as string]: form.message } : {}
	);

	const filter = $derived<FigureFilter>(data.filter);
	// The figures that stand for their twins (board C7 p3): a "Twins" chip.
	const twinned = $derived(new Set(data.twinned));
	const count = $derived(data.figures.length);
	const figureCount = $derived(data.figures.reduce((n, m) => n + m.figures.length, 0));
	// Group mode has no coverage (null): its heading carries no "Yours".
	const inGroup = $derived(data.unrouted === null);
	const heading = $derived(
		inGroup && !filter.unlinked
			? movesHeading(
					{ moves: count, figures: figureCount },
					!!(filter.q || filter.style || filter.partner),
					null
				)
			: figuresHeading({ moves: count, figures: figureCount }, filter)
	);
	const empty = $derived(figuresEmpty(count, filter));
	const chips = $derived(
		filterChips(filter, data.dance.styles, data.dance.styleLabel, data.unlinked)
	);
	// Group mode has no Coverage tile: coverage is the person's own.
	const tiles = $derived(data.unrouted !== null ? tileMetas(data.unrouted) : null);
	// What is typed; follows the URL when it changes under it.
	let q = $derived(data.filter.q);

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

	/** Swap the filter in place: no history entry, and the search keeps its focus. */
	function refilter(change: Partial<FigureFilter>, noScroll = false) {
		const qs = filterQuery(filter, change);
		const href = resolve('/[dance]/figures', { dance: data.dance.slug });
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the query is added
		goto(qs ? `${href}?${qs}` : href, { keepFocus: true, replaceState: true, noScroll });
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
</script>

<svelte:head><title>Figures · {data.dance.label}</title></svelte:head>

{#snippet figureRow(f: (typeof data.figures)[number]['figures'][number], showLacks: boolean)}
	<a
		class="flex min-h-16 items-center gap-2.5 py-[9px] pr-3.5 pl-4 active:bg-step"
		href={resolve('/[dance]/figures/[id]', { dance: data.dance.slug, id: String(f.id) })}
	>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
				<span class="text-[16px] leading-[1.3] font-bold break-words text-ink">{f.name}</span>
				<!-- The twin icon is the kit's `link`: the kit has none of its own. -->
				{#if twinned.has(f.id)}<Badge><Icon name="link" size={14} />{TWINS_CHIP}</Badge>{/if}
			</span>
			<!-- Each part carries the dot before it, so a wrapped line never ends on "·". -->
			<span class="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[1.35] text-muted">
				{#each figureRowParts(showLacks ? f : { ...f, hasSection: true, hasLesson: true }) as part, i (part.text)}
					<span class="whitespace-nowrap"
						>{#if i > 0}<span aria-hidden="true" class="mr-1.5">·</span>{/if}<span
							class={part.status ? 'font-bold text-status' : undefined}>{part.text}</span
						></span
					>
				{/each}
				{#if f.membersSee === false}
					<span class="flex items-center gap-1 whitespace-nowrap"
						><Icon name="eye-off" size={16} />{HIDDEN_FROM_MEMBERS}</span
					>
				{/if}
			</span>
		</span>
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
{/snippet}

<!-- A move's name over its figures: the heading opens the move's page. A move
     that groups' twins folded into says where else it is (board C7 p3). -->
{#snippet moveSection(m: (typeof data.figures)[number], showLacks: boolean)}
	<section aria-label={m.name} class="flex flex-col gap-1.5">
		<div class="flex flex-col">
			<a
				class="flex items-center gap-1 self-start rounded-lg py-1 text-[17px] leading-[1.3] font-bold text-ink focus-visible:outline-2 focus-visible:outline-accent"
				href={resolve('/[dance]/moves/[id]', { dance: data.dance.slug, id: String(m.id) })}
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
				{@render figureRow(f, showLacks)}
			{/each}
		</div>
	</section>
{/snippet}

<MovesScreen segment="figures" dance={data.dance.slug} onnew={() => (creating = true)}>
	{#if empty === 'none' && data.groups.length === 0}
		<div class="h-10 flex-none"></div>
		<EmptyState icon="moves" title="No figures yet" body="Add the first one you learned.">
			{#snippet action()}
				<button type="button" class={button('primary')} onclick={() => (creating = true)}>
					<Icon name="plus" size={20} /> New move
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		{#if tiles && showTiles(count, filter)}
			<div class="flex flex-none gap-2">
				<NavTile
					href={resolve('/[dance]/coverage', { dance: data.dance.slug })}
					icon="routine"
					title="Coverage"
					meta={tiles.coverage.text}
					status={tiles.coverage.status}
				/>
			</div>
		{/if}

		{#if anyHidden(data.figures.flatMap((m) => m.figures))}
			<p class="rounded-2xl bg-surface px-4 py-3 text-[13px] leading-[1.4] text-muted">
				{MEMBERS_NOTE}
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
				placeholder="Search figures"
				label="Search figures"
				onclear={() => refilter({ q: '' })}
			/>
		</form>

		<!-- One line running off the right edge; the 4 px on the left keeps the first chip's ring. -->
		<div
			role="group"
			aria-label="Filter figures"
			bind:this={chipRow}
			class="-mr-4 -ml-1 flex flex-none [scrollbar-width:none] gap-2 overflow-x-auto pr-4 pl-1 [&::-webkit-scrollbar]:hidden"
		>
			{#each chips as chip (chip.key)}
				<label class="{CHIP} group gap-1.5">
					<input
						type="checkbox"
						class="sr-only"
						checked={chip.on}
						onchange={(e) => toggle(e, chip)}
					/>{chip.label}{#if chip.count !== undefined}<!-- 75 % only on the plain chip: on accent it would fall below 4.5:1. -->
						<span class="font-bold opacity-75 group-has-checked:opacity-100">{chip.count}</span
						>{/if}
				</label>
			{/each}
		</div>

		{#if empty === 'all-linked'}
			<EmptyState
				icon="check-circle"
				title="All linked"
				body="Every figure has a section and a lesson."
			/>
		{:else if empty === 'no-match'}
			{#if data.groups.length === 0}<EmptyState icon="search" title="No figures match" />{/if}
		{:else if empty === 'none'}
			<!-- Only a group's figures so far: the person's own list starts here. -->
			<p class="rounded-2xl bg-surface px-4 py-3.5 text-[15px] text-muted">
				No figures of your own yet.
			</p>
		{:else}
			<h2 class="{SECTION_LABEL} pt-0.5">{heading}</h2>
			{#each data.figures as m (m.id)}
				{@render moveSection(m, true)}
			{/each}
		{/if}

		<!-- Each group's moves from the lessons the person added: viewed and practised, under a slight heading. -->
		{#each data.groups as g (g.team.id)}
			<section aria-label={g.team.name} class="flex flex-col gap-2">
				<h2 class="flex items-center gap-1.5 {SECTION_LABEL} pt-1.5">
					<Icon name="people" size={16} />{groupHeading(
						g.team.name,
						g.moves.reduce((n, m) => n + m.figures.length, 0)
					)}
				</h2>
				{#each g.moves as m (m.id)}
					{@render moveSection(m, false)}
				{/each}
			</section>
		{/each}
	{/if}
</MovesScreen>

{#if creating}
	<Sheet title="New move" open={true} onclose={closeNew}>
		<form
			id="new-figure"
			method="POST"
			action="?/create"
			class="flex flex-col gap-3.5"
			use:guarded={{
				label: 'New move',
				submit: ({ cancel }) => {
					// One figure per tap: a second tap while the first is out is dropped.
					if (busy) return cancel();
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
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
			<FigureFields
				dance={data.dance}
				figureName={form?.figureName}
				autofocus
				name={form?.name}
				style={data.defaultStyle}
				notes={form?.notes}
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
					aria-label={busy ? 'Adding move' : undefined}
				>
					{#if busy}<Spinner />{:else}Add move{/if}
				</button>
				<p class="text-center text-[13px] text-muted">You can add recordings next.</p>
			</div>
		{/snippet}
	</Sheet>
{/if}
