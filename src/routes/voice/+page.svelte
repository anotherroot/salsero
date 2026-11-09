<script lang="ts">
	import { getDance } from '$lib/dances/dances';
	import { uploadFailure } from '$lib/upload-error';
	import { page } from '$app/state';
	import { act } from '$lib/act';
	import { offlineRefusal, refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { CHIP, GROUP, ROW, SECTION_LABEL, button, iconButton } from '$lib/components/ui/styles';
	import { tick, type Snippet } from 'svelte';
	import { keptMessage, recordedLabel, takeRows, tempoMeta, tempoState } from '$lib/voice/grid';
	import { nothingCaptured, recordingView, silentLine, voiceError } from '$lib/voice/recording';
	import { t } from '$lib/i18n/catalog';
	import { voiceBack } from '$lib/voice/back';
	import { invalidateAll } from '$app/navigation';
	import { leaveOrAsk, track } from '$lib/unsaved/guard.svelte';
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
	import { focusAfterRemoval } from '$lib/focus';
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
	let error = $state<{ title: string; body: string } | null>(null);
	/** A failed Keep, shown at the top of the choosing stage. */
	let keepError = $state<string | null>(null);
	let saving = $state(false);
	/** The beat the click is on; null before the first one. */
	let beat = $state<{ bar: number; count: number } | null>(null);
	let takesList: HTMLElement | undefined = $state();

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
	// Leaving mid-recording stops the microphone and the click.
	$effect(() => () => {
		gen++;
		controller?.abort();
	});
	/** True once a run has been stopped, so an empty result is not called a failure. */
	let stopped = false;

	async function record() {
		const mine = ++gen;
		// A refused Keep belongs to the take it was about, not the next one.
		keepError = null;
		controller = new AbortController();
		// Held locally: a later run reassigns `controller`, and this one must keep
		// listening to the signal it was started with.
		const signal = controller.signal;
		stopped = false;
		error = null;
		stage = 'recording';
		beat = null;

		running = (async () => {
			try {
				const c = await recordAgainstClick({
					bpm,
					bars: BARS,
					signal,
					onBeat: (bar, count) => {
						if (mine !== gen) return;
						beat = { bar, count };
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
					error = nothingCaptured();
				}
			} catch (e) {
				if (mine !== gen) return;
				stage = 'grid';
				error = voiceError(e);
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
		if (!res.ok) throw new Error(uploadFailure(await res.text(), t().settings.voice.uploadFailed));
	}

	/** Upload the chosen bars. True when they all landed. */
	async function keep(): Promise<boolean> {
		if (!capture) return false;
		saving = true;
		keepError = null;
		try {
			const kept: ('a' | 'b')[] = [];
			for (const half of ['a', 'b'] as const) {
				const i = chosen[half];
				if (i === null) continue;
				await upload(half, cutTake(capture, slices[half][i]));
				kept.push(half);
			}
			capture = null;
			stage = 'grid';
			toast = { id: ++seq, message: keptMessage(bpm, kept, pattern), icon: 'check', tone: 'done' };
			// The grid is server state; re-fetch rather than guessing what landed.
			await invalidateAll();
			await tick();
			takesList?.scrollIntoView({
				block: 'end',
				behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
			});
			return true;
		} catch (e) {
			keepError = e instanceof Error ? e.message : t().settings.voice.couldNotSaveTakesLine;
			return false;
		} finally {
			saving = false;
		}
	}

	// A take being chosen lives only in memory: leaving loses it, so ask.
	// "Back" is the one way out that does not, because it says so.
	$effect(() =>
		track({
			label: t().settings.voice.unsaved,
			dirty: () => stage === 'choosing' && capture !== null,
			blocked: () => (chosen.a === null && chosen.b === null ? t().settings.voice.pickFirst : null),
			save: async () =>
				(await keep())
					? { ok: true }
					: { ok: false, message: keepError ?? t().settings.voice.couldNotSaveTakesLine }
		})
	);

	// Back goes where My count was opened from: Practice, else Settings.
	const backTo = $derived(voiceBack(page.url.searchParams.get('from')));
	const rows = $derived(takeRows(data.takes, pattern));

	let toast = $state<ToastState | null>(null);
	let seq = 0;

	function refused(result: Awaited<ReturnType<typeof act>>) {
		const message = refusalMessage(result, t().settings.voice.couldNotDo);
		if (message === null) return false;
		if (!offlineRefusal(result)) toast = { id: ++seq, message };
		return true;
	}

	/** Delete now; the toast's Undo brings the take back for a minute. */
	async function remove(id: number, deleted: string) {
		const keys = rows.map((r) => `take-${r.id}`);
		if (refused(await act('delete', { id }))) return;
		toast = undoToast(
			++seq,
			deleted,
			() => (toast = null),
			async () => refused(await act('restore', { id }))
		);
		await focusAfterRemoval(keys, `take-${id}`, 'tempos-heading');
	}

	/** Back from a stage that is not the list. Nothing chosen yet is lost on purpose. */
	function leaveStage() {
		if (stage === 'choosing') {
			leaveOrAsk(null, () => {
				capture = null;
				keepError = null;
				stage = 'grid';
			});
			return;
		}
		if (stage === 'recording') {
			gen++;
			controller?.abort();
		}
		stage = 'grid';
	}

	const view = $derived(recordingView(pattern, BARS, beat));
	const w = $derived(t().settings.voice);
	const myCount = $derived(t().shell.lists.myCount);
	const dotLook: Record<string, string> = {
		current:
			'bg-accent text-on-accent shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]',
		said: 'bg-accent-soft text-accent-text',
		silent: 'bg-transparent text-muted shadow-[inset_0_0_0_2px_var(--color-hairline)]',
		next: 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-field-line)]'
	};
</script>

<svelte:head><title>{`${myCount} · ${getDance(data.appDance).label}`}</title></svelte:head>

{#snippet back()}
	<BandButton icon="back" label={backTo.label} href={backTo.href} />
{/snippet}
{#snippet stageBack()}
	<!-- An in-page stage change, not a history entry: the stage is not a place. -->
	<BandButton icon="back" label={t().shell.backTo(myCount)} onclick={leaveStage} />
{/snippet}
{#snippet patterns()}
	<!-- The band row's toggle on the desktop: 480 wide, as the board draws it. -->
	<div class="desk:w-[480px]">
		<Segmented
			onBand
			name="pattern"
			label={w.countPattern}
			items={PHRASE_PATTERNS.map((p) => ({ value: p, label: COUNT_PATTERN_LABEL[p] }))}
			bind:value={pattern}
		/>
	</div>
{/snippet}

<Screen
	title={stage === 'grid'
		? myCount
		: stage === 'arming'
			? `${bpm} BPM`
			: stage === 'recording'
				? w.recording
				: w.pickBars}
	subtitle={stage === 'arming'
		? w.countSub(COUNT_PATTERN_LABEL[pattern])
		: stage === 'grid'
			? undefined
			: w.atBpm(COUNT_PATTERN_LABEL[pattern], bpm)}
	left={stage === 'grid' ? back : stageBack}
	extra={stage === 'grid' ? patterns : undefined}
>
	{#if stage === 'grid'}
		{#if error}
			<Banner kind="error" title={error.title}>{error.body}</Banner>
		{:else}
			<p class="mx-1 text-[15px] text-ink-2">
				{w.intro}
			</p>
		{/if}

		<span class="{SECTION_LABEL} mt-1.5" tabindex="-1" data-focus="tempos-heading"
			>{recordedLabel(data.takes, pattern)}</span
		>
		<ul class={GROUP} aria-label={w.tempos}>
			{#each TEMPO_LADDER as tempo (tempo)}
				{@const state = tempoState(data.takes, pattern, tempo)}
				{@const meta = tempoMeta(state, pattern)}
				<li class="{ROW} min-h-16 pr-3">
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="text-[16px] font-bold text-ink tabular-nums">{`${tempo} BPM`}</span>
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
						aria-label={state.state === 'none' ? w.recordLabel(tempo) : w.redoLabel(tempo)}
						onclick={() => {
							bpm = tempo;
							error = null;
							stage = 'arming';
						}}
					>
						{#if state.state === 'none'}<Icon name="mic" size={18} />{w.record}{:else}{w.redo}{/if}
					</button>
				</li>
			{/each}
		</ul>

		{#if rows.length}
			<span class="{SECTION_LABEL} mt-3.5" tabindex="-1" data-focus="takes-heading"
				>{w.recordedTakes}</span
			>
			<ul class={GROUP} bind:this={takesList}>
				{#each rows as r (r.id)}
					<li class="{ROW} min-h-16 pr-1.5">
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-[16px] font-bold text-ink tabular-nums">{r.title}</span>
							<span class="text-[13px] text-muted">{r.meta}</span>
						</span>
						<button
							data-focus="take-{r.id}"
							type="button"
							class={iconButton('bare', 'danger')}
							aria-label={r.deleteLabel}
							onclick={() => remove(r.id, r.deleted)}><Icon name="trash" size={20} /></button
						>
					</li>
				{/each}
			</ul>
		{/if}
	{:else if stage === 'arming'}
		<div class="flex flex-col gap-2 pb-24">
			<!--
				Not a suggestion. Through a speaker the click lands in the recording,
				and the browser's echo cancellation then ducks the voice to cancel it.
			-->
			<Banner kind="warning" title={w.headphones}>
				{w.headphonesBody}
			</Banner>
			<span class="{SECTION_LABEL} mt-3.5">{w.howItGoes}</span>
			<ol class="rounded-[22px] bg-surface py-1">
				{#snippet step(n: number, text: Snippet)}
					<li class="flex items-start gap-3.5 py-3 pr-4 pl-3.5">
						<span
							class="flex size-7 flex-none items-center justify-center rounded-full bg-accent-soft text-[14px] font-extrabold text-accent-text"
							>{n}</span
						>
						<span class="pt-[3px] text-[15px] leading-[1.45] text-ink">{@render text()}</span>
					</li>
				{/snippet}
				{#snippet one()}{w.stepOne}{/snippet}
				{#snippet two()}{w.stepTwoBefore}
					<strong>{COUNT_PATTERN_LABEL[pattern]}</strong>
					{w.stepTwoAfter(BARS)}{/snippet}
				{#snippet three()}{silentLine(pattern)}{/snippet}
				{@render step(1, one)}
				{@render step(2, two)}
				{@render step(3, three)}
			</ol>
		</div>
		<BottomBar>
			<button type="button" class={button('primary', 'lg', true)} onclick={record}
				><Icon name="mic" size={24} />{w.start}</button
			>
		</BottomBar>
	{:else if stage === 'recording'}
		<div class="flex flex-col gap-2 pb-24">
			<div
				class="flex flex-col items-center gap-[18px] rounded-[22px] bg-surface px-[18px] pt-[22px] pb-6 desk:mt-12 desk:gap-6 desk:px-8 desk:py-10"
			>
				<span
					class="inline-flex h-[30px] items-center gap-2 rounded-full bg-danger-soft px-3 text-[13px] font-extrabold text-danger"
					><span class="size-2 rounded-full bg-danger"></span>{w.recording}</span
				>
				<p class="text-center">
					<span
						aria-live="polite"
						class="block font-display text-[40px] leading-tight font-extrabold text-ink desk:text-[56px]"
						>{view.heading}</span
					>
					{#if view.say || view.line}
						<span
							class="mt-1.5 block text-[15px] font-semibold text-muted desk:mt-2.5 desk:text-[18px]"
						>
							{#if view.say}{w.sayBefore}
								<strong class="text-ink">{view.say}</strong>
								{w.sayAfter}{:else}{view.line}{/if}
						</span>
					{/if}
				</p>
				<div aria-hidden="true" class="flex justify-center gap-[9px] desk:gap-3.5">
					{#each view.dots as dot, i (i)}
						<span
							class="flex size-[34px] items-center justify-center rounded-full text-[15px] font-extrabold tabular-nums desk:size-11 desk:text-[18px] {dotLook[
								dot
							]}">{i + 1}</span
						>
					{/each}
				</div>
				<div
					role="progressbar"
					aria-label={w.barsCounted}
					aria-valuemin={0}
					aria-valuemax={BARS}
					aria-valuenow={view.barsDone}
					class="flex w-full gap-1.5 desk:max-w-[480px]"
				>
					{#each Array.from({ length: BARS }, (_, i) => i) as i (i)}
						<span
							class="h-1.5 flex-1 overflow-hidden rounded-[3px] {i < view.barsDone
								? 'bg-accent'
								: 'bg-hairline'}"
						>
							{#if i === view.barsDone}
								<span
									class="block h-1.5 rounded-[3px] bg-accent"
									style:width="{view.barFraction * 100}%"
								></span>
							{/if}
						</span>
					{/each}
				</div>
			</div>
			<!--
				Both leave before the four bars are up. Stop keeps the whole bars you
				did count; Redo throws the lot away and starts the count-in again.
			-->
			<p class="px-4 pt-1.5 text-[13px] text-muted">
				{w.stopNote}
			</p>
		</div>
		<BottomBar>
			<div class="flex gap-2.5">
				<div class="flex flex-1">
					<button type="button" class={button('secondary', 'lg', true)} onclick={redo}
						><Icon name="refresh" size={24} />{w.redo}</button
					>
				</div>
				<div class="flex flex-1">
					<button type="button" class={button('primary', 'lg', true)} onclick={stopRecording}
						><Icon name="stop" size={24} />{w.stop}</button
					>
				</div>
			</div>
		</BottomBar>
	{:else}
		<div class="flex flex-col gap-2 pb-36">
			{#if keepError}
				<Banner kind="error" title={w.couldNotSaveTakes}>{keepError}</Banner>
			{/if}
			<p class="mx-1 text-[15px] text-ink-2">
				{w.pickIntro}
			</p>
			{#each ['a', 'b'] as const as half (half)}
				{@const counts = phraseCounts(pattern, half).join(' ')}
				<span class="{SECTION_LABEL} mt-1.5">{half === 'a' ? w.firstHalf : w.secondHalf}</span>
				<div class="flex flex-col gap-2.5 rounded-[22px] bg-surface p-4">
					<span class="text-[16px] font-bold text-ink">{w.counts(counts)}</span>
					{#if slices[half].length === 0}
						<span class="text-[14px] text-muted">{w.nothingUsable}</span>
					{:else}
						<div role="radiogroup" aria-label={w.barFor(counts)} class="flex flex-wrap gap-1.5">
							{#each [...slices[half].keys()] as i (i)}
								<label class={CHIP}>
									<input
										type="radio"
										name="pick-{half}"
										checked={chosen[half] === i}
										onchange={() => (chosen = { ...chosen, [half]: i })}
										class="sr-only"
									/>
									{w.bar(i + 1)}
								</label>
							{/each}
						</div>
						<div>
							<button type="button" class={button('secondary', 'sm')} onclick={() => listen(half)}
								><Icon name="play" size={18} />{w.listen((chosen[half] ?? 0) + 1)}</button
							>
						</div>
					{/if}
				</div>
			{/each}
		</div>
		<BottomBar>
			<div class="flex flex-col gap-2">
				<button
					type="button"
					class={button('primary', 'lg', true)}
					disabled={saving || (chosen.a === null && chosen.b === null)}
					aria-busy={saving}
					onclick={keep}
				>
					{#if saving}<Spinner size={22} />{w.saving}{:else}<Icon
							name="check"
							size={24}
						/>{w.keep}{/if}
				</button>
				<button
					type="button"
					class={button('tertiary', 'md', true)}
					disabled={saving}
					onclick={record}><Icon name="refresh" size={20} />{w.recordAgain}</button
				>
			</div>
		</BottomBar>
	{/if}
</Screen>

<Toast
	{toast}
	onaction={() => toast?.undo?.()}
	ondismiss={() => (toast = null)}
	bottom="calc(1rem + var(--safe-bottom))"
/>
