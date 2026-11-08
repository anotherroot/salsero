<script lang="ts">
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { figuresShort, type PositionSheet } from '$lib/positions/map-sheet';
	import { TONE_VAR } from '$lib/positions/map-view';
	import { t } from '$lib/i18n/catalog';

	/**
	 * A tapped position's sheet (spec 2026-11-08-map-walk, "A tap on a position"),
	 * drawn from `positionSheet`, in the spec's order: ‹ the position you stepped
	 * from, the name with its ins and outs and Open, what stays here, From (a chip
	 * per position that leads here: a fresh pick), Step to (a row per place you can
	 * go: a step), Anywhere (no end), and the nothing-out line. `onwalk` is Walk
	 * from here: not drawn without it.
	 *
	 * A new position (a pick, a step, ‹) takes the focus to its name and the panel
	 * back to its top, so the keyboard and a screen reader follow the sheet.
	 */
	let {
		sheet,
		prev,
		onstep,
		onfresh,
		onback,
		onwalk
	}: {
		sheet: PositionSheet;
		/** Where the last step came from: the ‹ pill. Null when you didn't step here. */
		prev: { id: number; name: string } | null;
		/** A Step to row: a step along the trail. */
		onstep: (id: number) => void;
		/** A From chip: a fresh pick. */
		onfresh: (id: number) => void;
		/** ‹: one step back along the trail. */
		onback: () => void;
		onwalk?: () => void;
	} = $props();

	/** Open: the position's page. */
	const href = $derived(
		resolve('/[dance]/(moves)/positions/[id]', {
			dance: page.params.dance ?? '',
			id: String(sheet.id)
		})
	);
	const hid = $props.id();
	let heading: HTMLHeadingElement | undefined = $state();

	$effect(() => {
		void sheet.id;
		untrack(() => {
			if (!heading) return;
			heading.closest('[data-map-panel]')?.scrollTo({ top: 0 });
			heading.focus({ preventScroll: true });
		});
	});

	const nothingOut = $derived(sheet.stepTo.length === 0 && sheet.anywhere.length === 0);

	const LABEL = 'text-[11px] font-extrabold tracking-[0.07em] uppercase';
	const CHIP =
		'inline-flex min-h-8 flex-none items-center rounded-full px-3 text-[12.5px] font-bold whitespace-nowrap';
	const COUNT =
		'inline-grid h-[22px] min-w-6 flex-none place-items-center rounded-full bg-chip px-[7px] text-[12px] font-extrabold text-chip-ink tabular-nums';
</script>

<section aria-labelledby={hid} class="flex flex-col gap-2.5">
	<div class="flex items-start justify-between gap-2.5">
		<div class="flex min-w-0 flex-col gap-[5px]">
			{#if prev}
				<button
					type="button"
					class="inline-flex min-h-8 items-center gap-1 self-start rounded-full bg-chip py-1 pr-3 pl-2 text-[12.5px] font-extrabold whitespace-nowrap text-ink-2 active:brightness-95"
					aria-label={t().map.sheet.backTo(prev.name)}
					onclick={onback}><Icon name="chevron-left" size={15} stroke={2.5} />{prev.name}</button
				>
			{/if}
			<h2
				bind:this={heading}
				id={hid}
				tabindex="-1"
				class="font-display text-[23px] leading-[1.05] font-extrabold text-ink focus-visible:shadow-none! focus-visible:outline-none!"
			>
				{sheet.name}
			</h2>
			<p class="text-[12.5px] leading-[1.3] font-semibold text-muted">
				{t().map.sheet.insOuts(sheet.ins, sheet.outs)}
			</p>
		</div>
		<a class={button('secondary', 'sm')} {href}>{t().map.sheet.open}</a>
	</div>

	{#if onwalk}
		<button type="button" class={button('primary', 'sm', true)} onclick={onwalk}
			>{t().map.sheet.walk}</button
		>
	{/if}

	{#if sheet.stays.length > 0}
		<p class="flex items-start gap-1.5 text-[12.5px] leading-[1.35] font-semibold text-ink-2">
			<span class="mt-px"><Icon name="loop" size={15} /></span>
			<span><b class="font-extrabold">{t().map.sheet.stays}</b> {figuresShort(sheet.stays)}</span>
		</p>
	{/if}

	<!-- From: one row that scrolls sideways on the phone, wraps on the desktop. Rings drawn inside (the row clips). -->
	<div
		class="focus-inset -mx-[18px] flex [scrollbar-width:none] items-center gap-1.5 overflow-x-auto px-[18px] desk:mx-0 desk:flex-wrap desk:px-0"
	>
		<span class="{LABEL} mr-0.5 flex-none text-easy">{t().map.sheet.from}</span>
		{#each sheet.from as f (f.id)}
			<button
				type="button"
				class="{CHIP} bg-easy-soft text-easy active:brightness-95"
				onclick={() => onfresh(f.id)}>{f.name}</button
			>
		{:else}
			<span class="{CHIP} bg-danger-soft text-danger">{t().map.sheet.nothingIn}</span>
		{/each}
	</div>

	<div class="flex flex-col">
		<h3 class="{LABEL} pt-0.5 pb-1 text-accent-text">{t().map.sheet.stepTo}</h3>
		{#if !nothingOut}
			<ul class="focus-inset flex flex-col">
				{#each sheet.stepTo as r (r.id)}
					<li class="border-t border-hairline">
						<button
							type="button"
							class="flex min-h-12 w-full items-center gap-2.5 px-0.5 py-2 text-left active:bg-step"
							onclick={() => onstep(r.id)}
						>
							<span
								aria-hidden="true"
								class="size-2.5 flex-none rounded-full"
								style:background={TONE_VAR[r.tone]}
							></span>
							<span class="flex min-w-0 flex-1 flex-col gap-px">
								<span class="text-[14.5px] leading-[1.25] font-extrabold text-ink">{r.name}</span>
								<span class="truncate text-[12px] leading-[1.3] text-muted">{r.short}</span>
							</span>
							<span aria-hidden="true" class={COUNT}>{r.figs.length}</span>
							<span class="text-chevron"><Icon name="chevron" size={18} /></span>
						</button>
					</li>
				{/each}
				{#if sheet.anywhere.length > 0}
					<!-- Figures that start here and have no end: listed, not a place to step to. -->
					<li class="flex min-h-12 items-center gap-2.5 border-t border-hairline px-0.5 py-2">
						<span
							aria-hidden="true"
							class="size-2.5 flex-none rounded-full border-[1.5px] border-dashed border-field-line"
						></span>
						<span class="flex min-w-0 flex-1 flex-col gap-px">
							<span class="text-[14.5px] leading-[1.25] font-extrabold text-ink"
								>{t().map.sheet.anywhere}</span
							>
							<span class="truncate text-[12px] leading-[1.3] text-muted"
								>{t().map.sheet.noEnd}: {figuresShort(sheet.anywhere)}</span
							>
						</span>
						<span aria-hidden="true" class={COUNT}>{sheet.anywhere.length}</span>
						<span class="w-[18px] flex-none"></span>
					</li>
				{/if}
			</ul>
		{:else}
			<p
				class="rounded-[14px] bg-danger-soft px-3 py-2.5 text-[12.5px] leading-[1.35] font-bold text-danger"
			>
				{t().map.sheet.nothingOut}
			</p>
		{/if}
	</div>
</section>
