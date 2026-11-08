<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { FIELD, LABEL, button, rowButton } from '$lib/components/ui/styles';
	import { guarded, track } from '$lib/unsaved/guard.svelte';
	import { holdReloadWhile } from '$lib/nav/fresh.svelte';
	import { sendAt } from '$lib/act';
	import { invalidate } from '$app/navigation';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { TONE_VAR, type MapData, type MapFig } from '$lib/positions/map-view';
	import {
		currentOf,
		figureCount,
		figureIds,
		nextFrom,
		saveOutcome,
		stripOf,
		type Walk
	} from '$lib/positions/walk';
	import { t } from '$lib/i18n/catalog';

	/**
	 * The walk (spec 2026-11-08-map-walk, "Walking a routine"), in the map's panel:
	 * the title and where the walk stands, Undo, the strip of what was walked, the
	 * places to go next with a + chip per figure, Anywhere (no end), Fits anywhere
	 * (collapsed), the carry-on and stuck lines, and a footer that stays at the
	 * panel's foot: Clear and Make routine · N.
	 *
	 * Make routine opens a New routine sheet posting to the map's `routine` action
	 * (by its explicit URL: on the desktop the map is the Positions list's pane).
	 * While the walk has figures it is unsaved: leaving asks, and the dialog's Save
	 * makes the routine under "Walk from <start>" without moving the page
	 * (`sendAt`), so the way the person was going carries on. `node` is this
	 * sheet, the scope its owner asks about on Back.
	 */
	let {
		map,
		walk,
		onadd,
		onundo,
		onclear,
		onsaved,
		onmade,
		node = $bindable(null)
	}: {
		map: MapData;
		walk: Walk;
		/** A + chip: the figure, and where it ends (null: nowhere). */
		onadd: (fig: MapFig, to: number | null) => void;
		onundo: () => void;
		onclear: () => void;
		/** The dialog's Save made the routine: the walk is over. */
		onsaved: () => void;
		/** Make routine made it: the walk and its panel close before the routine page opens. */
		onmade: () => void;
		node?: HTMLElement | null;
	} = $props();

	const dance = $derived(page.params.dance ?? '');
	const action = $derived(`/${dance}/positions/map`);
	const routineAction = $derived(`${action}?/routine`);
	const nameOf = (id: number) => map.positions.find((p) => p.id === id)?.name ?? '';
	const toneOf = (id: number) => TONE_VAR[map.positions.find((p) => p.id === id)?.tone ?? 'muted'];

	const current = $derived(currentOf(walk));
	const count = $derived(figureCount(walk));
	const startName = $derived(nameOf(walk.start));
	const next = $derived(current === null ? null : nextFrom(map, current));
	const strip = $derived(stripOf(walk));
	/** The figure with no end the walk stands after. */
	const loose = $derived.by(() => {
		const last = walk.steps.at(-1);
		return current === null && last?.kind === 'figure' ? last.fig.label : null;
	});
	const fits = $derived(nextFrom(map, walk.start).fitsAnywhere);

	let fitsOpen = $state(false);
	let naming = $state(false);
	let busy = $state(false);
	/** The Make routine form is out: the walk is not "unsaved" while its own save redirects. */
	let making = $state(false);
	let refusal = $state<{ field?: string; message?: string; name?: string } | null>(null);
	const nameError = $derived(refusal?.field === 'name' ? refusal.message : undefined);
	const bannerError = $derived(refusal?.field ? undefined : refusal?.message);

	const hid = $props.id();
	const formId = `${hid}-routine`;
	let heading: HTMLHeadingElement | undefined = $state();
	let stripEl: HTMLOListElement | undefined = $state();

	holdReloadWhile(() => count > 0);

	$effect(() => {
		if (!node) return;
		return track({
			get label() {
				return t().map.walk.unsaved;
			},
			node,
			dirty: () => figureCount(walk) > 0 && !making,
			save: async () => {
				const o = saveOutcome(
					await sendAt(action, 'routine', {
						name: t().map.walk.defaultName(startName),
						figureIds: figureIds(walk)
					}),
					t().shell.unsaved.didNotSave
				);
				if (o.ok) {
					// The (moves) lists load once: the Routines list must hear of the new routine.
					await invalidate('app:moves');
					onsaved();
				}
				return o;
			}
		});
	});

	// Each step: the panel back to its top (the next places start there), the
	// focus on the title (a tapped chip is gone), and the strip to its end.
	let steps = -1;
	$effect(() => {
		const n = walk.steps.length;
		if (n === steps) return;
		const first = steps === -1;
		steps = n;
		void tick().then(() => {
			if (!heading) return;
			heading.closest('[data-map-panel]')?.scrollTo({ top: 0 });
			const lost = !document.activeElement || document.activeElement === document.body;
			if (first || lost) heading.focus({ preventScroll: true });
			stripEl?.scrollTo({ left: stripEl.scrollWidth });
		});
	});

	const LABEL_ = 'text-[11px] font-extrabold tracking-[0.07em] uppercase';
	const PICK =
		'inline-flex min-h-8 items-center rounded-full border-[1.5px] border-accent bg-surface px-[11px] py-[5px] text-left text-[12.5px] leading-[1.25] font-bold text-ink active:bg-step';
	const STEP =
		'inline-flex flex-none items-center gap-1.5 rounded-full py-1 text-[12px] leading-5 font-extrabold whitespace-nowrap text-ink';
</script>

{#snippet chip(fig: MapFig, to: number | null, suffix: string | null = null)}
	<button type="button" class={PICK} onclick={() => onadd(fig, to)}
		>+ {fig.label}{#if suffix}&nbsp;<span class="font-semibold text-muted">{suffix}</span
			>{/if}</button
	>
{/snippet}

{#snippet group(dot: string | null, title: string, figs: { fig: MapFig; to: number | null }[])}
	<div class="flex flex-col gap-[7px] border-t border-hairline py-[9px]">
		<p class="flex items-center gap-2.5 text-[14px] leading-[1.25] font-extrabold text-ink">
			{#if dot}
				<span aria-hidden="true" class="size-2.5 flex-none rounded-full" style:background={dot}
				></span>
			{:else}
				<span
					aria-hidden="true"
					class="size-2.5 flex-none rounded-full border-[1.5px] border-dashed border-field-line"
				></span>
			{/if}
			{title}
		</p>
		<div class="flex flex-wrap gap-1.5">
			{#each figs as f, i (i)}
				{@render chip(f.fig, f.to)}
			{/each}
		</div>
	</div>
{/snippet}

<section bind:this={node} aria-labelledby={hid} class="flex grow flex-col gap-2.5">
	<div class="flex items-start justify-between gap-2.5">
		<div class="flex min-w-0 flex-col gap-[3px]">
			<h2
				bind:this={heading}
				id={hid}
				tabindex="-1"
				class="font-display text-[20px] leading-[1.1] font-extrabold text-ink focus-visible:shadow-none! focus-visible:outline-none!"
			>
				{t().map.walk.title(startName)}
			</h2>
			<p role="status" class="text-[12.5px] leading-[1.3] font-semibold text-muted">
				{t().map.walk.status(count, current === null ? null : nameOf(current))}
			</p>
		</div>
		<button
			type="button"
			class={button('secondary', 'sm')}
			disabled={walk.steps.length === 0}
			onclick={onundo}><Icon name="undo" size={18} />{t().map.walk.undo}</button
		>
	</div>

	{#if strip.length === 0}
		<p class="text-[12.5px] leading-[1.4] font-semibold text-ink-2">{t().map.walk.hint}</p>
	{:else}
		<!-- What was walked: one row that scrolls sideways (rings drawn inside: the row clips). -->
		<ol
			bind:this={stripEl}
			aria-label={t().map.walk.path}
			class="focus-inset -mx-[18px] flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-[18px] pb-0.5 desk:-mx-5 desk:px-5"
		>
			{#each strip as s, i (i)}
				<li class="flex flex-none">
					{#if s.kind === 'figure'}
						<span class="{STEP} bg-accent-soft pr-[11px] pl-1"
							><span
								aria-hidden="true"
								class="grid size-5 place-items-center rounded-full bg-accent text-[11px] text-on-accent"
								>{s.n}</span
							>{s.label}</span
						>
					{:else}
						<span class="{STEP} bg-chip px-[11px]"
							>{i === 0 ? nameOf(s.at) : t().map.walk.to(nameOf(s.at))}</span
						>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	{#if loose !== null}
		<p class="rounded-[14px] bg-chip px-3 py-2.5 text-[12.5px] leading-[1.35] font-bold text-ink-2">
			{t().map.walk.carryOn(loose)}
		</p>
	{:else if next && current !== null}
		{#if next.groups.length === 0}
			<p
				class="rounded-[14px] bg-danger-soft px-3 py-2.5 text-[12.5px] leading-[1.35] font-bold text-danger"
			>
				{t().map.walk.stuck(nameOf(current))}
			</p>
		{:else}
			<div class="flex flex-col">
				<h3 class="{LABEL_} pt-0.5 pb-1.5 text-accent-text">
					{t().map.walk.next(nameOf(current), next.groups.length)}
				</h3>
				{#each next.groups as g, i (g.to ?? `any-${i}`)}
					{@render group(
						g.to === null ? null : toneOf(g.to),
						g.to === null
							? t().map.walk.anywhere
							: g.stays
								? t().map.walk.stays(nameOf(g.to))
								: t().map.walk.to(nameOf(g.to)),
						g.figs.map((fig) => ({ fig, to: g.to }))
					)}
				{/each}
			</div>
		{/if}
	{/if}

	{#if fits.length > 0}
		<!-- Figures with no start fit after anything (`meet`): collapsed at the end. -->
		<div class="flex flex-col border-t border-hairline">
			<button
				type="button"
				class="flex min-h-11 items-center gap-2.5 text-left text-[14px] font-extrabold text-ink-2"
				aria-expanded={fitsOpen}
				onclick={() => (fitsOpen = !fitsOpen)}
			>
				<span
					aria-hidden="true"
					class="size-2.5 flex-none rounded-full border-[1.5px] border-dashed border-field-line"
				></span>
				<span class="flex-1">{t().map.walk.fitsAnywhere(fits.length)}</span>
				<Icon name={fitsOpen ? 'chevron-up' : 'chevron-down'} size={18} />
			</button>
			{#if fitsOpen}
				<div class="flex flex-wrap gap-1.5 pb-2">
					{#each fits as f, i (i)}
						{@render chip(f.fig, f.to, f.to === null ? null : t().map.walk.to(nameOf(f.to)))}
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Stays at the panel's foot while the rest scrolls (the panel's padding is under it). -->
	<div
		class="sticky -bottom-3.5 mt-auto flex gap-2 bg-surface pt-2.5 pb-3.5 desk:-bottom-5 desk:pb-5"
	>
		<button type="button" class={rowButton('secondary')} onclick={onclear}
			>{t().map.walk.clear}</button
		>
		<button
			type="button"
			class={rowButton('primary')}
			disabled={count === 0}
			onclick={() => {
				refusal = null;
				naming = true;
			}}>{t().map.walk.make(count)}</button
		>
	</div>

	{#if naming}
		<Sheet title={t().map.walk.newRoutine} open={true} onclose={() => (naming = false)}>
			<form
				id={formId}
				method="POST"
				action={routineAction}
				class="flex flex-col gap-3.5"
				use:guarded={{
					label: t().map.walk.newRoutine,
					submit: ({ cancel }) => {
						if (busy) return cancel();
						busy = true;
						making = true;
						return async ({ result, update }) => {
							try {
								if (result.type === 'failure') refusal = result.data ?? null;
								else if (result.type === 'error') {
									const o = saveOutcome(result, t().shell.unsaved.didNotSave);
									refusal = { message: o.ok ? undefined : o.message };
								} else if (result.type === 'redirect') {
									// As the Routines list does: the sheets close (this one, the walk, the
									// panel), then the new routine opens once their Back has landed, so
									// no map entry is left between it and the page before.
									naming = false;
									onmade();
									await gotoWhenSettled(result.location, { invalidateAll: true });
								} else await update();
							} finally {
								busy = false;
								making = false;
							}
						};
					}
				}}
			>
				{#if bannerError}<Banner kind="error">{bannerError}</Banner>{/if}
				{#each figureIds(walk) as id, i (i)}
					<input type="hidden" name="figureIds" value={id} />
				{/each}
				<div>
					<label class={LABEL} for="{hid}-name">{t().map.walk.name}</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="{hid}-name"
						name="name"
						required
						autofocus
						maxlength="200"
						value={refusal?.name ?? t().map.walk.defaultName(startName)}
						class={FIELD}
						aria-invalid={nameError ? 'true' : undefined}
						aria-describedby={nameError ? `${hid}-name-error` : undefined}
					/>
					{#if nameError}<FieldError id="{hid}-name-error" message={nameError} />{/if}
				</div>
				<ol class="flex flex-col gap-1.5">
					{#each strip as s, i (i)}
						{#if s.kind === 'figure'}
							<li class="flex items-center gap-2.5 text-[15px] font-bold text-ink">
								<span
									aria-hidden="true"
									class="grid size-[26px] flex-none place-items-center rounded-full bg-accent text-[13px] font-extrabold text-on-accent"
									>{s.n}</span
								>{s.label}
							</li>
						{/if}
					{/each}
				</ol>
			</form>

			{#snippet footer()}
				<button
					type="submit"
					form={formId}
					class={button('primary', 'md', true)}
					aria-busy={busy}
					aria-label={busy ? t().map.walk.creating : undefined}
				>
					{#if busy}<Spinner />{:else}{t().map.walk.create}{/if}
				</button>
			{/snippet}
		</Sheet>
	{/if}
</section>
