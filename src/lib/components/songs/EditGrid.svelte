<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { clock } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import { longPress } from '$lib/longpress';
	import { followRow, gridKey, shouldFollow, tabBeat } from '$lib/songs/grid-keys';
	import { untrack } from 'svelte';
	import { sectionIndexAt, sectionName, type Placed, type Row } from '$lib/songs/sections';
	import { beatLabel } from '$lib/songs/song-edit';

	/*
	 * Edit · Grid (spec 2026-11-08): the whole song, a row per eight, under
	 * plain section headings. It follows the song; a tap on a beat jumps there,
	 * a hold (long press, right-click, Shift+F10) opens the beat's menu. One tab
	 * stop: the arrows move between beats.
	 */
	let {
		beats,
		counts,
		anchors,
		sections,
		rows,
		playing,
		follow,
		startS,
		lit = null,
		outlined = [],
		onjump,
		onmenu,
		onsection,
		onstart,
		below
	}: {
		beats: number[];
		counts: number[];
		anchors: number[];
		sections: Placed[];
		rows: Row[];
		/** The beat playing, or -1. */
		playing: number;
		/** The song is playing: the grid keeps its row in view. */
		follow: boolean;
		/** Where the music starts; the rows before it fold. */
		startS: number;
		/** A beat to light (the one just made a 1). */
		lit?: number | null;
		/** Beats outlined dashed (a suggestion). */
		outlined?: number[];
		onjump: (beat: number) => void;
		onmenu: (beat: number) => void;
		onsection: (index: number) => void;
		onstart: () => void;
		/** What goes under a row: its menu, a suggestion, the "before" row. */
		below?: Snippet<[Row]>;
	} = $props();

	const anchorSet = $derived(new Set(anchors));
	const outlinedSet = $derived(new Set(outlined));
	const quietRows = $derived(rows.filter((r) => r.quiet));
	let quietOpen = $state(false);
	/** The beat that takes the grid's one tab stop. */
	let focusBeat = $state(0);
	let grid: HTMLElement | undefined = $state();

	const playingRow = $derived(rows.findIndex((r) => playing >= r.start && playing < r.end));

	/** The section a beat is in, if its count is off. */
	function offAt(i: number): Placed | null {
		const k = sectionIndexAt(sections, i);
		return k >= 0 && sections[k].countOff ? sections[k] : null;
	}

	function label(i: number): string {
		const k = sectionIndexAt(sections, i);
		const name = k >= 0 ? sectionName(sections[k]) : null;
		return beatLabel(beats[i], offAt(i) ? null : counts[i], name, anchorSet.has(i));
	}

	// Follow the song, unless the person scrolled by hand just now.
	let lastHand = 0;
	$effect(() => {
		const hand = () => (lastHand = Date.now());
		window.addEventListener('wheel', hand, { passive: true });
		window.addEventListener('touchmove', hand, { passive: true });
		return () => {
			window.removeEventListener('wheel', hand);
			window.removeEventListener('touchmove', hand);
		};
	});
	// Only while it plays, and only when the playing row changes: a save while
	// paused (a new 1, a section) must not pull the grid back to the playhead.
	let followed = -1;
	$effect(() => {
		const row = playingRow;
		const go = followRow(followed, row, follow);
		followed = row;
		if (!go) return;
		untrack(() => {
			if (!grid || !shouldFollow(Date.now(), lastHand)) return;
			grid
				.querySelector(`[data-row="${rows[row].start}"]`)
				?.scrollIntoView({ block: 'center', behavior: 'smooth' });
		});
	});

	const press = longPress({
		ms: 450,
		tolerancePx: 10,
		enabled: () => true,
		onLongPress: (beat) => onmenu(beat)
	});

	function cell(e: Event): number | null {
		const el = (e.target as HTMLElement).closest<HTMLElement>('[data-beat]');
		return el ? Number(el.dataset.beat) : null;
	}

	function keydown(e: KeyboardEvent) {
		const at = cell(e);
		if (at === null) return;
		if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
			e.preventDefault();
			onmenu(at);
			return;
		}
		const to = gridKey(e.key, at, visible);
		if (to === null) return;
		e.preventDefault();
		focusBeat = to;
		grid?.querySelector<HTMLElement>(`[data-beat="${to}"]`)?.focus();
	}

	/** The rows a person can reach: the quiet ones only while opened. */
	const visible = $derived(quietOpen ? rows : rows.filter((r) => !r.quiet));
	const firstLoud = $derived(rows.find((r) => !r.quiet));
	/** The one tab stop: the focused beat while drawn, else the playing one, else the first drawn. */
	const tabbable = $derived(tabBeat(focusBeat, visible, playing));
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={grid}
	role="group"
	aria-label={t().songs.page.grid.label}
	class="flex flex-col gap-1"
	onkeydown={keydown}
	onpointerdown={(e) => {
		const at = cell(e);
		if (at !== null) press.down(at, e.clientX, e.clientY);
	}}
	onpointermove={(e) => press.move(e.clientX, e.clientY)}
	onpointerup={() => press.up()}
	onpointercancel={() => press.up()}
	oncontextmenu={(e) => {
		const at = cell(e);
		if (at === null) return;
		e.preventDefault();
		onmenu(at);
	}}
>
	{#if quietRows.length > 0}
		<button
			type="button"
			class="focus-inset flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-chip px-3 text-left text-[13px] font-bold text-muted"
			aria-expanded={quietOpen}
			onclick={() => (quietOpen = !quietOpen)}
		>
			<Icon name="mute" size={16} />
			<span class="flex-1"
				>{t().songs.page.grid.before(clock(0), clock(startS), quietRows.length)}</span
			>
			<Icon name={quietOpen ? 'chevron-up' : 'chevron-down'} size={16} />
		</button>
	{/if}

	{#each rows as row (row.start)}
		{#if !row.quiet || quietOpen}
			{#if firstLoud && row === firstLoud && quietRows.length > 0}
				<div class="flex items-center gap-2 pt-1 pl-1">
					<span class="text-[13px] font-extrabold text-ink-2"
						>{t().songs.page.grid.musicStarts(clock(startS))}</span
					>
					<button
						type="button"
						class="flex size-11 cursor-pointer items-center justify-center text-ink-2"
						aria-label={t().songs.page.grid.moveStart}
						onclick={onstart}><Icon name="edit" size={18} /></button
					>
				</div>
			{/if}
			{#if row.section !== null}
				{@const s = sections[row.section]}
				<div class="flex items-center gap-2 pt-2 pl-1">
					<h3 class="text-[15px] font-extrabold text-ink">{sectionName(s)}</h3>
					<span class="text-[13px] font-semibold text-muted tabular-nums">{clock(s.t)}</span>
					{#if s.countOff}
						<span class="rounded-full bg-chip px-2 py-0.5 text-[12px] font-bold text-chip-ink"
							>{t().songs.page.grid.countOff}</span
						>
					{/if}
					<span class="flex-1"></span>
					<button
						type="button"
						class="flex size-11 cursor-pointer items-center justify-center text-ink-2"
						aria-label={t().songs.page.grid.editSection(sectionName(s))}
						onclick={() => onsection(s.index)}><Icon name="edit" size={18} /></button
					>
				</div>
			{/if}
			<div
				data-row={row.start}
				class="flex items-center gap-1.5 rounded-xl px-1 py-1 {row.quiet
					? 'opacity-45'
					: ''} {rows.indexOf(row) === playingRow ? 'bg-accent-soft' : ''}"
			>
				<span class="w-9 flex-none text-[11px] font-semibold text-muted tabular-nums"
					>{clock(row.t)}</span
				>
				<div class="flex gap-0.5">
					{#each Array.from({ length: row.end - row.start }, (_, k) => row.start + k) as i (i)}
						{@const off = offAt(i)}
						<button
							type="button"
							data-beat={i}
							tabindex={i === tabbable ? 0 : -1}
							aria-label={label(i)}
							class="relative flex h-9 w-[30px] cursor-pointer items-center justify-center rounded-lg text-[15px] tabular-nums select-none {i ===
							playing
								? 'bg-accent text-on-accent'
								: i === lit
									? 'bg-done-soft text-done'
									: 'bg-surface'} {outlinedSet.has(i)
								? 'outline-2 outline-offset-[-2px] outline-accent-text outline-dashed'
								: ''} {off
								? 'bg-[repeating-linear-gradient(135deg,var(--color-chip)_0_4px,transparent_4px_8px)]'
								: counts[i] === 1
									? 'font-extrabold text-accent-text'
									: 'font-semibold text-ink-2'}"
							onclick={() => {
								if (press.swallow()) return;
								focusBeat = i;
								onjump(i);
							}}
						>
							{off ? '' : counts[i]}
							{#if anchorSet.has(i)}
								<span
									aria-hidden="true"
									class="absolute bottom-0.5 size-1 rounded-full bg-accent-text"
								></span>
							{/if}
						</button>
					{/each}
				</div>
				{#if row.short !== null}
					<span
						class="ml-auto rounded-full bg-warn-soft px-2 py-0.5 text-[12px] font-bold text-warn"
						>{t().songs.page.grid.short(row.short)}</span
					>
				{/if}
			</div>
			{#if below}{@render below(row)}{/if}
		{/if}
	{/each}
</div>
