<script lang="ts">
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import { clock } from '$lib/format';
	import type { Speed } from '$lib/labels';
	import type { PlayerHandle } from '$lib/scheduler/attach';
	import type { CallableFigure } from '$lib/types';

	interface Props {
		player: PlayerHandle;
		beats: number[];
		counts: number[];
		figures: CallableFigure[];
		/** The figure most recently called, or null before the first call. */
		calledFigureId: number | null;
		song: { id: number; title: string; audioFile: string | null } | null;
		/** The song's `<audio>` element, rendered by the page so it exists before Play is pressed. */
		audio: HTMLAudioElement | undefined;
		speed: Speed;
		/** Where the voice slider starts, carried over from the setup screen. */
		initialVoiceVolume: number;
		onstop: () => void;
	}

	let {
		player,
		beats,
		counts,
		figures,
		calledFigureId,
		song,
		audio,
		speed,
		initialVoiceVolume,
		onstop
	}: Props = $props();

	let paused = $state(false);
	let voiceVolume = $state(initialVoiceVolume);
	/** Polled rather than read once: nothing else in this component re-renders on its own each tick. */
	let elapsed = $state(0);

	$effect(() => {
		const t = setInterval(() => (elapsed = player.songTime()), 250);
		return () => clearInterval(t);
	});

	// Pitch-corrected playback at slower speeds — a 0.7× salsa without this sounds drunk.
	$effect(() => {
		if (!audio) return;
		audio.playbackRate = speed;
		audio.preservesPitch = true;
	});

	const calledName = $derived(
		calledFigureId !== null ? (figures.find((f) => f.id === calledFigureId)?.name ?? null) : null
	);

	function togglePause() {
		if (paused) {
			void player.resume();
			paused = false;
		} else {
			// Never stop()/start() here: that re-fetches the clips and throws away
			// the figures already planned. pause()/resume() hold the run in place.
			player.pause();
			paused = true;
		}
	}
</script>

<div class="space-y-6">
	{#if song}
		<p class="truncate text-center text-[13px] text-muted">{song.title}</p>
	{/if}

	<LiveCount time={() => player.songTime()} {beats} {counts} />

	<div class="text-center">
		<p class="min-h-[1.4em] text-[22px] font-semibold text-ink">{calledName ?? ''}</p>
		<p class="mt-1 text-[13px] text-muted tabular-nums">{clock(elapsed)}</p>
	</div>

	<!--
		Adjustable DURING the run on purpose: whether the voice sits right against
		the music is only knowable once the music is playing, and having to stop
		the run to change it would end the run.
	-->
	<label class="block">
		<span class="mb-1 block text-[12px] font-medium text-ink-2">Voice volume</span>
		<input
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={voiceVolume}
			oninput={(e) => {
				voiceVolume = Number(e.currentTarget.value);
				player.setVoiceVolume(voiceVolume);
			}}
			class="h-11 w-full"
		/>
	</label>

	<div class="flex gap-3">
		<button
			type="button"
			class="h-14 flex-1 rounded-2xl border border-rule bg-raised text-[16px] font-semibold text-ink"
			onclick={togglePause}
		>
			{paused ? 'Resume' : 'Pause'}
		</button>
		<button
			type="button"
			class="h-14 flex-1 rounded-2xl border border-danger text-[16px] font-semibold text-danger"
			onclick={onstop}
		>
			Stop
		</button>
	</div>
</div>
