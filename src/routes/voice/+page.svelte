<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		COUNT_PATTERN_LABEL,
		PHRASE_PATTERNS,
		TEMPO_LADDER,
		type PhrasePattern
	} from '$lib/labels';
	import { phraseCounts } from '$lib/scheduler/scheduler';
	import { cutTake, recordAgainstClick, type Capture, type Take } from '$lib/voice/capture';
	import { phraseCandidates, type PhraseSlice } from '$lib/voice/slice';
	import { encodeWav } from '$lib/voice/wav';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Bars counted per session. Four candidates beats re-recording until one is clean. */
	const BARS = 4;
	/** Kept before the first beat, so a leading consonant is not cut off. */
	const PRE_ROLL_S = 0.1;

	type Stage = 'grid' | 'arming' | 'recording' | 'choosing';
	let stage = $state<Stage>('grid');
	let pattern = $state<PhrasePattern>('salsa');
	let bpm = $state<number>(TEMPO_LADDER[0]);
	let error = $state<string | null>(null);
	let saving = $state(false);
	let where = $state('');

	let capture: Capture | null = null;
	let slices = $state<{ a: PhraseSlice[]; b: PhraseSlice[] }>({ a: [], b: [] });
	let chosen = $state<{ a: number | null; b: number | null }>({ a: null, b: null });

	const have = (p: string, t: number, half: 'a' | 'b') =>
		data.takes.some((k) => k.pattern === p && k.bpm === t && k.phrase === half);

	/** One context for every audition: iOS caps how many may exist at once. */
	let preview: AudioContext | null = null;
	function play(take: Take) {
		preview ??= new AudioContext();
		const buffer = preview.createBuffer(1, take.frames.length, take.sampleRate);
		// `.set` rather than `copyToChannel`: frames sliced out of the worklet's
		// blocks are typed over ArrayBufferLike, which copyToChannel's signature
		// rejects. Same copy either way.
		buffer.getChannelData(0).set(take.frames);
		const src = preview.createBufferSource();
		src.buffer = buffer;
		src.connect(preview.destination);
		src.start();
	}

	function listen(half: 'a' | 'b') {
		const i = chosen[half];
		if (i === null || !capture) return;
		play(cutTake(capture, slices[half][i]));
	}

	function sliceSpec(half: 'a' | 'b', c: Capture) {
		const counts = phraseCounts(pattern, half);
		return {
			beatSamples: c.beatSamples,
			offsetBeats: counts[0] - 1,
			spanBeats: counts[counts.length - 1] - counts[0] + 1,
			preRollSamples: Math.round(PRE_ROLL_S * c.sampleRate),
			// A beat of ring-out. Salsa and son have a silent beat here; every-count
			// does not, and its tail simply overlaps the next phrase, which is free.
			tailSamples: Math.round(c.beatSamples),
			totalSamples: c.frames.length
		};
	}

	async function record() {
		error = null;
		stage = 'recording';
		where = 'Get ready…';
		try {
			const c = await recordAgainstClick({
				bpm,
				bars: BARS,
				onBeat: (bar, count) => {
					where = bar < 0 ? `Count in… ${count}` : `Bar ${bar + 1} of ${BARS} · ${count}`;
				}
			});
			capture = c;
			slices = {
				a: phraseCandidates(sliceSpec('a', c), c.firstBarStart, BARS),
				b: phraseCandidates(sliceSpec('b', c), c.firstBarStart, BARS)
			};
			chosen = { a: slices.a.length ? 0 : null, b: slices.b.length ? 0 : null };
			stage = slices.a.length || slices.b.length ? 'choosing' : 'grid';
			if (stage === 'grid') error = 'Nothing usable was captured. Check the microphone permission.';
		} catch (e) {
			stage = 'grid';
			error =
				e instanceof Error && e.name === 'NotAllowedError'
					? 'The microphone was refused. Allow it and try again.'
					: e instanceof Error
						? e.message
						: 'Recording failed.';
		}
	}

	async function upload(half: 'a' | 'b', take: Take) {
		const res = await fetch('/api/count-takes', {
			method: 'POST',
			headers: {
				'content-type': 'audio/wav',
				'x-pattern': pattern,
				'x-bpm': String(bpm),
				'x-phrase': half,
				'x-sample-rate': String(take.sampleRate),
				'x-pre-roll': String(take.preRollS),
				'x-length': String(take.lengthS),
				'x-duration': String(take.durationS)
			},
			body: encodeWav(take.frames, take.sampleRate) as BodyInit
		});
		if (!res.ok) throw new Error(await res.text());
	}

	async function keep() {
		if (!capture) return;
		saving = true;
		error = null;
		try {
			for (const half of ['a', 'b'] as const) {
				const i = chosen[half];
				if (i === null) continue;
				await upload(half, cutTake(capture, slices[half][i]));
			}
			capture = null;
			stage = 'grid';
			// The grid is server state; re-fetch rather than guessing what landed.
			location.reload();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save the takes.';
		} finally {
			saving = false;
		}
	}

	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
	const chip =
		'flex h-11 min-w-[5rem] cursor-pointer items-center justify-center rounded-lg border px-3 text-[13px] has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink border-rule bg-raised text-ink-2';
	const btn = 'h-14 w-full rounded-2xl text-[16px] font-semibold';
</script>

<svelte:head><title>My count · Salsa</title></svelte:head>

<div class="space-y-6">
	<header>
		<h1 class="text-[20px] font-semibold text-ink">My count</h1>
		<p class="mt-1 text-[13px] text-muted">
			Record yourself counting, and the player uses your voice instead of the built-in one. A tempo
			with nothing recorded falls back to the built-in count, so there is no wrong order to do this
			in.
		</p>
	</header>

	{#if error}
		<p class="rounded-lg border border-danger px-3 py-2 text-[13px] text-danger">{error}</p>
	{/if}
	{#if form?.message}
		<p class="rounded-lg border border-danger px-3 py-2 text-[13px] text-danger">{form.message}</p>
	{/if}

	{#if stage === 'grid'}
		{#each PHRASE_PATTERNS as p (p)}
			<section>
				<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">
					{COUNT_PATTERN_LABEL[p]}
				</h2>
				<ul class="space-y-2">
					{#each TEMPO_LADDER as t (t)}
						<li class="flex items-center gap-3 rounded-xl border border-rule bg-raised px-3 py-2">
							<span class="w-16 text-[15px] tabular-nums">{t} BPM</span>
							<span class="flex-1 text-[13px] text-muted">
								{#if have(p, t, 'a') && have(p, t, 'b')}
									Recorded
								{:else if have(p, t, 'a') || have(p, t, 'b')}
									Half recorded
								{:else}
									—
								{/if}
							</span>
							<button
								type="button"
								class="h-9 rounded-lg border border-rule px-3 text-[13px] text-ink"
								onclick={() => {
									pattern = p;
									bpm = t;
									stage = 'arming';
								}}
							>
								{have(p, t, 'a') || have(p, t, 'b') ? 'Redo' : 'Record'}
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/each}

		{#if data.takes.length}
			<section>
				<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">
					Everything recorded
				</h2>
				<ul class="space-y-1">
					{#each data.takes as k (k.id)}
						<li class="flex items-center gap-3 text-[13px]">
							<span class="flex-1 text-ink-2">
								{COUNT_PATTERN_LABEL[k.pattern]} · {k.bpm} BPM · phrase {k.phrase}
							</span>
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="id" value={k.id} />
								<button class="text-danger">Delete</button>
							</form>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{:else if stage === 'arming'}
		<section class="space-y-4">
			<p class="text-[15px] text-ink">
				{COUNT_PATTERN_LABEL[pattern]} at {bpm} BPM
			</p>
			<!--
				Not a suggestion. Through a speaker the click lands in the recording,
				and the browser's echo cancellation then ducks the voice to cancel it.
			-->
			<p class="rounded-lg border border-rule bg-raised px-3 py-2 text-[13px] text-ink-2">
				<strong class="text-ink">Put headphones on first.</strong> Otherwise the click gets recorded along
				with your voice.
			</p>
			<p class="text-[13px] text-muted">
				You get one bar of clicks to find the tempo, then count
				<strong class="text-ink">{COUNT_PATTERN_LABEL[pattern]}</strong> out loud for {BARS} bars. Count
				evenly and leave the silent beats silent.
			</p>
			<button type="button" class="{btn} bg-accent text-accent-ink" onclick={record}>Start</button>
			<button
				type="button"
				class="{btn} border border-rule text-ink"
				onclick={() => (stage = 'grid')}>Back</button
			>
		</section>
	{:else if stage === 'recording'}
		<section class="space-y-4 py-10 text-center">
			<p class="text-[32px] font-semibold text-ink tabular-nums">{where}</p>
			<p class="text-[13px] text-muted">Counting {COUNT_PATTERN_LABEL[pattern]} at {bpm} BPM</p>
		</section>
	{:else}
		<section class="space-y-6">
			<p class="text-[13px] text-muted">
				Pick the best bar for each half. Listen before you keep it — a rushed or muttered one is
				worse than the built-in voice.
			</p>
			{#each ['a', 'b'] as const as half (half)}
				<div>
					<span class={label}>
						Counts {phraseCounts(pattern, half).join(' ')}
					</span>
					{#if slices[half].length === 0}
						<p class="text-[13px] text-muted">Nothing usable in this half.</p>
					{:else}
						<div class="flex flex-wrap gap-2">
							{#each [...slices[half].keys()] as i (i)}
								<label class={chip}>
									<input
										type="radio"
										name="pick-{half}"
										checked={chosen[half] === i}
										onchange={() => (chosen = { ...chosen, [half]: i })}
										class="sr-only"
									/>
									Bar {i + 1}
								</label>
							{/each}
						</div>
						<button
							type="button"
							class="mt-2 h-9 rounded-lg border border-rule px-3 text-[13px] text-ink"
							onclick={() => listen(half)}
						>
							Listen
						</button>
					{/if}
				</div>
			{/each}

			<button
				type="button"
				class="{btn} bg-accent text-accent-ink"
				disabled={saving || (chosen.a === null && chosen.b === null)}
				onclick={keep}
			>
				{saving ? 'Saving…' : 'Keep these'}
			</button>
			<button type="button" class="{btn} border border-rule text-ink" onclick={record}>
				Record again
			</button>
			<button
				type="button"
				class="{btn} border border-rule text-ink"
				onclick={() => {
					capture = null;
					stage = 'grid';
				}}>Back</button
			>
		</section>
	{/if}
</div>
