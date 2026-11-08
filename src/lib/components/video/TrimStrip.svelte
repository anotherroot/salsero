<!-- src/lib/components/video/TrimStrip.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '$lib/i18n/catalog';
	import { spotTime } from '$lib/video/spots';
	import { fitWindow, GRAB_PX, handleAt, msAtX, pctOf, trimWindow } from '$lib/video/trim';
	import type { Spot } from '$lib/types';
	import Icon from '$lib/components/ui/Icon.svelte';

	/**
	 * A zoomed timeline of one spot: drag a handle to move that edge, tap
	 * anywhere else to seek. The window holds still while a handle is dragged,
	 * so it never slides out from under the finger, and widens on release if an
	 * edge came near its side.
	 */
	interface Props {
		spot: Spot;
		selected: 'start' | 'end';
		currentMs: number;
		durationS: number;
		ondragstart: (edge: 'start' | 'end') => void;
		ondrag: (edge: 'start' | 'end', ms: number) => void;
		ondragend: (edge: 'start' | 'end') => void;
		onseek: (ms: number) => void;
	}

	let { spot, selected, currentMs, durationS, ondragstart, ondrag, ondragend, onseek }: Props =
		$props();

	let dragging = $state<'start' | 'end' | null>(null);
	let win = $state(untrack(() => trimWindow(spot, durationS)));
	let shownId = untrack(() => spot.id);

	$effect(() => {
		const s = spot;
		const d = durationS;
		if (dragging) return;
		untrack(() => {
			if (s.id !== shownId) {
				shownId = s.id;
				win = trimWindow(s, d);
				return;
			}
			const next = fitWindow(win, s, d);
			if (next !== win) win = next;
		});
	});

	const ticks = $derived.by(() => {
		const out: { ms: number; major: boolean }[] = [];
		for (let ms = Math.ceil(win.fromMs / 1000) * 1000; ms <= win.toMs; ms += 1000) {
			out.push({ ms, major: ms % 5000 === 0 });
		}
		return out;
	});
	const isSection = $derived(spot.endMs !== null);
	const startPct = $derived(pctOf(spot.startMs, win));
	const endPct = $derived(pctOf(spot.endMs ?? spot.startMs, win));

	function where(e: PointerEvent) {
		const el = e.currentTarget as HTMLElement;
		const r = el.getBoundingClientRect();
		// The canvas or a zoomed page can scale the strip; the grab area scales with it.
		return { x: e.clientX - r.left, width: r.width, scale: r.width / (el.offsetWidth || r.width) };
	}
</script>

<div class="flex flex-none flex-col gap-1">
	<div
		role="group"
		aria-label={t().video.editor.edges}
		class="relative h-16 shrink-0 cursor-pointer touch-none overflow-hidden rounded-xl bg-surface"
		onpointerdown={(e) => {
			const p = where(e);
			const edge = handleAt(p.x, p.width, win, spot, GRAB_PX * p.scale);
			if (edge) {
				e.currentTarget.setPointerCapture(e.pointerId);
				dragging = edge;
				ondragstart(edge);
			} else {
				onseek(msAtX(p.x, p.width, win));
			}
		}}
		onpointermove={(e) => {
			if (!dragging) return;
			const p = where(e);
			ondrag(dragging, msAtX(p.x, p.width, win));
		}}
		onpointerup={() => {
			const edge = dragging;
			dragging = null;
			if (edge) ondragend(edge);
		}}
		onpointercancel={() => {
			const edge = dragging;
			dragging = null;
			if (edge) ondragend(edge);
		}}
	>
		{#each ticks as t (t.ms)}
			<span
				class="absolute bottom-0 w-px {t.major ? 'h-[18px] bg-white/45' : 'h-[9px] bg-white/25'}"
				style:left="{pctOf(t.ms, win)}%"
			></span>
		{/each}
		{#if isSection}
			<span
				class="absolute inset-y-0 border-y-[3px] border-accent bg-accent/16"
				style:left="{startPct}%"
				style:width="{endPct - startPct}%"
			></span>
			<!--
				The handles are drawn, not controls: the edges move with the editor's
				buttons and I / O, and its Start / End rows read their times out.
			-->
			<span
				aria-hidden="true"
				class="absolute inset-y-0 grid w-[22px] -translate-x-full place-items-center rounded-l-[10px] {selected ===
				'start'
					? 'bg-accent'
					: 'bg-ink-2'}"
				style:left="{startPct}%"
			>
				<span class="h-[22px] w-0.5 rounded-full bg-black/45"></span>
			</span>
			<span
				aria-hidden="true"
				class="absolute inset-y-0 grid w-[22px] place-items-center rounded-r-[10px] {selected ===
				'end'
					? 'bg-accent'
					: 'bg-ink-2'}"
				style:left="{endPct}%"
			>
				<span class="h-[22px] w-0.5 rounded-full bg-black/45"></span>
			</span>
		{:else}
			<span
				class="absolute inset-y-0 grid w-6 -translate-x-1/2 place-items-center rounded-[10px] bg-accent text-on-accent"
				style:left="{startPct}%"
			>
				<Icon name="flag" size={15} />
			</span>
		{/if}
		<span
			class="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white"
			style:left="{pctOf(currentMs, win)}%"
		></span>
	</div>
	<div class="flex justify-between text-[11.5px] font-semibold text-muted tabular-nums">
		<span>{spotTime(win.fromMs)}</span>
		<span>{t().video.editor.edgesHint}</span>
		<span>{spotTime(win.toMs)}</span>
	</div>
</div>
