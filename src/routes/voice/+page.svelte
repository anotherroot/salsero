<script lang="ts">
	import { page } from '$app/state';
	import { act } from '$lib/components/routines/act';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { GROUP, ROW, SECTION_LABEL, button, iconButton } from '$lib/components/ui/styles';
	import { recordedLabel, takeRows, tempoMeta, tempoState } from '$lib/voice/grid';
	import { voiceBack } from '$lib/voice/back';
	import { invalidateAll } from '$app/navigation';
	import { track } from '$lib/unsaved/guard.svelte';
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
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	/** Bars counted per session. Four candidates beats re-recording until one is clean. */
	const BARS = 4;
	/** Kept before the first beat, so a leading consonant is not cut off. */
	const PRE_ROLL_S = 0.1;

	type Stage = 'grid' | 'arming' | 'recording' | 'choosing';
	let stage = $state<Stage>('grid');
	// `?pattern=` is where Practice was counting; anything else is salsa.
	const asked = page.url.searchParams.get('pattern');
	let pattern = $state<PhrasePattern>(PHRASE_PATTERNS.find((p) => p === asked) ?? 'salsa');
	let bpm = $state<number>(TEMPO_LADDER[0]);
	let error = $state<string | null>(null);
	let saving = $state(false);
	let where = $state('');

	let capture: Capture | null = null;
	let slices = $state<{ a: PhraseSlice[]; b: PhraseSlice[] }>({ a: [], b: [] });
	let chosen = $state<{ a: number | null; b: number | null }>({ a: null, b: null });

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

	/**
	 * Which recording run owns the screen. Redo bumps it before aborting, so the
	 * run it replaced finishes its cleanup and then bows out instead of
	 * presenting a chooser over the top of the new one.
	 */
	let gen = 0;
	let controller: AbortController | null = null;
	let running: Promise<void> | null = null;
	/** True once a run has been stopped, so an empty result is not called a failure. */
	let stopped = false;

	async function record() {
		const mine = ++gen;
		controller = new AbortController();
		// Held locally: a later run reassigns `controller`, and this one must keep
		// listening to the signal it was started with.
		const signal = controller.signal;
		stopped = false;
		error = null;
		stage = 'recording';
		where = 'Get ready…';

		running = (async () => {
			try {
				const c = await recordAgainstClick({
					bpm,
					bars: BARS,
					signal,
					onBeat: (bar, count) => {
						if (mine !== gen) return;
						where = bar < 0 ? `Count in… ${count}` : `Bar ${bar + 1} of ${BARS} · ${count}`;
					}
				});
				// Superseded by a redo while this one was finishing: its microphone
				// and context are already released, and the screen belongs to the
				// newer run now.
				if (mine !== gen) return;

				capture = c;
				slices = {
					a: phraseCandidates(sliceSpec('a', c), c.firstBarStart, BARS),
					b: phraseCandidates(sliceSpec('b', c), c.firstBarStart, BARS)
				};
				chosen = { a: slices.a.length ? 0 : null, b: slices.b.length ? 0 : null };
				if (slices.a.length || slices.b.length) {
					stage = 'choosing';
				} else if (stopped) {
					// Stopped before a whole bar existed. That is a decision, not a
					// fault, so it gets no error message.
					stage = 'arming';
				} else {
					stage = 'grid';
					error = 'Nothing usable was captured. Check the microphone permission.';
				}
			} catch (e) {
				if (mine !== gen) return;
				stage = 'grid';
				error =
					e instanceof Error && e.name === 'NotAllowedError'
						? 'The microphone was refused. Allow it and try again.'
						: e instanceof Error
							? e.message
							: 'Recording failed.';
			}
		})();
		await running;
	}

	/** End the click now and offer whatever whole bars were counted. */
	function stopRecording() {
		stopped = true;
		controller?.abort();
	}

	/**
	 * Start the same cell over. The in-flight run is invalidated FIRST and then
	 * waited on, because `recordAgainstClick` releases the microphone and closes
	 * its context on the way out — calling `getUserMedia` again before that has
	 * finished is what wedges the mic on iOS.
	 */
	async function redo() {
		gen++;
		controller?.abort();
		await running?.catch(() => {});
		void record();
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

	/** Upload the chosen bars. True when they all landed. */
	async function keep(): Promise<boolean> {
		if (!capture) return false;
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
			await invalidateAll();
			return true;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Could not save the takes.';
			return false;
		} finally {
			saving = false;
		}
	}

	// A take being chosen lives only in memory: leaving loses it, so ask.
	// "Back" is the one way out that does not, because it says so.
	$effect(() =>
		track({
			label: 'Your recorded count',
			dirty: () => stage === 'choosing' && capture !== null,
			blocked: () => (chosen.a === null && chosen.b === null ? 'Pick a bar to keep first.' : null),
			save: async () =>
				(await keep()) ? { ok: true } : { ok: false, message: error ?? 'Could not save the takes.' }
		})
	);

	// Back goes where My count was opened from: Practice, else Settings.
	const backTo = $derived(voiceBack(page.url.searchParams.get('from')));
	const rows = $derived(takeRows(data.takes, pattern));

	let toast = $state<{ id: number; message: string; action?: string; undo?: () => void } | null>(
		null
	);
	let seq = 0;

	function refused(result: Awaited<ReturnType<typeof act>>) {
		if (result.type !== 'failure') return false;
		const message = (result.data as { message?: string } | undefined)?.message;
		toast = { id: ++seq, message: message ?? 'Could not do that.' };
		return true;
	}

	/** Delete now; the toast's Undo brings the take back for a minute. */
	async function remove(id: number, deleted: string) {
		if (refused(await act('delete', { id }))) return;
		toast = {
			id: ++seq,
			message: deleted,
			action: 'Undo',
			undo: async () => {
				const r = await act('restore', { id });
				toast = null;
				refused(r);
			}
		};
	}

	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
	const chip =
		'flex h-11 min-w-[5rem] cursor-pointer items-center justify-center rounded-lg border px-3 text-[13px] has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink border-rule bg-raised text-ink-2';
	const btn = 'h-14 w-full rounded-2xl text-[16px] font-semibold';
	/** The same button sharing a row, rather than each claiming the full width. */
	const btnHalf = 'h-14 flex-1 rounded-2xl text-[16px] font-semibold';
</script>

<svelte:head><title>My count · Salsa</title></svelte:head>

{#snippet back()}
	<BandButton icon="back" label={backTo.label} href={backTo.href} />
{/snippet}
{#snippet patterns()}
	<Segmented
		onBand
		name="pattern"
		label="Count pattern"
		items={PHRASE_PATTERNS.map((p) => ({ value: p, label: COUNT_PATTERN_LABEL[p] }))}
		bind:value={pattern}
	/>
{/snippet}

<Screen title="My count" left={back} extra={stage === 'grid' ? patterns : undefined}>
	{#if stage === 'grid'}
		<p class="mx-1 text-[15px] text-ink-2">
			Record yourself counting and the player uses your voice. A tempo with nothing recorded uses
			the built-in count.
		</p>

		{#if error}
			<p class="rounded-lg border border-danger px-3 py-2 text-[13px] text-danger">{error}</p>
		{/if}

		<span class="{SECTION_LABEL} mt-1.5">{recordedLabel(data.takes, pattern)}</span>
		<ul class={GROUP} aria-label="Tempos">
			{#each TEMPO_LADDER as t (t)}
				{@const state = tempoState(data.takes, pattern, t)}
				{@const meta = tempoMeta(state, pattern)}
				<li class="{ROW} min-h-16 pr-3">
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="text-[16px] font-bold text-ink tabular-nums">{t} BPM</span>
						<span
							class="text-[13px] {meta.tone === 'done'
								? 'font-bold text-done'
								: meta.tone === 'status'
									? 'font-bold text-status'
									: 'text-muted'}">{meta.text}</span
						>
					</span>
					<button
						type="button"
						class={state.state === 'none' ? button('secondary', 'sm') : button('tertiary', 'sm')}
						aria-label="{state.state === 'none' ? 'Record' : 'Redo'} {t} BPM"
						onclick={() => {
							bpm = t;
							stage = 'arming';
						}}
					>
						{#if state.state === 'none'}<Icon name="mic" size={18} />Record{:else}Redo{/if}
					</button>
				</li>
			{/each}
		</ul>

		{#if rows.length}
			<span class="{SECTION_LABEL} mt-3.5">Recorded takes</span>
			<ul class={GROUP}>
				{#each rows as r (r.id)}
					<li class="{ROW} min-h-16 pr-1.5">
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-[16px] font-bold text-ink tabular-nums">{r.title}</span>
							<span class="text-[13px] text-muted">{r.meta}</span>
						</span>
						<button
							type="button"
							class={iconButton('bare').replace('text-ink', 'text-danger')}
							aria-label={r.deleteLabel}
							onclick={() => remove(r.id, r.deleted)}><Icon name="trash" size={20} /></button
						>
					</li>
				{/each}
			</ul>
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
		<!--
			Both leave before the four bars are up. Stop keeps the whole bars you
			did count; Redo throws the lot away and starts the count-in again.
		-->
		<div class="flex gap-3">
			<button type="button" class="{btnHalf} border border-rule text-ink" onclick={redo}>
				Redo
			</button>
			<button
				type="button"
				class="{btnHalf} border border-danger text-danger"
				onclick={stopRecording}
			>
				Stop
			</button>
		</div>
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
</Screen>

<Toast
	{toast}
	onaction={() => toast?.undo?.()}
	ondismiss={() => (toast = null)}
	bottom="calc(1rem + env(safe-area-inset-bottom))"
/>

<Toast
	{toast}
	onaction={() => toast?.undo?.()}
	ondismiss={() => (toast = null)}
	bottom="calc(1rem + env(safe-area-inset-bottom))"
/>
