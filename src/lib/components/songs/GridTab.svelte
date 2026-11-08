<script lang="ts">
	import BeatMenu from '$lib/components/songs/BeatMenu.svelte';
	import EditGrid from '$lib/components/songs/EditGrid.svelte';
	import SuggestionCard from '$lib/components/songs/SuggestionCard.svelte';
	import type { ToastState } from '$lib/act-toast';
	import { TAP_LATENCY_S, beatIndexAt, nearestBeat } from '$lib/beatgrid/beatgrid';
	import { clock } from '$lib/format';
	import type { IconName } from '$lib/icons/icons';
	import { t } from '$lib/i18n/catalog';
	import type { TempoFactor } from '$lib/labels';
	import { editAct, type UndoOf } from '$lib/songs/edit-act';
	import {
		gridRows,
		parseSections,
		sectionIndexAt,
		sectionName,
		type Placed,
		type Row
	} from '$lib/songs/sections';
	import { menuHeading, plusSectionBeat, tapShift, tapToast } from '$lib/songs/song-edit';
	import { tapProblem } from '$lib/songs/song-page';
	import type { Suggestion } from '$lib/songs/suggest';

	/*
	 * Edit · Grid (spec 2026-11-08): the grid with what goes under its rows (a
	 * beat's menu, a suggestion, the "before" row after a tap), and Tap on the 1
	 * and + Section, which the pinned bar calls (`tap`, `addSection`).
	 */
	let {
		beats,
		counts,
		anchors,
		tempoFactor,
		sections,
		sectionsJson,
		suggestions,
		start,
		now,
		played,
		audio,
		seen,
		toast,
		onjump,
		onstart,
		onsection
	}: {
		beats: number[];
		counts: number[];
		anchors: number[];
		tempoFactor: TempoFactor;
		sections: Placed[];
		sectionsJson: string;
		suggestions: Suggestion[];
		start: { at: number; yours: number | null };
		now: number;
		played: boolean;
		audio: () => { paused: boolean; currentTime: number } | null;
		seen: () => string;
		toast: (t: ToastState | null) => void;
		onjump: (beat: number) => void;
		onstart: () => void;
		/** Open a section's sheet, by its index in the stored list. */
		onsection: (index: number) => void;
	} = $props();

	const rows = $derived(gridRows(beats, counts, sections, start.at));
	/** The beat whose menu is open. */
	let menuBeat = $state<number | null>(null);
	/** The beat just made a 1, lit for a few seconds, and the counts before it. */
	let lit = $state<{ beat: number; before: number[] } | null>(null);
	/** Suggestions put aside with Not now, for this visit to Edit. */
	let skipped = $state<number[]>([]);
	const shown = $derived(suggestions.filter((s) => !skipped.includes(s.beat)));

	const countUndo = (): UndoOf => ({ field: 'count', value: { anchors, tempo: tempoFactor } });
	const sectionsUndo = (): UndoOf => ({ field: 'sections', value: parseSections(sectionsJson) });

	let litTimer: ReturnType<typeof setTimeout> | undefined;
	function light(beat: number, before: number[]) {
		lit = { beat, before };
		clearTimeout(litTimer);
		litTimer = setTimeout(() => (lit = null), 4000);
	}
	$effect(() => () => clearTimeout(litTimer));

	/** A beat becomes the 1 (Make this the 1, Use it): the toast says how far the count moved. */
	async function makeOne(beat: number) {
		const before = [...counts];
		const r = await editAct({
			name: 'one',
			fields: { beat },
			seen,
			message: tapToast(beats[beat], tapShift(before[beat])),
			undo: countUndo(),
			toast
		});
		if (r.type === 'success') light(beat, before);
	}

	/** A tap is out; taps made meanwhile wait here, in order. */
	let tapping = false;
	const queued: { t: number; paused: boolean }[] = [];

	async function sendTap(t: number, paused: boolean) {
		const beat = nearestBeat(beats, t - (paused ? 0 : TAP_LATENCY_S));
		if (beat < 0) return false;
		const before = [...counts];
		const r = await editAct({
			name: 'tap',
			fields: { t, paused: paused ? '1' : '0' },
			seen,
			message: tapToast(beats[beat], tapShift(before[beat])),
			undo: countUndo(),
			toast
		});
		if (r.type !== 'success') return false;
		light(beat, before);
		return true;
	}

	/** Tap on the 1: the beat at the playhead (less the reaction time while playing). */
	export async function tap() {
		const a = audio();
		const problem = tapProblem(a);
		if (problem || !a) {
			toast({ id: Date.now(), message: t().songs.page.tap.playFirst });
			return;
		}
		if (tapping) {
			queued.push({ t: a.currentTime, paused: a.paused });
			return;
		}
		tapping = true;
		try {
			let next: { t: number; paused: boolean } | undefined = {
				t: a.currentTime,
				paused: a.paused
			};
			for (; next; next = queued.shift()) {
				// A refused tap (a clash) would refuse the waiting ones too.
				if (!(await sendTap(next.t, next.paused))) break;
			}
		} finally {
			queued.length = 0;
			tapping = false;
		}
	}

	/** A section on `beat` (made a 1 first when it is not), then its sheet. */
	async function sectionOn(beat: number) {
		const r = await editAct({
			name: 'sectionAdd',
			fields: { beat },
			seen,
			message: t().songs.page.section.added,
			undo: sectionsUndo(),
			toast
		});
		if (r.type === 'success' && typeof r.data?.index === 'number') onsection(r.data.index);
	}

	/** + Section: at the 1 of the eight that is playing. */
	export function addSection() {
		void sectionOn(plusSectionBeat(counts, played ? beatIndexAt(beats, now) : 0));
	}

	function menuItems(b: number) {
		const close = (fn: () => unknown) => () => {
			menuBeat = null;
			void fn();
		};
		const w = t().songs.page.menu;
		const items: { key: string; icon: IconName; label: string; onclick: () => void }[] = [];
		if (counts[b] !== 1)
			items.push({ key: 'one', icon: 'flag', label: w.one, onclick: close(() => makeOne(b)) });
		if (!sections.some((s) => s.beat === b))
			items.push({
				key: 'section',
				icon: 'plus',
				label: w.section,
				onclick: close(() => sectionOn(b))
			});
		if (anchors.includes(b))
			items.push({
				key: 'remove',
				icon: 'minus',
				label: w.remove,
				onclick: close(() =>
					editAct({
						name: 'removeAnchor',
						fields: { beat: b },
						seen,
						message: w.removed(clock(beats[b])),
						undo: countUndo(),
						toast
					})
				)
			});
		items.push({
			key: 'start',
			icon: 'play',
			label: w.start,
			onclick: close(() =>
				editAct({
					name: 'start',
					fields: { t: beats[b] },
					seen,
					message: t().songs.page.edit.start.doneHere(clock(beats[b])),
					undo: { field: 'start', value: start.yours },
					toast
				})
			)
		});
		return items;
	}

	function heading(b: number): string {
		const k = sectionIndexAt(sections, b);
		const off = k >= 0 && sections[k].countOff;
		return menuHeading(beats[b], off ? null : counts[b], k >= 0 ? sectionName(sections[k]) : null);
	}

	function closeMenu() {
		const b = menuBeat;
		menuBeat = null;
		if (b !== null) document.querySelector<HTMLElement>(`[data-beat="${b}"]`)?.focus();
	}

	const inRow = (row: Row, beat: number) => beat >= row.start && beat < row.end;
</script>

<p class="px-3 pt-2 text-center text-[13px] leading-[1.45] text-muted">
	{t().songs.page.grid.hint}
</p>
<EditGrid
	{beats}
	{counts}
	{anchors}
	{sections}
	{rows}
	playing={played ? beatIndexAt(beats, now) : -1}
	startS={start.at}
	lit={lit?.beat ?? null}
	outlined={shown.map((s) => s.beat)}
	{onjump}
	onmenu={(b) => (menuBeat = b)}
	{onsection}
	{onstart}
>
	{#snippet below(row)}
		{#if lit && inRow(row, lit.beat)}
			<div
				class="flex items-center gap-1.5 px-1 text-muted line-through"
				aria-label={t().songs.page.tap.before}
			>
				<span class="w-9 flex-none text-[11px] font-semibold">{t().songs.page.tap.before}</span>
				<div class="flex gap-0.5">
					{#each Array.from({ length: row.end - row.start }, (_, k) => row.start + k) as i (i)}
						<span class="flex h-7 w-[30px] items-center justify-center text-[13px] tabular-nums"
							>{lit.before[i]}</span
						>
					{/each}
				</div>
			</div>
		{/if}
		{#if menuBeat !== null && inRow(row, menuBeat)}
			<BeatMenu heading={heading(menuBeat)} items={menuItems(menuBeat)} onclose={closeMenu} />
		{/if}
		{#each shown.filter((s) => inRow(row, s.beat)) as s (s.beat)}
			<SuggestionCard
				suggestion={s}
				onuse={() => makeOne(s.beat)}
				onskip={() => (skipped = [...skipped, s.beat])}
			/>
		{/each}
	{/snippet}
</EditGrid>
