<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { watchMedia, type MediaProblem } from '$lib/media';
	import { byteSize } from '$lib/format';
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';
	import { recordingMetaLine } from '$lib/figures/page';
	import VideoPlayer from '$lib/components/ui/VideoPlayer.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import type { RecordingRow } from '$lib/types';

	/**
	 * A recording as a row of the figure page's Recordings card. A video opens
	 * full screen; an old audio recording plays in its row. A hidden element
	 * loads the file's metadata, as the inline player did, so a missing or
	 * undecodable file says so here instead of opening a black player.
	 */
	let {
		recording,
		day,
		title,
		linking,
		canEdit,
		focusKey,
		trailing,
		meta: given,
		onclosed
	}: {
		recording: RecordingRow;
		/** "Wednesday, 28 October": the row's title. */
		day: string;
		/** The figure label, for the player's top bar. */
		title: string;
		linking: boolean;
		canEdit: boolean;
		focusKey: string;
		/** The trash while editing, or Take: replaces the chevron or Download. */
		trailing?: Snippet;
		/** Its line under the day, in place of "Video · 24 MB" (a source's recording: "New · 12 MB"). A broken file's line still wins. */
		meta?: string;
		onclosed: () => void;
	} = $props();

	let problem = $state<MediaProblem | null>(null);
	let open = $state(false);
	let prefs = $state(loadVideoPrefs());

	const src = $derived(`/recordings/${recording.file}`);
	const video = $derived(recording.kind === 'video');
	const meta = $derived(
		problem === 'missing'
			? 'This file is missing'
			: problem === 'unplayable'
				? 'Can’t play here'
				: (given ?? recordingMetaLine(recording.kind, byteSize(recording.sizeBytes)))
	);
	/** A video that can play opens the player; anything else is a plain row. */
	const opens = $derived(video && problem === null);
</script>

{#snippet lead()}
	<span
		class="grid size-10 shrink-0 place-items-center rounded-full bg-chip text-ink-2"
		aria-hidden="true"><Icon name={video ? 'video' : 'mic'} size={20} /></span
	>
{/snippet}

{#snippet words()}
	<span class="min-w-0 py-2">
		<span class="block truncate text-[16px] font-bold">{day}</span>
		<span class="block truncate text-[13px] {problem ? 'font-bold text-status' : 'text-muted'}"
			>{meta}</span
		>
	</span>
{/snippet}

<div class="flex min-h-[60px] flex-col justify-center pr-1.5 pl-4">
	<div class="flex items-center">
		{#if opens}
			<button
				data-focus={focusKey}
				type="button"
				class="flex min-h-[60px] min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
				aria-label="Play the recording from {day}"
				onclick={() => {
					prefs = loadVideoPrefs();
					open = true;
				}}>{@render lead()}{@render words()}</button
			>
		{:else}
			<div data-focus={focusKey} class="flex min-h-[60px] min-w-0 flex-1 items-center gap-3">
				{@render lead()}{@render words()}
			</div>
		{/if}
		{#if trailing}
			{@render trailing()}
		{:else if problem === 'unplayable'}
			<a
				href={resolve('/recordings/[file]', { file: recording.file })}
				download
				class={button('tertiary', 'sm')}><Icon name="download" size={18} />Download</a
			>
		{:else if opens}
			<span
				class="flex size-11 flex-none items-center justify-center text-chevron"
				aria-hidden="true"><Icon name="chevron-right" size={20} /></span
			>
		{/if}
	</div>
	{#if video}
		<!-- Only to learn whether the file is there and plays: never shown. -->
		<video
			{src}
			preload="metadata"
			muted
			class="hidden"
			aria-hidden="true"
			{@attach watchMedia(src, (p) => (problem = p))}
		></video>
	{:else if problem !== 'missing'}
		<audio
			{src}
			controls
			preload="metadata"
			class="mb-3 w-full"
			aria-label="The recording from {day}"
			{@attach watchMedia(src, (p) => (problem = p))}
		></audio>
	{/if}
</div>

{#if open}
	<VideoPlayer
		{src}
		owner={{ recordingId: recording.id }}
		startAt={0}
		{title}
		subtitle="Recording"
		{linking}
		{canEdit}
		mirror={prefs.mirror}
		rate={prefs.rate}
		muted={prefs.muted}
		onchoose={(next) => {
			prefs = { ...prefs, ...next };
			saveVideoPrefs(next);
		}}
		onclose={() => {
			open = false;
			onclosed();
		}}
	/>
{/if}
