<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import MovesScreen from '$lib/components/moves/MovesScreen.svelte';
	import NavTile from '$lib/components/moves/NavTile.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SearchField from '$lib/components/ui/SearchField.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import { CHIP, GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import {
		figureMeta,
		figuresEmpty,
		figuresHeading,
		filterChips,
		filterQuery,
		showTiles,
		tileMetas,
		type FigureChip,
		type FigureFilter
	} from '$lib/moves/figures';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// `?new=1` (from the empty Today page) opens the sheet straight away.
	let creating = $state(page.url.searchParams.get('new') === '1');
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form?.message) creating = true;
	});
	let busy = $state(false);

	const filter = $derived<FigureFilter>(data.filter);
	const count = $derived(data.figures.length);
	const empty = $derived(figuresEmpty(count, filter));
	const chips = $derived(
		filterChips(filter, data.dance.styles, data.dance.styleLabel, data.unlinked)
	);
	const tiles = $derived(tileMetas(data.tagged, data.unrouted));
	// What is typed; follows the URL when it changes under it.
	let q = $derived(data.filter.q);

	/** Swap the filter in place: no history entry, and the search keeps its focus. */
	function refilter(change: Partial<FigureFilter>, noScroll = false) {
		const qs = filterQuery(filter, change);
		const href = resolve('/[dance]/figures', { dance: data.dance.slug });
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the path is resolved; only the query is added
		goto(qs ? `${href}?${qs}` : href, { keepFocus: true, replaceState: true, noScroll });
	}

	function toggle(e: Event & { currentTarget: HTMLInputElement }, chip: FigureChip) {
		if (filterQuery(filter, chip.change) === filterQuery(filter, {})) {
			// Nothing would change (All while it is on): the box goes back as it was.
			e.currentTarget.checked = chip.on;
			return;
		}
		refilter(chip.change, true);
	}
</script>

<svelte:head><title>Figures · {data.dance.label}</title></svelte:head>

<MovesScreen segment="figures" dance={data.dance.slug} onnew={() => (creating = true)}>
	{#if empty === 'none'}
		<div class="h-10 flex-none"></div>
		<EmptyState icon="moves" title="No figures yet" body="Add the first one you learned.">
			{#snippet action()}
				<button type="button" class={button('primary')} onclick={() => (creating = true)}>
					<Icon name="plus" size={20} /> New figure
				</button>
			{/snippet}
		</EmptyState>
	{:else}
		{#if showTiles(count, filter)}
			<div class="flex flex-none gap-2">
				<NavTile
					href={resolve('/[dance]/positions', { dance: data.dance.slug })}
					icon="positions"
					title="Positions"
					meta={tiles.positions}
				/>
				<NavTile
					href={resolve('/[dance]/coverage', { dance: data.dance.slug })}
					icon="routine"
					title="Coverage"
					meta={tiles.coverage.text}
					status={tiles.coverage.status}
				/>
			</div>
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
			class="-mr-4 -ml-1 flex flex-none [scrollbar-width:none] gap-2 overflow-x-auto pr-4 pl-1 [&::-webkit-scrollbar]:hidden"
		>
			{#each chips as chip (chip.key)}
				<label class="{CHIP} gap-1.5">
					<input
						type="checkbox"
						class="sr-only"
						checked={chip.on}
						onchange={(e) => toggle(e, chip)}
					/>{chip.label}{#if chip.count !== undefined}<span class="font-bold opacity-75"
							>{chip.count}</span
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
			<EmptyState icon="search" title="No figures match" />
		{:else}
			<h2 class="{SECTION_LABEL} pt-0.5">{figuresHeading(count, filter)}</h2>
			<div class={GROUP}>
				{#each data.figures as f (f.id)}
					<!-- A figure is its variations: the row opens the first one. -->
					<a
						class="flex min-h-16 items-center gap-2.5 py-[9px] pr-3.5 pl-4 active:bg-step"
						href={resolve('/[dance]/figures/[id]', {
							dance: data.dance.slug,
							id: String(f.firstVariationId)
						})}
					>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[16px] leading-[1.3] font-bold break-words text-ink">{f.name}</span>
							<!-- The separators are spans: whitespace around an {#if} gets eaten. -->
							<span
								class="flex flex-wrap items-center gap-x-1.5 text-[13px] leading-[1.35] text-muted"
							>
								{#each figureMeta(f) as part, i (part.text)}
									{#if i > 0}<span aria-hidden="true">·</span>{/if}
									<span class={part.status ? 'font-bold text-status' : undefined}>{part.text}</span>
								{/each}
							</span>
						</span>
						<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</MovesScreen>

{#if creating}
	<Sheet title="New figure" open={true} onclose={() => (creating = false)}>
		<form
			method="POST"
			action="?/create"
			class="space-y-3"
			use:guarded={{
				label: 'New figure',
				submit: () => {
					busy = true;
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}
			}}
		>
			<FigureFields
				dance={data.dance}
				figureName={form?.figureName}
				name={form?.name}
				style={data.defaultStyle}
				notes={form?.notes}
			/>
			{#if form?.message}
				<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
					{form.message}
				</p>
			{/if}
			<button
				type="submit"
				disabled={busy}
				class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-60"
				>Add figure</button
			>
			<p class="text-[12px] text-muted">You can add recordings next.</p>
		</form>
	</Sheet>
{/if}
