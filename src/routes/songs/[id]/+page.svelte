<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import LiveCount from '$lib/components/songs/LiveCount.svelte';
	import { clock } from '$lib/format';
	import { TEMPO_FACTORS, TEMPO_LABEL } from '$lib/labels';
	// TEMPORARY(dance): replaced by params.dance when routes move under [dance].
	import { DANCES } from '$lib/dances/dances';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let audio: HTMLAudioElement | undefined = $state();
	let tapped = $state(false);

	const song = $derived(data.song);
	const grid = $derived(data.grid);

	$effect(() => {
		if (!song.status.startsWith('waiting')) return;
		const t = setInterval(() => invalidateAll(), 10_000);
		return () => clearInterval(t);
	});

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
</script>

<svelte:head><title>{song.title || 'Song'} · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/songs')}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to songs">‹</a
	>
	<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">
		{song.title || song.sourceUrl}
	</h1>
</header>

<main class="space-y-6 px-4 pt-4 pb-4">
	{#if grid && song.audioFile}
		<a
			href={resolve(`/player?song=${song.id}`)}
			class="block h-12 w-full rounded-xl bg-accent text-center text-[15px] leading-[3rem] font-semibold text-accent-ink"
			>Practice with this song</a
		>

		<!-- preload=auto: the count needs the playhead to be accurate from the first tap. -->
		<audio bind:this={audio} src="/audio/{song.audioFile}" controls preload="auto" class="w-full"
		></audio>

		<LiveCount time={() => audio?.currentTime ?? null} beats={grid.beats} counts={grid.counts} />

		<form
			method="POST"
			action="?/tap"
			use:enhance={({ formData }) => {
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
			<button
				type="submit"
				class="h-20 w-full rounded-2xl text-[20px] font-bold {tapped
					? 'bg-done-bg text-done'
					: 'bg-accent text-accent-ink'}">{tapped ? 'Got it' : 'Tap on the 1'}</button
			>
		</form>

		<p class="text-center text-[13px] text-muted">
			{#if grid.suggested}
				The count is a guess. Play the song and tap on every "1" you hear until it lines up.
			{:else}
				If the count slips after a break, tap the 1 again there.
			{/if}
			{#if grid.bpm}· {Math.round(grid.bpm)} BPM{/if}
		</p>

		<section>
			<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Count speed</h2>
			<div class="flex gap-2">
				{#each TEMPO_FACTORS as f (f)}
					<form method="POST" action="?/tempo" use:enhance class="flex-1">
						<input type="hidden" name="factor" value={f} />
						<button
							type="submit"
							aria-pressed={song.tempoFactor === f}
							class="h-11 w-full rounded-lg border text-[15px] {song.tempoFactor === f
								? 'border-accent bg-accent text-accent-ink'
								: 'border-rule bg-raised text-ink-2'}">{TEMPO_LABEL[f]}</button
						>
					</form>
				{/each}
			</div>
			<p class="mt-1 text-[12px] text-muted">
				If the count runs at half or double your steps, switch it. This clears your taps.
			</p>
		</section>

		{#if data.anchors.length > 0}
			<section>
				<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Your 1s</h2>
				<ul class="divide-y divide-line rounded-xl border border-line bg-raised">
					{#each data.anchors as beat (beat)}
						<li class="flex items-center justify-between px-3 py-2 text-[14px]">
							<span class="tabular-nums">{clock(grid.beats[beat] ?? 0)}</span>
							<form method="POST" action="?/removeAnchor" use:enhance>
								<input type="hidden" name="beat" value={beat} />
								<button type="submit" class="h-9 px-2 text-[13px] text-danger">Remove</button>
							</form>
						</li>
					{/each}
				</ul>
				<form method="POST" action="?/resetAnchors" use:enhance class="mt-2">
					<button type="submit" class="text-[13px] text-muted underline">Clear all</button>
				</form>
			</section>
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
					Or upload the audio file from the <a href={resolve('/songs')} class="text-accent">Songs</a
					> page.
				</p>
			{/if}
		</section>
	{/if}

	{#if form?.message}
		<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
			{form.message}
		</p>
	{/if}

	<details class="rounded-xl border border-line">
		<summary class="cursor-pointer px-3 py-3 text-[14px] font-medium">Song details</summary>
		<form
			method="POST"
			action="?/update"
			use:enhance={() =>
				async ({ update }) =>
					update({ reset: false })}
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
				{#each DANCES.salsa.styles as s (s)}<option value={s}>{DANCES.salsa.styleLabel[s]}</option
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
</main>
