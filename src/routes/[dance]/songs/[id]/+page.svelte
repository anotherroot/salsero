<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { focusAfterRemoval } from '$lib/focus';
	import { resolve } from '$app/paths';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import SongDetailsSheet from '$lib/components/songs/SongDetailsSheet.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import SeekBar from '$lib/components/ui/SeekBar.svelte';
	import { GROUP, SECTION_LABEL, button, iconButton, swap } from '$lib/components/ui/styles';
	import { act } from '$lib/act';
	import { songName } from '$lib/songs/library';
	import { sampleLabels, songSteps, songSubtitle, tapProblem } from '$lib/songs/song-page';
	import { clock } from '$lib/format';
	import { TEMPO_FACTORS, TEMPO_LABEL } from '$lib/labels';
	import { watchMedia } from '$lib/media';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let audio: HTMLAudioElement | undefined = $state();
	let paused = $state(true);
	let audioDuration = $state(NaN);
	let tapped = $state(false);
	/** "Play the song first." from the browser's own check, before anything is sent. */
	let tapError: string | null = $state(null);
	let now = $state(0);
	let detailsOpen = $state(false);
	let archiving = $state(false);
	/** Why the song will not play, from the audio element or from play(). */
	let audioProblem: string | null = $state(null);
	let tempoError: string | null = $state(null);
	/** The count speed waiting for an answer to "This clears your 1s." */
	let tempoAsk: string | null = $state(null);

	// One sound at a time: the sample pauses this page's own copy of the song.
	$effect(() => {
		if (sampling.id === data.song.id) audio?.pause();
	});

	const song = $derived(data.song);
	const grid = $derived(data.grid);
	const name = $derived(songName(song));
	const subtitle = $derived(
		songSubtitle({
			artist: song.artist,
			style: data.dance.styleLabel[song.style] ?? song.style,
			bpm: grid?.bpm ?? null
		})
	);
	const duration = $derived(
		Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : (song.durationS ?? 0)
	);
	const ticks = $derived(
		grid ? data.anchors.map((i) => grid.beats[i]).filter((t): t is number => t !== undefined) : []
	);
	const sample = $derived(data.sample ? sampleLabels(data.sample.custom) : null);
	// A refusal names the control it is about; one that names none shows at the foot.
	const tapRefusal = $derived(form?.action === 'tap' ? form.message : null);
	const tapShown = $derived(tapError ?? tapRefusal);
	const sampleRefusal = $derived(form?.action === 'sample' ? form.message : null);
	// Song details' own refusals (`title` is sent with them) live in its sheet.
	const retryRefusal = $derived(form?.action === 'retry' ? form.message : null);
	const steps = $derived(songSteps(song.status, song.sourceUrl === null));
	let tempo = $derived(String(song.tempoFactor));
	const tempoItems = TEMPO_FACTORS.map((f) => ({ value: String(f), label: TEMPO_LABEL[f] }));

	$effect(() => {
		if (!song.status.startsWith('waiting')) return;
		const t = setInterval(() => invalidateAll(), 10_000);
		return () => clearInterval(t);
	});

	// `timeupdate` fires about 4 times a second; while playing, follow every
	// frame so the thumb and the time glide instead of jumping.
	$effect(() => {
		if (paused || !audio) return;
		const el = audio;
		let frame = 0;
		const follow = () => {
			now = el.currentTime;
			frame = requestAnimationFrame(follow);
		};
		frame = requestAnimationFrame(follow);
		return () => cancelAnimationFrame(frame);
	});

	function toggle() {
		if (!audio) return;
		if (audio.paused)
			void audio.play().catch((e) => {
				if (!(e instanceof DOMException && e.name === 'AbortError'))
					audioProblem ??= 'The song would not play.';
			});
		else audio.pause();
	}

	function seek(s: number) {
		if (!audio) return;
		audio.currentTime = s;
		now = s;
		tapError = null;
	}

	async function setTempo(v: string) {
		tempoError = null;
		const r = await act('tempo', { factor: v });
		if (r.type === 'failure') {
			tempoError = String(r.data?.message ?? 'Could not change the count speed.');
			tempo = String(song.tempoFactor);
		}
	}

	function cancelTempo() {
		tempoAsk = null;
		tempo = String(song.tempoFactor);
	}

	/** Removing a 1: focus goes to the next one's Remove, else the Count speed heading. */
	const removeAnchor =
		(beat: number): SubmitFunction =>
		() => {
			const keys = data.anchors.map((b) => `anchor-${b}`);
			return async ({ update, result }) => {
				await update();
				if (result.type === 'success')
					await focusAfterRemoval(keys, `anchor-${beat}`, 'count-speed-heading');
			};
		};
</script>

<svelte:head><title>{song.title || 'Song'} · {data.dance.label}</title></svelte:head>

<Screen compact title={name} {subtitle}>
	{#snippet left()}
		<BackButton
			fallback={{
				href: resolve('/[dance]/songs', { dance: data.dance.slug }),
				label: 'Back to Music'
			}}
		/>
	{/snippet}
	{#snippet right()}
		<BandButton icon="edit" label="Song details" onclick={() => (detailsOpen = true)} />
	{/snippet}

	{#if grid && song.audioFile}
		<a
			href={resolve(`/${data.dance.slug}/player?song=${song.id}`)}
			class={button('secondary', 'md', true)}
		>
			<Icon name="play" size={18} filled />Practice with this song
		</a>

		<!-- preload=auto: the count needs the playhead to be accurate from the first tap. -->
		<audio
			bind:this={audio}
			bind:paused
			bind:duration={audioDuration}
			src="/audio/{song.audioFile}"
			preload="auto"
			class="hidden"
			{@attach watchMedia(`/audio/${song.audioFile}`, (p) => {
				audioProblem =
					p === 'missing'
						? 'The song’s audio file is missing.'
						: 'This browser can’t play the song’s audio.';
			})}
			onplay={() => {
				stopSample();
				tapError = null;
			}}
			ontimeupdate={() => (now = audio?.currentTime ?? 0)}
			onseeked={() => (now = audio?.currentTime ?? 0)}
		></audio>

		<section class="flex flex-none flex-col gap-3 rounded-[22px] bg-surface px-4 pt-3.5 pb-4">
			<!-- "–" until the song has played: a count at 0:00 would be a guess, as a tap there would be. -->
			<LiveCount
				time={() => (audio && !tapProblem(audio) ? audio.currentTime : null)}
				beats={grid.beats}
				counts={grid.counts}
			/>
			<div class="flex items-center gap-3.5">
				<button
					type="button"
					class={swap(iconButton('filled'), 'h-11 w-11', 'size-[52px]')}
					aria-label={paused ? 'Play the song' : 'Pause the song'}
					onclick={toggle}
				>
					<Icon name={paused ? 'play' : 'pause'} filled />
				</button>
				<div class="min-w-0 flex-1 pt-3.5">
					<SeekBar label="Position in the song" value={now} {duration} {ticks} onseek={seek} />
				</div>
			</div>
		</section>
		{#if audioProblem}<Banner kind="error" title={audioProblem} />{/if}

		<form
			method="POST"
			action="?/tap"
			class="flex flex-col gap-2"
			use:enhance={({ formData, cancel }) => {
				const problem = tapProblem(audio ?? null);
				tapError = problem;
				if (problem) {
					cancel();
					return;
				}
				formData.set('t', String(audio?.currentTime ?? 0));
				return async ({ update, result }) => {
					await update({ reset: false });
					if (result.type === 'success') {
						tapped = true;
						setTimeout(() => (tapped = false), 600);
					}
				};
			}}
		>
			<span class="sr-only" role="status">{tapped ? 'Got it' : ''}</span>
			{#if tapped}
				<button
					type="submit"
					class="flex h-16 w-full flex-none items-center justify-center gap-2.5 rounded-full bg-done-soft font-display text-[22px] font-extrabold text-done"
				>
					<Icon name="check" size={24} stroke={2.6} />Got it
				</button>
			{:else}
				<button type="submit" class={button('primary', 'lg', true)}>Tap on the 1</button>
			{/if}
			{#if tapShown === 'Play the song first.'}
				<Banner kind="error" title="Play the song first."
					>A tap marks the beat that is playing.</Banner
				>
			{:else if tapShown}
				<Banner kind="error" title={tapShown} />
			{/if}
		</form>

		<p class="px-3 pt-1 text-center text-[13px] leading-[1.45] text-muted">
			{grid.suggested
				? 'The count is a guess. Play the song and tap on every “1” you hear until it lines up.'
				: 'If the count slips after a break, tap the 1 again there.'}{grid.bpm
				? ` · ${Math.round(grid.bpm)} BPM`
				: ''}
		</p>

		{#if data.sample && sample}
			<h2 class="{SECTION_LABEL} pt-3.5">Sample</h2>
			<div class={GROUP}>
				<div class="flex min-h-16 items-center gap-1 pr-1 pl-4">
					<div class="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
						<span class="flex items-center gap-1.5">
							<span class="text-[16px] leading-[1.3] font-bold text-ink tabular-nums"
								>From {clock(data.sample.song.startS)}</span
							>
							<Badge tone={sample.tone}>{sample.badge}</Badge>
						</span>
						<span class="text-[13px] leading-[1.35] text-muted">{sample.meta}</span>
					</div>
					<SampleButton song={data.sample.song} {name} />
				</div>
			</div>
			<form
				method="POST"
				action="?/sample"
				class="flex"
				use:enhance={({ formData }) => {
					formData.set('t', String(audio?.currentTime ?? 0));
					return async ({ update }) => update({ reset: false });
				}}
			>
				<button type="submit" class={button('secondary', 'md', true)}
					>Start the sample at {clock(now)}</button
				>
			</form>
			{#if data.sample.custom}
				<form method="POST" action="?/sampleAuto" use:enhance class="-mt-1 flex justify-center">
					<button type="submit" class={button('tertiary', 'sm')}>Back to automatic</button>
				</form>
			{/if}
			{#if sampleRefusal}
				<Banner kind="error" title={sampleRefusal} />
			{/if}
		{/if}

		<h2 class="{SECTION_LABEL} pt-2" tabindex="-1" data-focus="count-speed-heading">Count speed</h2>
		<Segmented
			name="factor"
			label="Count speed"
			items={tempoItems}
			bind:value={tempo}
			onchange={(v) => (data.anchors.length ? (tempoAsk = v) : setTempo(v))}
		/>
		{#if tempoError}<Banner kind="error" title={tempoError} />{/if}
		<p class="px-3 pt-1 text-[13px] leading-[1.45] text-muted">
			If the count runs at half or double your steps, switch it. This clears your taps.
		</p>

		{#if data.anchors.length > 0}
			<div class="flex min-h-5 items-center justify-between pt-3 pr-1 pl-4">
				<h2 class="text-[13px] font-bold text-muted">Your 1s · {data.anchors.length}</h2>
				<form method="POST" action="?/resetAnchors" use:enhance class="-my-3">
					<button type="submit" class={button('tertiary', 'sm')}>Clear all</button>
				</form>
			</div>
			<ul class={GROUP} aria-label="Your 1s">
				{#each data.anchors as beat (beat)}
					{@const time = clock(grid.beats[beat] ?? 0)}
					<li class="flex min-h-14 items-center justify-between gap-3 pr-1 pl-4">
						<span class="text-[16px] font-bold text-ink tabular-nums">{time}</span>
						<form method="POST" action="?/removeAnchor" use:enhance={removeAnchor(beat)}>
							<input type="hidden" name="beat" value={beat} />
							<button
								data-focus="anchor-{beat}"
								type="submit"
								class={button('danger-text', 'sm')}
								aria-label="Remove the 1 at {time}">Remove</button
							>
						</form>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		{#if steps.length > 0}
			<ul class={GROUP} aria-label="Progress">
				{#each steps as step (step.title)}
					<li class="flex min-h-14 items-center gap-3 py-2 pr-4 pl-4">
						<span class="flex size-6 flex-none items-center justify-center">
							{#if step.state === 'done'}
								<span class="text-done"><Icon name="check-circle" size={24} filled /></span>
							{:else if step.state === 'now'}
								<Spinner size={24} />
							{:else}
								<span class="text-field-line"><Icon name="circle" size={24} /></span>
							{/if}
						</span>
						<span class="flex min-w-0 flex-col gap-0.5">
							<span
								class="text-[16px] leading-[1.3] font-bold {step.state === 'todo'
									? 'text-muted'
									: 'text-ink'}">{step.title}</span
							>
							<span class="text-[13px] leading-[1.35] text-muted">{step.meta}</span>
						</span>
					</li>
				{/each}
			</ul>
			<p class="px-3 pt-1 text-center text-[13px] leading-[1.45] text-muted">
				It runs on the laptop about once a minute while it is on. This page updates by itself.
			</p>
		{:else}
			<Banner kind="error" title="This song failed">{song.error ?? 'Unknown error'}</Banner>
			<form method="POST" action="?/retry" use:enhance class="flex flex-col gap-2">
				<button type="submit" class={button('primary', 'md', true)}>
					<Icon name="refresh" size={20} />Retry
				</button>
				{#if retryRefusal}<Banner kind="error" title={retryRefusal} />{/if}
			</form>
			<a href={resolve(`/${data.dance.slug}/songs?add=1`)} class={button('secondary', 'md', true)}>
				<Icon name="upload" size={20} />Upload a file instead
			</a>
			{#if song.sourceUrl}
				<p class="px-3 text-center text-[13px] break-all text-muted">From {song.sourceUrl}</p>
			{/if}
		{/if}
	{/if}
</Screen>

<SongDetailsSheet
	open={detailsOpen}
	onclose={() => (detailsOpen = false)}
	{song}
	dance={data.dance}
	{form}
	onarchive={() => (archiving = true)}
/>

<Dialog
	open={tempoAsk !== null}
	icon="metronome"
	title="Change count speed?"
	body={data.anchors.length === 1
		? 'This clears the 1 you tapped.'
		: `This clears your ${data.anchors.length} 1s.`}
	onclose={cancelTempo}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={cancelTempo}>Cancel</button>
		<button
			type="button"
			class={button('primary', 'sm')}
			onclick={() => {
				const v = tempoAsk;
				tempoAsk = null;
				if (v !== null) void setTempo(v);
			}}>Change</button
		>
	{/snippet}
</Dialog>

<Dialog
	open={archiving}
	icon="trash"
	tone="danger"
	title="Archive this song?"
	body={`${name} leaves Music and the song popup. Sets you logged with it stay.`}
	onclose={() => (archiving = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (archiving = false)}
			>Cancel</button
		>
		<form method="POST" action="?/archive" use:enhance>
			<button type="submit" class={button('danger', 'sm')}>Archive</button>
		</form>
	{/snippet}
</Dialog>
