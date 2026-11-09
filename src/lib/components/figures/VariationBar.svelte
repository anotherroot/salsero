<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { gotoWhenSettled, releaseClick } from '$lib/sheets/history.svelte';
	import { recordingsLine, variationNav } from '$lib/figures/page';
	import { t } from '$lib/i18n/catalog';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import GroupMark from '$lib/components/moves/GroupMark.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { cloneChip } from '$lib/clones/twins';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { button, iconButton, FIELD, GROUP, LABEL } from '$lib/components/ui/styles';
	import type { SiblingSummary } from '$lib/types';

	/**
	 * The figure's variations, pinned to the bottom edge: ‹ and › step through
	 * them, the middle opens the list, and the list's footer makes a new one.
	 * Every step is a link, so a variation is a URL of its own; it replaces the
	 * history entry, as the figure is one page in the trail. Shown with a
	 * single variation too — that is where "New variation" lives.
	 *
	 * On the desktop the move's figures are tabs in the pane header
	 * (`FigureTabs`), so the switcher row is hidden, and the whole bar unless it
	 * holds `actions` (a reader's Edit and Practise stay pinned at the pane's
	 * foot). Its New figure sheet is the one for both: the tabs' "+ Figure" opens
	 * it through `adding`.
	 */
	interface Props {
		figureName: string;
		/** The move's id: the list sheet's title links to its page. */
		moveId: number;
		/** The move's figures as the Figures list merges them (groups' same-named moves too), the current one included. */
		siblings: SiblingSummary[];
		currentId: number;
		slug: string;
		/** `createVariation`'s refusal, if the last post was one. */
		failed: string | null;
		/** New variation is an editor's: a reader only steps through the ones they can see. */
		canEdit?: boolean;
		/** A row pinned above the switcher: a reader's Edit and Practise (board C1 p1). */
		actions?: Snippet;
		/** The New figure sheet is open (bindable: the desktop's tabs open it). */
		adding?: boolean;
	}

	let {
		figureName,
		moveId,
		siblings,
		currentId,
		slug,
		failed,
		canEdit = true,
		actions,
		adding = $bindable(false)
	}: Props = $props();

	let listing = $state(false);
	let busy = $state(false);
	// By value, so a refresh of the page data does not re-run the effect below.
	const stepId = $derived(currentId);

	/*
	 * Stepping to another variation is a same-route navigation, so SvelteKit
	 * keeps this component — and both sheets with it. A new id closes them (the
	 * ‹ › steps; a picked row and a new variation close them first).
	 */
	$effect(() => {
		void stepId;
		listing = false;
		adding = false;
	});
	// A refusal shows only while the sheet has stayed open since it arrived.
	let shown = $state<string | null>(null);
	let wasAdding = false;
	$effect(() => {
		const now = adding;
		if (wasAdding && !now) shown = null;
		wasAdding = now;
	});
	/*
	 * A refused name re-renders with the message; open its sheet to show it. Only
	 * a refusal that arrives while the bar is mounted: Edit unmounts the bar and
	 * Stop editing brings it back with the old refusal still in `form`, which
	 * must not reopen New variation.
	 */
	let seen = untrack(() => failed);
	$effect(() => {
		const now = failed;
		if (now && now !== seen) {
			shown = now;
			adding = true;
		}
		seen = now;
	});

	const nav = $derived(variationNav(siblings, currentId));
	const current = $derived(siblings[nav.index]);
	const byId = (id: number | null) => siblings.find((s) => s.id === id);
	const prev = $derived(byId(nav.prev));
	const next = $derived(byId(nav.next));

	const moveHref = $derived(
		resolve('/[dance]/(moves)/moves/[id]', { dance: slug, id: String(moveId) })
	);
	const href = (id: number) =>
		resolve('/[dance]/(moves)/figures/[id]', { dance: slug, id: String(id) });

	/*
	 * A row is a real link (long-press, new tab), but a tap closes the list
	 * first and only then replaces the page's own history entry: replacing
	 * from inside the sheet would replace the sheet's entry and leave the old
	 * variation one Back below.
	 */
	/** The move's page: the list closes first, as for a picked row. */
	function openMove(e: MouseEvent) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		listing = false;
		void gotoWhenSettled(moveHref);
	}

	function pick(e: MouseEvent, id: number) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		e.preventDefault();
		listing = false;
		if (id !== currentId) void gotoWhenSettled(href(id), { replaceState: true });
		// The variation already shown: no navigation follows, so the list's close goes now.
		else releaseClick();
	}
</script>

{#snippet step(
	to: SiblingSummary | undefined,
	label: string,
	icon: 'chevron-left' | 'chevron-right'
)}
	{#if to}
		<a
			href={href(to.id)}
			data-sveltekit-replacestate
			class="{iconButton('step')} !h-12 !w-12"
			aria-label="{label}: {to.name}"><Icon name={icon} size={22} /></a
		>
	{:else}
		<!-- Nowhere to step to; kept so the bar does not change shape. -->
		<button type="button" disabled aria-label={label} class="{iconButton('step')} !h-12 !w-12"
			><Icon name={icon} size={22} /></button
		>
	{/if}
{/snippet}

<!--
	The bar sits directly above the tab bar (`--pin-bottom`), or on the bottom edge
	over the safe area where none shows. The page ends in a spacer of its own so
	its last line clears this.
-->
<nav
	aria-label={t().figure.switcher.of(figureName)}
	class="fixed inset-x-0 z-30 border-t border-tab-line bg-tab-bg px-3 pt-2.5 desk:left-(--pane-left) {actions
		? ''
		: 'desk:hidden'}"
	style="bottom: var(--pin-bottom, 0px); padding-bottom: calc(10px + var(--pin-safe, var(--safe-bottom)))"
>
	{#if actions}
		<div class="mx-auto mb-2.5 grid max-w-[560px] grid-cols-2 gap-2 desk:mb-0">
			{@render actions()}
		</div>
	{/if}
	<div class="mx-auto flex max-w-[560px] items-center gap-2 desk:hidden">
		{@render step(prev, t().figure.switcher.previous, 'chevron-left')}
		<button
			type="button"
			aria-haspopup="dialog"
			onclick={() => (listing = true)}
			class="flex h-[52px] min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent-soft px-4"
		>
			<span class="flex min-w-0 flex-col items-center">
				<span class="max-w-full truncate text-[16px] leading-tight font-extrabold text-ink"
					>{current.name}</span
				>
				<span class="text-[12px] leading-tight font-bold text-accent-text">{nav.position}</span>
			</span>
			<span class="flex-none text-accent-text"><Icon name="chevron-up" size={18} /></span>
		</button>
		{@render step(next, t().figure.switcher.next, 'chevron-right')}
	</div>
</nav>

{#snippet newVariation()}
	<button type="button" class={button('secondary', 'md', true)} onclick={() => (adding = true)}
		><Icon name="plus" size={20} />{t().moves.move.newFigure}</button
	>
{/snippet}

<!-- A reader steps through the variations they can see; New variation is an editor's. -->
{#snippet moveLink()}
	<a
		href={moveHref}
		onclick={openMove}
		class="flex min-h-8 items-center gap-0.5 self-start text-[14px] font-bold text-accent-text"
		>{t().figure.switcher.open(figureName)}<Icon name="chevron-right" size={16} /></a
	>
{/snippet}

<Sheet
	title={t().figure.switcher.of(figureName)}
	subtitle={moveLink}
	open={listing}
	onclose={() => (listing = false)}
	footer={canEdit ? newVariation : undefined}
>
	<ul class={GROUP} aria-label={t().moves.move.figures}>
		{#each siblings as s (s.id)}
			{@const here = s.id === currentId}
			<li>
				<a
					href={href(s.id)}
					aria-current={here ? 'page' : undefined}
					onclick={(e) => pick(e, s.id)}
					class="flex min-h-[72px] items-center gap-3 px-4 py-3 {here ? 'bg-accent-soft' : ''}"
				>
					{#if here}
						<span class="flex flex-none text-accent" style="--icon-knockout: var(--color-on-accent)"
							><Icon name="check-circle" size={22} filled /></span
						>
					{/if}
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
							<span class="text-[16px] leading-tight font-bold text-ink">{s.name}</span>
							<!-- A figure with clones, marked as on the Figures list. -->
							{#if s.copies > 0}<Badge><Icon name="copy" size={14} />{cloneChip()}</Badge>{/if}
						</span>
						<!-- A group's figure, marked as on the Figures list. -->
						{#if s.team}<GroupMark name={s.team.name} />{/if}
						<span class="text-[13px] text-muted">{s.holds}</span>
						<span class="text-[13px] text-muted">{s.timing} · {recordingsLine(s.videos)}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
</Sheet>

<!-- Over the list it steps back to it (‹); opened alone (the desktop's "+ Figure" tab) it closes (×). -->
<Sheet
	title={t().moves.move.newFigure}
	sub={t().figure.switcher.newOf(figureName)}
	back={listing}
	open={adding}
	onclose={() => (adding = false)}
>
	<!-- A success closes the sheets, then replaces this entry with the new variation (below). -->
	<form
		id="new-variation"
		method="POST"
		action="?/createVariation"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: t().moves.move.newFigure,
			submit: () => {
				busy = true;
				return async ({ update, result }) => {
					try {
						// A new variation is a step within the figure, like the switcher: the
						// sheets close first, then it takes the page's own history entry.
						if (result.type === 'redirect') {
							adding = false;
							listing = false;
							await gotoWhenSettled(result.location, {
								replaceState: true,
								invalidateAll: true
							});
						} else await update();
					} finally {
						busy = false;
					}
					// The same name refused twice is the same `failed`, which the effect above cannot see.
					const m = result.type === 'failure' ? result.data?.message : null;
					if (typeof m === 'string') shown = m;
				};
			}
		}}
	>
		<div>
			<label for="new-variation-name" class={LABEL}>{t().moves.routines.name}</label>
			<input
				id="new-variation-name"
				name="name"
				required
				maxlength="200"
				placeholder={t().figure.switcher.namePlaceholder}
				class={FIELD}
				aria-invalid={shown ? 'true' : undefined}
				aria-describedby={shown ? 'new-variation-error' : undefined}
			/>
			{#if shown}<FieldError id="new-variation-error" message={shown} />{/if}
		</div>
		<p class="px-1 text-[14px] leading-[1.45] text-muted">
			{t().figure.switcher.copyOf(current.name)}
		</p>
	</form>
	{#snippet footer()}
		<button
			type="submit"
			form="new-variation"
			class={button('primary', 'md', true)}
			aria-busy={busy}
			disabled={busy}
		>
			{#if busy}<Spinner size={18} />{:else}<Icon name="plus" size={20} />{/if}{t().moves.move
				.addFigure}
		</button>
	{/snippet}
</Sheet>
