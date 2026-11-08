<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import type { ToastState } from '$lib/act-toast';
	import { clock } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import { TEMPO_FACTORS, TEMPO_LABEL, type TempoFactor } from '$lib/labels';
	import { editAct } from '$lib/songs/edit-act';
	import { clearLines, startRow, tempoAskBody } from '$lib/songs/song-edit';
	import type { SampleSong } from '$lib/types';

	/*
	 * Edit · Song (spec 2026-11-08): the count speed, the sample, where the
	 * music starts, Song details, and Clear all. Every change saves at once,
	 * with Undo in the toast. "Here" is the pinned player's playhead.
	 */
	let {
		now,
		name,
		anchors,
		tempoFactor,
		sections,
		sectionsJson,
		sample,
		start,
		seen,
		toast,
		ondetails,
		startGroup = $bindable()
	}: {
		now: number;
		name: string;
		anchors: number[];
		tempoFactor: TempoFactor;
		/** How many sections there are. */
		sections: number;
		/** The stored list, for Clear all's Undo. */
		sectionsJson: string;
		sample: { song: SampleSong; custom: boolean } | null;
		start: { at: number; source: 'yours' | 'found' | 'unmeasured'; yours: number | null };
		seen: () => string;
		toast: (t: ToastState | null) => void;
		ondetails: () => void;
		/** The Music starts group, so the grid's ✎ can bring it into view. */
		startGroup?: HTMLElement;
	} = $props();

	const w = $derived(t().songs.page.edit);
	const count = $derived({ anchors, tempo: tempoFactor });
	let tempo = $derived(String(tempoFactor));
	/** The count speed waiting for an answer to "This clears your 1s." */
	let asking: TempoFactor | null = $state(null);
	const clear = $derived(clearLines(anchors.length, sections));
	const startLine = $derived(startRow(start));

	function setTempo(f: TempoFactor) {
		void editAct({
			name: 'tempo',
			fields: { factor: f },
			seen,
			message: w.speed.done(TEMPO_LABEL[f]),
			undo: () => ({ field: 'count', value: count }),
			toast
		}).then((r) => {
			if (r.type !== 'success') tempo = String(tempoFactor);
		});
	}

	function pickTempo(v: string) {
		const f = Number(v) as TempoFactor;
		if (anchors.length > 0) asking = f;
		else setTempo(f);
	}

	function cancelTempo() {
		asking = null;
		tempo = String(tempoFactor);
	}

	const sampleBefore = $derived(sample?.custom ? sample.song.startS : null);
</script>

<h2 class="{SECTION_LABEL} pt-2">{w.speed.title}</h2>
<Segmented
	name="factor"
	label={w.speed.title}
	items={TEMPO_FACTORS.map((f) => ({ value: String(f), label: TEMPO_LABEL[f] }))}
	bind:value={tempo}
	onchange={pickTempo}
/>
<p class="px-3 text-[13px] leading-[1.45] text-muted">{w.speed.help}</p>

{#if sample}
	<h2 class="{SECTION_LABEL} pt-3.5">{w.sample.title}</h2>
	<div class={GROUP}>
		<div class="flex min-h-16 items-center gap-1 pr-1 pl-4">
			<div class="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
				<span class="flex items-center gap-1.5">
					<span class="text-[16px] leading-[1.3] font-bold text-ink tabular-nums"
						>{w.sample.from(clock(sample.song.startS))}</span
					>
					<Badge tone={sample.custom ? 'accent' : 'neutral'}
						>{sample.custom ? w.sample.yours : w.sample.automatic}</Badge
					>
				</span>
				<span class="text-[13px] leading-[1.35] text-muted"
					>{sample.custom ? w.sample.yoursMeta : w.sample.autoMeta}</span
				>
			</div>
			<SampleButton song={sample.song} {name} />
		</div>
		<button
			type="button"
			class="focus-inset flex min-h-14 w-full cursor-pointer flex-col justify-center gap-0.5 px-4 py-2 text-left"
			onclick={() =>
				editAct({
					name: 'sample',
					fields: { t: now },
					seen,
					message: w.sample.doneHere(clock(now)),
					undo: () => ({ field: 'sample', value: sampleBefore }),
					toast
				})}
		>
			<span class="text-[16px] font-bold text-accent-text">{w.sample.here}</span>
			<span class="text-[13px] text-muted tabular-nums">{w.sample.hereMeta(clock(now))}</span>
		</button>
		{#if sample.custom}
			<button
				type="button"
				class="focus-inset flex min-h-14 w-full cursor-pointer items-center px-4 text-left text-[16px] font-bold text-accent-text"
				onclick={() =>
					editAct({
						name: 'sampleAuto',
						seen,
						message: w.sample.doneBack,
						undo: () => ({ field: 'sample', value: sampleBefore }),
						toast
					})}>{w.sample.back}</button
			>
		{/if}
	</div>
{/if}

<h2 class="{SECTION_LABEL} pt-3.5" bind:this={startGroup} tabindex="-1">{w.start.title}</h2>
<div class={GROUP}>
	<div class="flex min-h-14 flex-col justify-center gap-0.5 px-4 py-2">
		<span class="text-[16px] font-bold text-ink tabular-nums">{startLine.title}</span>
		<span class="text-[13px] text-muted">{startLine.meta}</span>
	</div>
	<button
		type="button"
		class="focus-inset flex min-h-14 w-full cursor-pointer flex-col justify-center gap-0.5 px-4 py-2 text-left"
		onclick={() =>
			editAct({
				name: 'start',
				fields: { t: now },
				seen,
				message: w.start.doneHere(clock(now)),
				undo: () => ({ field: 'start', value: start.yours }),
				toast
			})}
	>
		<span class="text-[16px] font-bold text-accent-text">{w.start.here}</span>
		<span class="text-[13px] text-muted tabular-nums">{w.start.hereMeta(clock(now))}</span>
	</button>
	{#if start.source !== 'unmeasured' && start.at !== 0}
		<button
			type="button"
			class="focus-inset flex min-h-14 w-full cursor-pointer flex-col justify-center gap-0.5 px-4 py-2 text-left"
			onclick={() =>
				editAct({
					name: 'startZero',
					seen,
					message: w.start.doneZero,
					undo: () => ({ field: 'start', value: start.yours }),
					toast
				})}
		>
			<span class="text-[16px] font-bold text-accent-text">{w.start.zero}</span>
			<span class="text-[13px] text-muted">{w.start.zeroMeta}</span>
		</button>
	{/if}
	{#if start.source === 'yours'}
		<button
			type="button"
			class="focus-inset flex min-h-14 w-full cursor-pointer items-center px-4 text-left text-[16px] font-bold text-accent-text"
			onclick={() =>
				editAct({
					name: 'startFound',
					seen,
					message: w.start.doneBack,
					undo: () => ({ field: 'start', value: start.yours }),
					toast
				})}>{w.start.back}</button
		>
	{/if}
</div>

<div class="{GROUP} mt-3.5">
	<button
		type="button"
		class="focus-inset flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left"
		onclick={ondetails}
	>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] font-bold text-ink">{w.details}</span>
			<span class="text-[13px] text-muted">{w.detailsMeta}</span>
		</span>
		<span class="text-muted"><Icon name="chevron-right" size={20} /></span>
	</button>
</div>

{#if clear.ones || clear.sections}
	<div class="{GROUP} mt-3.5">
		{#if clear.ones}
			<button
				type="button"
				class="focus-inset flex min-h-14 w-full cursor-pointer flex-col justify-center gap-0.5 px-4 py-2 text-left"
				onclick={() =>
					editAct({
						name: 'resetAnchors',
						seen,
						message: w.clear.doneOnes,
						undo: () => ({ field: 'count', value: count }),
						toast
					})}
			>
				<span class="text-[16px] font-bold text-danger">{w.clear.ones}</span>
				<span class="text-[13px] text-muted">{clear.ones}</span>
			</button>
		{/if}
		{#if clear.sections}
			<button
				type="button"
				class="focus-inset flex min-h-14 w-full cursor-pointer flex-col justify-center gap-0.5 px-4 py-2 text-left"
				onclick={() =>
					editAct({
						name: 'sectionsClear',
						seen,
						message: w.clear.doneSections,
						undo: () => ({ field: 'sections', value: JSON.parse(sectionsJson) }),
						toast
					})}
			>
				<span class="text-[16px] font-bold text-danger">{w.clear.sections}</span>
				<span class="text-[13px] text-muted">{clear.sections}</span>
			</button>
		{/if}
	</div>
{/if}

<Dialog
	open={asking !== null}
	icon="metronome"
	title={w.speed.askTitle}
	body={asking === null ? '' : tempoAskBody(anchors.length, asking)}
	onclose={cancelTempo}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={cancelTempo}
			>{t().common.cancel}</button
		>
		<button
			type="button"
			class={button('primary', 'sm')}
			onclick={() => {
				const f = asking;
				asking = null;
				if (f !== null) setTempo(f);
			}}>{w.speed.change}</button
		>
	{/snippet}
</Dialog>
