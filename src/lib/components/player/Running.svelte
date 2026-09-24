<script lang="ts">
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import { clock } from '$lib/format';
	import { COUNT_PATTERN_LABEL, type CountPattern, type Speed } from '$lib/labels';
	import type { Dance } from '$lib/dances/dances';
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
		/** The count pattern in force. Owned by the page, so the logged set matches. */
		count: CountPattern;
		/** Which patterns this run's picker may offer — see the comment below. */
		dance: Dance;
		oncount: (pattern: CountPattern) => void;
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
		count,
		dance,
		oncount,
		onstop
	}: Props = $props();

	const chip =
		'flex h-11 min-w-[4.5rem] cursor-pointer items-center justify-center rounded-lg border px-2 text-[13px] has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink border-rule bg-raised text-ink-2 has-focus-visible:outline-2 has-focus-visible:outline-accent';

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
		Both of these are adjustable DURING the run on purpose. Whether the voice
		sits right against the music is only knowable once the music is playing,
		and a song that turns out too fast to count every beat wants the pattern
		thinned THEN — stopping to change it would end the run and lose the plan.

		Iterates `dance.countPatterns`, not the global `COUNT_PATTERNS`, for the
		same reason Setup.svelte's picker does: bachata has no 'son' count, and
		this picker existing separately from Setup's (so the pattern can change
		mid-run) means the registry has to be threaded through here too, not just
		read once at setup time.
	-->
	<fieldset>
		<legend class="mb-1 block text-[12px] font-medium text-ink-2">Voice count</legend>
		<div class="flex flex-wrap gap-2">
			{#each dance.countPatterns as p (p)}
				<label class={chip}>
					<input
						type="radio"
						name="runCount"
						checked={count === p}
						onchange={() => oncount(p)}
						class="sr-only"
					/>
					{COUNT_PATTERN_LABEL[p]}
				</label>
			{/each}
		</div>
	</fieldset>

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
