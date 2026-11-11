<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goBack } from '$lib/nav/trail.svelte';
	import { beatIndexAt } from '$lib/beatgrid/beatgrid';
	import { median } from '$lib/beatgrid/beatgrid';
	import { button } from '$lib/components/ui/styles';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ListenShell from '$lib/components/hearing/ListenShell.svelte';
	import ListenSetup from '$lib/components/hearing/ListenSetup.svelte';
	import ListenResult from '$lib/components/hearing/ListenResult.svelte';
	import TapCheck from '$lib/components/hearing/TapCheck.svelte';
	import TapPad from '$lib/components/hearing/TapPad.svelte';
	import { STAGE_SIGN } from '$lib/components/hearing/styles';
	import { RUN_STOP } from '$lib/components/player/styles';
	import {
		DROPS,
		dropStarts,
		judgeDrop,
		judgeDrops,
		type DropAnswer,
		type DropsResult
	} from '$lib/hearing/drops';
	import { judgeTapAlong, type TapAlongResult } from '$lib/hearing/judge';
	import { revealOf, roundSpan, songParts, type Reveal, type RoundKind } from '$lib/hearing/round';
	import { loadTapDelay, tapSongTime } from '$lib/hearing/tap-delay';
	import { targetPositions, targetsFor, type TargetId } from '$lib/hearing/targets';
	import { targetLabel } from '$lib/hearing/words';
	import { t } from '$lib/i18n/catalog';
	import type { ClavePattern } from '$lib/labels';
	import { loadDelayCorrection } from '$lib/player/sound-delay';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { quietRanges } from '$lib/scheduler/quiet';
	import { placeSections, sectionName } from '$lib/songs/sections';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const w = $derived(t().hearing);

	const grid = $derived({ beats: data.grid.beats, counts: data.grid.counts });
	const placed = $derived(placeSections(data.grid.sections, grid.beats, grid.counts));
	const quiet = $derived(quietRanges(data.grid.sections, grid.beats, grid.counts));
	const parts = $derived(songParts(placed));
	const beatS = $derived(
		grid.beats.length > 1 ? median(grid.beats.slice(1).map((b, i) => b - grid.beats[i])) : 0.5
	);
	const songHref = $derived(resolve(`/${data.dance.slug}/songs/${data.song.id}`));

	// The round's choices.
	let kind = $state<RoundKind>('tapAlong');
	let target = $state<TargetId>('one');
	let clave = $state<ClavePattern>('2-3');
	let part = $state<number | null>(null);
	const positions = $derived(targetPositions(target, target === 'clave' ? clave : null));

	let view = $state<'setup' | 'check' | 'run' | 'result'>('setup');
	/** Null until read in the browser, and while never checked. */
	let tapDelayMs = $state<number | null>(null);
	/** Skipped the check this visit: rounds run with 0 and nothing is stored. */
	let skipped = false;
	/** Where the check goes when it is done: back to the setup, or on into the round. */
	let afterCheck: 'setup' | 'run' = 'setup';

	onMount(() => (tapDelayMs = loadTapDelay()));

	// The round.
	let audio = $state<HTMLAudioElement>();
	let player: PlayerHandle | null = null;
	let raf = 0;
	let now = $state(0);
	let from = 0;
	let to = Infinity;
	let taps: number[] = [];
	let starts = $state<number[]>([]);
	let dropAt = $state(0);
	let answers: DropAnswer[] = [];
	let reveal = $state<Reveal | null>(null);
	let revealUntil = 0;
	let tapResult = $state<TapAlongResult | null>(null);
	let dropsResult = $state<DropsResult | null>(null);
	/** A drop nobody answers moves on after this many seconds. */
	const DROP_WAIT_S = 20;

	const sectionNow = $derived(placed.findLast((s) => s.t <= now) ?? null);
	const countNow = $derived.by(() => {
		const i = beatIndexAt(grid.beats, now);
		return i >= 0 ? grid.counts[i] : null;
	});

	function frame() {
		if (!player) return;
		now = player.songTime();
		if (kind === 'tapAlong') {
			if (now >= to) return finish(to);
		} else if (reveal !== null) {
			if (now >= revealUntil) nextDrop();
		} else if (now - starts[dropAt] > DROP_WAIT_S) {
			// Nobody tapped: say so, and show the count for an eight like any answer.
			const answer = judgeDrop(grid, positions, starts[dropAt], null);
			answers.push(answer);
			reveal = revealOf(answer, positions);
			revealUntil = now + 8 * beatS;
		}
		raf = requestAnimationFrame(frame);
	}

	function nextDrop() {
		reveal = null;
		if (dropAt + 1 >= starts.length) return finish(now);
		dropAt += 1;
		player?.seek(starts[dropAt]);
	}

	/** The Start tap: the check first on a browser never checked, else the round. */
	function begin() {
		if (tapDelayMs === null && !skipped) {
			afterCheck = 'run';
			view = 'check';
			return;
		}
		startRound();
	}

	/** Runs inside a tap: nothing is awaited before `start()` (iOS keeps the audio locked otherwise). */
	function startRound() {
		const el = audio;
		if (!el) return;
		taps = [];
		answers = [];
		reveal = null;
		tapResult = null;
		dropsResult = null;
		if (kind === 'tapAlong') {
			const span = roundSpan(part === null ? null : parts[part], data.grid.startS, beatS);
			from = span.judgeFrom;
			to = span.to;
			el.currentTime = span.play;
		} else {
			starts = dropStarts(grid, quiet, { count: DROPS, from: data.grid.startS, rand: Math.random });
			if (starts.length === 0) return;
			dropAt = 0;
			el.currentTime = starts[0];
		}
		const handle = createPlayer({
			audio: el,
			grid,
			toggles: { count: 'off', clave: null },
			quiet,
			voiceVolume: 0,
			delayCorrectionMs: loadDelayCorrection(),
			onStep: () => {},
			onEnd: () => finish(Infinity)
		});
		player = handle;
		view = 'run';
		handle.start().catch((e) => {
			// A Stop (or Again) while the song was still loading rejects this start: that round is over already.
			if (player !== handle) return;
			console.error(e);
			stopPlayer();
			view = 'setup';
		});
		raf = requestAnimationFrame(frame);
	}

	function tap(timeStamp: number) {
		if (!player || !audio) return;
		const lag = Math.max(0, performance.now() - timeStamp);
		const at = tapSongTime(player.songTime(), lag, tapDelayMs ?? 0, audio.playbackRate);
		if (kind === 'tapAlong') {
			taps.push(at);
			return;
		}
		if (reveal !== null) return;
		const answer = judgeDrop(grid, positions, starts[dropAt], at);
		answers.push(answer);
		reveal = revealOf(answer, positions);
		// The count shows for one eight, then the next drop.
		revealUntil = at + 8 * beatS;
	}

	function stopPlayer() {
		// Also runs on the server (onDestroy), where no frame was ever asked for.
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		player?.stop();
		player = null;
	}

	/** The round is over at song time `end` (Stop, the part's end, the song's end). */
	function finish(end: number) {
		const stoppedAt = player ? player.songTime() : end;
		stopPlayer();
		if (kind === 'tapAlong') {
			tapResult = judgeTapAlong({
				grid,
				positions,
				from,
				to: Math.min(to, end, stoppedAt),
				quiet,
				sections: placed,
				taps
			});
		} else {
			dropsResult = judgeDrops(answers);
		}
		reveal = null;
		view = 'result';
	}

	function leave() {
		stopPlayer();
		// Back through history, as the player does: a new entry would bring Back to this page again.
		void goBack({ href: songHref, label: data.song.title }, { replace: true });
	}

	onDestroy(stopPlayer);

	const score = $derived(tapResult ?? dropsResult);
	const average = $derived.by(() => {
		const ms = score?.meanMs ?? null;
		if (ms === null) return null;
		if (Math.abs(ms) <= 60) return w.result.onTime;
		return ms > 0 ? w.result.late(ms) : w.result.early(-ms);
	});

	function revealText(r: Reveal): string {
		if (r.kind === 'spot') return w.reveal.spot;
		if (r.kind === 'late') return w.reveal.late(r.ms);
		if (r.kind === 'early') return w.reveal.early(r.ms);
		if (r.kind === 'other') return w.reveal.other(r.count);
		if (r.kind === 'none') return w.result.noTap;
		return w.reveal.missed;
	}
</script>

<svelte:head><title>{w.pageTitle(data.dance.label)}</title></svelte:head>

<!-- Mounted from the first render: `createPlayer` needs the element inside the Start tap. -->
<audio bind:this={audio} src="/audio/{data.grid.audioFile}" preload="auto" hidden></audio>

{#if view === 'check'}
	<TapCheck
		subtitle={data.song.title}
		onback={() => (view = 'setup')}
		ondone={(ms) => {
			if (ms === null) skipped = true;
			else tapDelayMs = ms;
			view = 'setup';
			if (afterCheck === 'run') {
				afterCheck = 'setup';
				startRound();
			}
		}}
	/>
{:else if view === 'setup'}
	<ListenShell title={w.card.title} subtitle={data.song.title} backLabel={w.back} onback={leave}>
		{#snippet stage()}
			<span class="text-band-ink"><Icon name="ear" size={56} /></span>
			<p class="max-w-[300px] text-[15px] font-semibold text-band-small">{w.kindSub[kind]}</p>
		{/snippet}
		<ListenSetup
			bind:kind
			bind:target
			bind:clave
			bind:part
			targets={targetsFor(data.dance)}
			parts={parts.map((p) => sectionName(p))}
			{tapDelayMs}
			oncheck={() => {
				afterCheck = 'setup';
				view = 'check';
			}}
		/>
		{#snippet bar()}
			<button type="button" class={button('primary', 'lg', true)} onclick={begin}>
				<Icon name="play" size={22} filled />{w.setup.start}
			</button>
		{/snippet}
	</ListenShell>
{:else if view === 'run'}
	<ListenShell
		title={w.kinds[kind]}
		subtitle="{data.song.title} · {targetLabel(target)}"
		backLabel={w.back}
		onback={leave}
	>
		{#snippet stage()}
			{#if kind === 'tapAlong'}
				<span class="text-band-ink opacity-60"><Icon name="ear" size={72} /></span>
				<p class="text-[15px] font-semibold text-band-small">{w.hidden}</p>
				{#if sectionNow}
					<p class="text-[15px] font-extrabold text-band-ink">{sectionName(sectionNow)}</p>
				{/if}
			{:else}
				<span class="{STAGE_SIGN} {reveal ? '' : 'opacity-40'}"
					>{reveal ? (countNow ?? '–') : '?'}</span
				>
				<p class="text-[15px] font-extrabold text-band-ink">{w.drop(dropAt + 1, starts.length)}</p>
				<p class="min-h-[1.4em] text-[15px] font-semibold text-band-small" aria-live="polite">
					{reveal ? revealText(reveal) : w.listen}
				</p>
			{/if}
		{/snippet}
		<TapPad
			label={kind === 'tapAlong' ? w.tapOn[target] : w.tapNext[target]}
			sub={w.anywhere}
			disabled={kind === 'dropped' && reveal !== null}
			ontap={tap}
		/>
		{#snippet bar()}
			<button type="button" class={RUN_STOP} onclick={() => finish(Infinity)}>
				<Icon name="stop" size={22} filled />{w.stop}
			</button>
		{/snippet}
	</ListenShell>
{:else}
	<ListenShell
		title={w.result.title}
		subtitle="{data.song.title} · {w.kinds[kind]}"
		backLabel={w.back}
		onback={leave}
	>
		{#snippet stage()}
			{#if score && score.of === 0}
				<p
					class="max-w-[300px] font-display text-[24px] leading-tight font-extrabold text-band-ink"
				>
					{w.result.tooShort}
				</p>
			{:else if score}
				<span
					class="font-display text-[56px] leading-none font-extrabold text-band-ink tabular-nums"
					>{w.result.score(score.hit, score.of)}</span
				>
				<p class="text-[17px] font-extrabold text-band-ink">{w.onTarget[target]}</p>
				{#if average}<p class="text-[15px] font-semibold text-band-small">{average}</p>{/if}
				{#if dropsResult?.meanListened != null}
					<p class="text-[15px] font-semibold text-band-small">
						{w.result.listened(dropsResult.meanListened)}
					</p>
				{/if}
			{/if}
		{/snippet}
		{#if score && score.of > 0}
			<ListenResult tap={tapResult} drops={dropsResult} {positions} {beatS} />
		{/if}
		{#snippet bar()}
			<div class="flex gap-2.5">
				<button type="button" class={button('secondary', 'lg')} onclick={begin}>{w.again}</button>
				<div class="flex min-w-0 flex-1">
					<button type="button" class={button('primary', 'lg', true)} onclick={leave}
						>{w.done}</button
					>
				</div>
			</div>
		{/snippet}
	</ListenShell>
{/if}
