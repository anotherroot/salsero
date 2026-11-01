<script lang="ts">
	import { clock } from '$lib/format';
	import { seekFraction, seekKey, tickPercents } from '$lib/songs/timeline';

	/*
	 * The app's own timeline for a song: a thin track with the played part
	 * filled, optional ticks (the user's 1s), and a white thumb that is the
	 * slider. The whole 44 px band around the track takes the pointer, so a
	 * finger need not hit the 6 px line. The maths is `$lib/songs/timeline`.
	 */
	let {
		value,
		duration,
		ticks = [],
		label,
		onseek
	}: {
		/** The playhead, in seconds. */
		value: number;
		/** The song's length in seconds; 0 while it is not known. */
		duration: number;
		/** Times in seconds to mark on the track. */
		ticks?: number[];
		label: string;
		onseek: (s: number) => void;
	} = $props();

	let area: HTMLDivElement | undefined = $state();
	let dragging = false;

	const pct = $derived(duration > 0 ? Math.min(100, Math.max(0, (value / duration) * 100)) : 0);
	const marks = $derived(tickPercents(ticks, duration));

	function seekTo(e: PointerEvent) {
		if (!area || !(duration > 0)) return;
		const box = area.getBoundingClientRect();
		onseek(seekFraction(e.clientX, box.left, box.width) * duration);
	}

	function down(e: PointerEvent) {
		if (!(duration > 0) || e.button !== 0) return;
		dragging = true;
		area?.setPointerCapture(e.pointerId);
		seekTo(e);
	}

	function key(e: KeyboardEvent) {
		const to = seekKey(e.key, value, duration);
		if (to === null) return;
		e.preventDefault();
		onseek(to);
	}
</script>

<div class="flex flex-col gap-2.5">
	<!-- The 44 px pointer band, pulled in so the layout sees only the 6 px track.
	     Pointer only: the thumb below is the slider a keyboard and a screen reader use. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={area}
		class="relative -my-[19px] h-11 cursor-pointer touch-none select-none"
		onpointerdown={down}
		onpointermove={(e) => dragging && seekTo(e)}
		onpointerup={() => (dragging = false)}
		onpointercancel={() => (dragging = false)}
	>
		<div class="absolute inset-x-0 top-[19px] h-1.5 rounded-full bg-hairline">
			<div class="h-1.5 rounded-full bg-accent" style:width="{pct}%"></div>
			{#each marks as m, i (i)}
				<span
					aria-hidden="true"
					class="absolute -top-[7px] h-5 w-0.5 rounded-[1px] bg-accent-text opacity-55"
					style:left="{m}%"
				></span>
			{/each}
			<div
				role="slider"
				tabindex="0"
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={Math.round(duration)}
				aria-valuenow={Math.round(value)}
				aria-valuetext={clock(value)}
				onkeydown={key}
				class="absolute -top-[7px] size-5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3),0_0_0_0.5px_rgba(0,0,0,0.08)]"
				style:left="calc({pct}% - 10px)"
			></div>
		</div>
	</div>
	<div
		class="pointer-events-none flex justify-between text-[13px] font-semibold text-muted tabular-nums"
	>
		<span>{clock(value)}</span>
		<span>{clock(duration)}</span>
	</div>
</div>
