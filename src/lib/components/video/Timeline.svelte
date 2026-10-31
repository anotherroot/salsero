<!-- src/lib/components/video/Timeline.svelte -->
<script lang="ts">
	import { preciseTime } from '$lib/video/spots';

	interface Band {
		id: number;
		startMs: number;
		endMs: number | null;
		active: boolean;
	}

	interface Props {
		/** The stretch the track covers: the whole video, or one section. */
		fromMs: number;
		toMs: number;
		currentMs: number;
		/** Sections as bands, points as ticks — the whole video's track only. */
		bands?: Band[];
		/** A section being marked: from its start to the playhead. */
		pending?: { startMs: number } | null;
		/** The fill up to the playhead in the accent (a section's track). */
		accentFill?: boolean;
		/** On the picture (landscape): a lighter track. */
		glass?: boolean;
		onseek: (ms: number) => void;
	}

	let {
		fromMs,
		toMs,
		currentMs,
		bands = [],
		pending = null,
		accentFill = false,
		glass = false,
		onseek
	}: Props = $props();

	const span = $derived(Math.max(1, toMs - fromMs));
	const pct = (ms: number) => Math.max(0, Math.min(100, ((ms - fromMs) / span) * 100));

	let dragging = false;
	function seekAt(e: PointerEvent) {
		const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
		onseek(Math.round(fromMs + f * span));
	}
</script>

<!-- The arrow keys are the player's (±1 s), so the slider takes no focus of its own. -->
<div
	role="slider"
	tabindex="-1"
	aria-label="Position"
	aria-valuemin={fromMs}
	aria-valuemax={toMs}
	aria-valuenow={currentMs}
	aria-valuetext={preciseTime(currentMs)}
	class="relative h-11 cursor-pointer touch-none"
	onpointerdown={(e) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		dragging = true;
		seekAt(e);
	}}
	onpointermove={(e) => {
		if (dragging) seekAt(e);
	}}
	onpointerup={() => (dragging = false)}
	onpointercancel={() => (dragging = false)}
>
	<span
		class="absolute inset-x-0 top-[19px] h-1.5 rounded-full {glass ? 'bg-white/30' : 'bg-white/24'}"
	></span>
	<span
		class="absolute top-[19px] left-0 h-1.5 rounded-full {accentFill ? 'bg-accent' : 'bg-white/62'}"
		style:width="{pct(currentMs)}%"
	></span>
	{#each bands as b (b.id)}
		{#if b.endMs === null}
			<span
				class="absolute top-2.5 h-6 w-[3px] -translate-x-1/2 rounded-sm bg-white/90"
				style:left="{pct(b.startMs)}%"
			></span>
		{:else}
			<span
				class="absolute top-[15px] h-3.5 min-w-[5px] rounded {b.active
					? 'bg-accent'
					: 'bg-white/34'}"
				style:left="{pct(b.startMs)}%"
				style:width="{pct(b.endMs) - pct(b.startMs)}%"
			></span>
		{/if}
	{/each}
	{#if pending}
		{@const a = Math.min(pending.startMs, currentMs)}
		<span
			class="absolute top-[15px] h-3.5 rounded bg-accent opacity-60"
			style:left="{pct(a)}%"
			style:width="{pct(Math.max(pending.startMs, currentMs)) - pct(a)}%"
		></span>
	{/if}
	<span
		class="absolute top-[7px] h-[30px] w-1 -translate-x-1/2 rounded-sm bg-white shadow-[0_0_0_2px_black]"
		style:left="{pct(currentMs)}%"
	></span>
</div>
