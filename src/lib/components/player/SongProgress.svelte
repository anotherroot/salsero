<!-- src/lib/components/player/SongProgress.svelte -->
<script lang="ts">
	import { seekTime } from '$lib/gestures/seek';
	import { clock } from '$lib/format';

	interface Props {
		/** The song's element; undefined until it mounts. Read, never written. */
		audio: HTMLAudioElement | undefined;
		/**
		 * Move to a song time. The owner decides how: a running player has to
		 * drop what it queued, a stopped one just moves the element.
		 */
		onseek: (songTime: number) => void;
	}

	let { audio, onseek }: Props = $props();

	let current = $state(0);
	let duration = $state(NaN);
	/** Where a drag would land, shown instead of `current` until it is let go. */
	let dragging = $state<number | null>(null);
	let bar: HTMLDivElement | undefined = $state();
	/** The track inside the bar, inset by the thumb's radius so the thumb never meets a label. */
	let track: HTMLDivElement | undefined = $state();

	// `timeupdate` is about four a second — plenty for a bar, unlike the count.
	$effect(() => {
		const el = audio;
		if (!el) return;
		const sync = () => {
			current = el.currentTime;
			duration = el.duration;
		};
		sync();
		const events = ['timeupdate', 'seeked', 'durationchange', 'loadedmetadata', 'emptied'];
		for (const e of events) el.addEventListener(e, sync);
		return () => {
			for (const e of events) el.removeEventListener(e, sync);
		};
	});

	const known = $derived(Number.isFinite(duration) && duration > 0);
	const shown = $derived(dragging ?? current);
	const pct = $derived(known ? Math.min(100, (shown / duration) * 100) : 0);

	function at(e: PointerEvent): number {
		const r = track!.getBoundingClientRect();
		return seekTime(e.clientX, r.left, r.width, duration);
	}

	function down(e: PointerEvent) {
		if (!known || e.button !== 0) return;
		bar!.setPointerCapture(e.pointerId);
		dragging = at(e);
	}

	function move(e: PointerEvent) {
		if (dragging !== null) dragging = at(e);
	}

	/** Seek once, on release: a seek per pointer move would clear the count's queue each time. */
	function up(e: PointerEvent) {
		if (dragging === null) return;
		const t = at(e);
		dragging = null;
		current = t;
		onseek(t);
	}

	function key(e: KeyboardEvent) {
		if (!known) return;
		const to =
			e.key === 'ArrowRight'
				? current + 5
				: e.key === 'ArrowLeft'
					? current - 5
					: e.key === 'Home'
						? 0
						: e.key === 'End'
							? duration
							: null;
		if (to === null) return;
		e.preventDefault();
		const t = Math.min(duration, Math.max(0, to));
		current = t;
		onseek(t);
	}
</script>

<div class="flex items-center gap-2 text-[12px] text-muted tabular-nums">
	<span class="w-10 text-right">{clock(shown)}</span>
	<div
		bind:this={bar}
		role="slider"
		tabindex="0"
		aria-label="Song position"
		aria-valuemin={0}
		aria-valuemax={known ? Math.round(duration) : 0}
		aria-valuenow={Math.round(shown)}
		aria-valuetext={clock(shown)}
		class="relative h-11 flex-1 cursor-pointer touch-none outline-none select-none focus-visible:outline-2 focus-visible:outline-accent"
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={() => (dragging = null)}
		onkeydown={key}
	>
		<div bind:this={track} class="absolute inset-x-2 inset-y-0">
			<div class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-rule">
				<div class="h-full rounded-full bg-accent" style:width="{pct}%"></div>
			</div>
			<div
				class="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow"
				style:left="{pct}%"
			></div>
		</div>
	</div>
	<span class="w-10">{known ? clock(duration) : '–'}</span>
</div>
