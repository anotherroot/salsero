<!-- src/lib/components/video/TrimStrip.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { spotTime } from '$lib/video/spots';
	import { fitWindow, GRAB_PX, handleAt, msAtX, pctOf, trimWindow } from '$lib/video/trim';
	import type { Spot } from '$lib/types';
	import Icon from './Icon.svelte';
	import { icons } from './icons';

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

<div class="flex flex-col gap-1">
	<div
		role="group"
		aria-label="Section edges: drag a handle, tap to seek"
		class="relative h-17 shrink-0 cursor-pointer touch-none overflow-hidden rounded-xl bg-(--pl-surface)"
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
				class="absolute bottom-0 w-px bg-(--pl-tick)"
				style:left="{pctOf(t.ms, win)}%"
				style:height={t.major ? '18px' : '9px'}
			></span>
		{/each}
		{#if isSection}
			<span
				class="absolute inset-y-0 border-y-[3px] border-(--pl-accent) bg-(--pl-accent)/15"
				style:left="{startPct}%"
				style:width="{endPct - startPct}%"
			></span>
			<span
				class="absolute inset-y-0 grid w-[22px] -translate-x-full place-items-center rounded-l-[10px]"
				style:left="{startPct}%"
				style:background={selected === 'start' ? 'var(--pl-accent)' : 'var(--pl-handle)'}
			>
				<span class="h-[22px] w-0.5 rounded-full bg-black/45"></span>
			</span>
			<span
				class="absolute inset-y-0 grid w-[22px] place-items-center rounded-r-[10px]"
				style:left="{endPct}%"
				style:background={selected === 'end' ? 'var(--pl-accent)' : 'var(--pl-handle)'}
			>
				<span class="h-[22px] w-0.5 rounded-full bg-black/45"></span>
			</span>
		{:else}
			<span
				class="absolute inset-y-0 grid w-[22px] -translate-x-1/2 place-items-center rounded-[10px] bg-(--pl-accent) text-(--pl-accent-ink)"
				style:left="{startPct}%"
			>
				<Icon d={icons.flag} size={14} />
			</span>
		{/if}
		<span
			class="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white"
			style:left="{pctOf(currentMs, win)}%"
		></span>
	</div>
	<div class="flex justify-between text-[11px] text-(--pl-muted) tabular-nums">
		<span>{spotTime(win.fromMs)}</span>
		<span>drag a handle · tap to seek</span>
		<span>{spotTime(win.toMs)}</span>
	</div>
</div>
