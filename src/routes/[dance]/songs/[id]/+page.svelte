<script lang="ts">
	import { tick } from 'svelte';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SampleButton from '$lib/components/songs/SampleButton.svelte';
	import { sampling, stopSample } from '$lib/songs/sample-player.svelte';
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import SeekBar from '$lib/components/ui/SeekBar.svelte';
	import { GROUP, SECTION_LABEL, button, iconButton } from '$lib/components/ui/styles';
	import { act } from '$lib/components/routines/act';
	import { songName } from '$lib/songs/library';
	import { sampleLabels, songSubtitle, tapProblem } from '$lib/songs/song-page';
	import { clock } from '$lib/format';
	import { TEMPO_FACTORS, TEMPO_LABEL } from '$lib/labels';
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
	let details: HTMLDetailsElement | undefined = $state();

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
	const otherRefusal = $derived(form?.message && !form.action ? form.message : null);
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
		if (audio.paused) void audio.play().catch(() => {});
		else audio.pause();
	}

	function seek(s: number) {
		if (!audio) return;
		audio.currentTime = s;
		now = s;
	}

	async function openDetails() {
		detailsOpen = true;
		await tick();
		details?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
</script>

<svelte:head><title>{song.title || 'Song'} · {data.dance.label}</title></svelte:head>

<Screen compact title={name} {subtitle}>
	{#snippet left()}
		<BandButton
			icon="back"
			label="Back to Music"
			href={resolve('/[dance]/songs', { dance: data.dance.slug })}
		/>
	{/snippet}
	{#snippet right()}
		<BandButton icon="edit" label="Song details" onclick={openDetails} />
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
					class={iconButton('filled').replace('h-11 w-11', 'size-[52px]')}
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
			{#if tapped}
				<button
					type="submit"
					aria-live="polite"
					class="flex h-16 w-full flex-none items-center justify-center gap-2.5 rounded-full bg-done-soft font-display text-[22px] font-extrabold text-done"
				>
					<Icon name="check" size={24} />Got it
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

		<h2 class="{SECTION_LABEL} pt-2">Count speed</h2>
		<Segmented
			name="factor"
			label="Count speed"
			items={tempoItems}
			value={String(song.tempoFactor)}
			onchange={(v) => act('tempo', { factor: v })}
		/>
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
						<form method="POST" action="?/removeAnchor" use:enhance>
							<input type="hidden" name="beat" value={beat} />
							<button
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
		<section class="rounded-xl border border-line bg-raised p-4 text-[14px]">
			{#if song.status === 'waiting_download'}
				<p>Waiting for the home fetcher to download this song.</p>
				<p class="mt-1 text-[12px] text-muted">
					It runs on the laptop about once a minute while it is on.
				</p>
			{:else if song.status === 'waiting_analysis'}
				<p>Waiting for beat analysis on the laptop.</p>
			{:else}
				<p class="text-danger">This song failed: {song.error ?? 'unknown error'}</p>
				<form method="POST" action="?/retry" use:enhance class="mt-3">
					<button
						type="submit"
						class="h-11 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
						>Retry</button
					>
				</form>
				<p class="mt-2 text-[12px] text-muted">
					Or upload the audio file from the <a
						href={resolve('/[dance]/songs', { dance: data.dance.slug })}
						class="text-accent">Music</a
					> page.
				</p>
			{/if}
		</section>
	{/if}

	{#if otherRefusal}
		<Banner kind="error" title={otherRefusal} />
	{/if}

	<!-- Until Song details becomes a sheet (the next task), the pencil opens this. -->
	<details bind:this={details} bind:open={detailsOpen} class="mt-4 rounded-xl border border-line">
		<summary class="cursor-pointer px-3 py-3 text-[14px] font-medium">Song details</summary>
		<form
			method="POST"
			action="?/update"
			use:guarded={{
				label: 'Song details',
				submit:
					() =>
					async ({ update }) =>
						update({ reset: false })
			}}
			class="space-y-3 px-3 pb-3"
		>
			<input
				name="title"
				required
				maxlength="200"
				value={song.title}
				aria-label="Title"
				placeholder="Title"
				class={field}
			/>
			<input
				name="artist"
				maxlength="200"
				value={song.artist ?? ''}
				aria-label="Artist"
				placeholder="Artist"
				class={field}
			/>
			<select name="style" value={song.style} aria-label="Style" class={field}>
				{#each data.dance.styles as s (s)}<option value={s}>{data.dance.styleLabel[s]}</option
					>{/each}
			</select>
			<button
				type="submit"
				class="h-11 w-full rounded-xl border border-rule text-[14px] font-medium">Save</button
			>
		</form>
		{#if song.sourceUrl}
			<p class="truncate px-3 pb-3 text-[12px] text-muted">From {song.sourceUrl}</p>
		{/if}
		<form
			method="POST"
			action="?/archive"
			class="border-t border-line px-3 py-3"
			onsubmit={(e) => {
				if (!confirm('Archive this song?')) e.preventDefault();
			}}
		>
			<button type="submit" class="text-[14px] text-danger">Archive song</button>
		</form>
	</details>
</Screen>
