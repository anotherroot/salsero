<script lang="ts">
	/**
	 * The preview sheet over a picker (picker preview, S1): a level stacked on the
	 * picker, which stays open underneath as it was. A figure: its section's video
	 * (muted, looping), start → end positions and length, the first lines of its
	 * notes, where it comes from, Back and the picker's own verb. A move: its
	 * variations, each with its picture and positions line. Light: a stacked
	 * `Sheet` (it holds its own history entry). Dark, inside the full-screen
	 * player: a `PlayerLayer` over the picker's layer. It fetches its own data
	 * (`/api/figures/[id]/look`, `/api/moves/[id]/look`, answered on the device
	 * offline); the picker itself never fetches.
	 */
	import { t } from '$lib/i18n/catalog';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import PlayerLayer from '$lib/components/ui/PlayerLayer.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import LookVideo from './LookVideo.svelte';
	import PreviewButton from './PreviewButton.svelte';
	import { MOVE_ROWS, sheetUrl, sideWords, verbOf, videoFrom } from '$lib/picker/look-view';
	import { lookLine } from '$lib/video/loops';
	import type { FigureSheet, MoveSheet, Picture } from '$lib/types';

	interface Props {
		open: boolean;
		look: { kind: 'figure' | 'move'; id: number };
		/** The row's label: the title while the data comes. */
		label: string;
		/** The row's picture: names the section the video is, and moves when it cannot play. */
		picture: Picture;
		/** The picker's kind: the verb says what a tap on the row does. */
		verb: 'link' | 'act' | 'field';
		/** Already linked: "✓ Linked" in place of the verb. */
		linked: boolean;
		theme?: 'light' | 'dark';
		/** Dark: above the picker's layer. */
		z?: string;
		/** Desktop: a Link popup level, as the picker under it. */
		level?: boolean;
		/** The verb: exactly what a tap on the row does. */
		onpick: () => void;
		onclose: () => void;
	}

	let {
		open,
		look,
		label,
		picture,
		verb,
		linked,
		theme = 'light',
		z,
		level,
		onpick,
		onclose
	}: Props = $props();

	let figure = $state<FigureSheet | null>(null);
	let move = $state<MoveSheet | null>(null);
	let failed = $state(false);

	$effect(() => {
		if (!open) return;
		const url = sheetUrl(look, picture);
		const kind = look.kind;
		figure = null;
		move = null;
		failed = false;
		const ctl = new AbortController();
		fetch(url, { signal: ctl.signal })
			.then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
			.then((d) => {
				if (kind === 'figure') figure = d as FigureSheet;
				else move = d as MoveSheet;
			})
			.catch(() => {
				if (!ctl.signal.aborted) failed = true;
			});
		return () => ctl.abort();
	});

	const title = $derived(figure?.label ?? move?.name ?? label);
</script>

{#snippet positionsCard(top: string, names: string[])}
	<div class="min-w-0 rounded-xl border border-hairline bg-surface px-3 py-2">
		<p class="text-[12px] leading-[1.3] font-bold text-muted">{top}</p>
		<p class="text-[15px] leading-[1.3] font-bold break-words text-ink">
			{names.length > 0 ? sideWords(names) : t().picker.look.noPositions}
		</p>
	</div>
{/snippet}

{#snippet figureBody(f: FigureSheet)}
	{#if f.video}
		<LookVideo
			src={f.video.src}
			startMs={f.video.startMs}
			endMs={f.video.endMs}
			picture={f.picture}
		/>
		<p class="-mt-1 text-[13px] text-muted">{videoFrom(f.video.from)}</p>
	{:else}
		<div
			class="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-accent-soft text-[15px] font-bold text-accent-text desk:max-h-[70dvh]"
		>
			<Icon name="video" size={28} />{t().picker.look.noVideo}
		</div>
	{/if}
	{#if f.starts.length === 0 && f.ends.length === 0}
		{@render positionsCard(
			f.length === null
				? t().picker.look.startsOn(f.startCount)
				: `${t().picker.look.startsOn(f.startCount)} · ${t().nouns.counts(f.length)}`,
			[]
		)}
	{:else}
		<div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-1.5">
			{@render positionsCard(t().picker.look.startsOn(f.startCount), f.starts)}
			<span class="flex items-center text-[20px] font-extrabold text-accent-text" aria-hidden="true"
				>→</span
			>
			{@render positionsCard(
				f.length === null ? t().picker.look.ends : t().picker.look.endsAfter(f.length),
				f.ends
			)}
		</div>
	{/if}
	{#if f.notes}
		<p class="line-clamp-3 text-[15px] leading-[1.45] whitespace-pre-line text-ink-2">{f.notes}</p>
	{/if}
	<p class="flex items-center gap-2 text-[14px] text-ink-2">
		<span class="text-muted"
			><Icon name={f.from.kind === 'mine' ? 'solo' : 'group'} size={18} /></span
		>
		{f.from.kind === 'mine'
			? t().picker.elsewhere.yours
			: f.from.readOnly
				? t().picker.elsewhere.readOnly(f.from.name)
				: f.from.name}
	</p>
{/snippet}

{#snippet moveBody(m: MoveSheet)}
	<div class="divide-y divide-hairline rounded-2xl bg-surface">
		{#each m.variations.slice(0, MOVE_ROWS) as v (v.id)}
			<div class="flex min-h-14 items-center gap-3 px-4 py-2">
				<PreviewButton picture={v.look.picture} label={v.name} decorative onclick={() => {}} />
				<div class="min-w-0 flex-1">
					<p class="truncate text-[16px] leading-[1.3] font-bold text-ink">{v.name}</p>
					{#if lookLine(v.look)}
						<p class="truncate text-[13px] leading-[1.35] text-muted">{lookLine(v.look)}</p>
					{/if}
				</div>
			</div>
		{/each}
	</div>
	{#if m.variations.length > MOVE_ROWS}
		<p class="px-1 text-[13px] text-muted">
			{t().picker.look.andMore(m.variations.length - MOVE_ROWS)}
		</p>
	{/if}
{/snippet}

{#snippet body()}
	<div class="flex flex-col gap-3.5 pb-2">
		{#if failed}
			<Banner kind="error" title={t().picker.look.failed}>{t().picker.tryAgain}</Banner>
		{:else if figure}
			{@render figureBody(figure)}
		{:else if move}
			{@render moveBody(move)}
		{:else}
			<div class="aspect-video w-full rounded-2xl bg-skeleton desk:max-h-[70dvh]" aria-busy="true">
				<span role="status" class="sr-only">{t().picker.loading}</span>
			</div>
		{/if}
	</div>
{/snippet}

{#snippet footer()}
	<div class="grid grid-cols-2 gap-2.5">
		<button type="button" class={button('secondary', 'md', true)} onclick={onclose}
			>{t().common.back}</button
		>
		{#if linked}
			<button type="button" class={button('primary', 'md', true)} disabled
				><Icon name="check" size={18} />{t().picker.linked}</button
			>
		{:else}
			<button type="button" class={button('primary', 'md', true)} onclick={onpick}
				>{verbOf(verb)}</button
			>
		{/if}
	</div>
{/snippet}

{#if theme === 'dark'}
	{#if open}
		<PlayerLayer {title} back {z} {level} {footer} {onclose}>
			{@render body()}
		</PlayerLayer>
	{/if}
{:else}
	<Sheet {title} {open} back {level} {footer} {onclose}>
		{@render body()}
	</Sheet>
{/if}
