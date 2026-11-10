<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { watchMedia, type MediaProblem } from '$lib/media';
	import { byteSize } from '$lib/format';
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';
	import { recordingMetaLine } from '$lib/figures/page';
	import VideoPlayer from '$lib/components/ui/VideoPlayer.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import KeepButton from '$lib/components/ui/KeepButton.svelte';
	import WhereButton from '$lib/components/ui/WhereButton.svelte';
	import { livePlace, type PhoneVideo } from '$lib/offline/places.svelte';
	import { placeWord } from '$lib/offline/where-view';
	import IphoneCard from '$lib/components/ui/IphoneCard.svelte';
	import IphoneWhy from '$lib/components/ui/IphoneWhy.svelte';
	import { iphoneCard } from '$lib/offline/iphone-card.svelte';
	import { uploadOriginal } from '$lib/offline/upload-original';
	import { kept } from '$lib/offline/kept.svelte';
	import { keepWord, videoKeep } from '$lib/offline/kept-view';
	import { button, iconButton } from '$lib/components/ui/styles';
	import type { RecordingRow } from '$lib/types';
	import { t } from '$lib/i18n/catalog';

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
		onproblem,
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
		/** Told when the file turns out missing or unplayable (the page keeps it off the top video). */
		onproblem?: (problem: MediaProblem) => void;
		onclosed: () => void;
	} = $props();

	let problem = $state<MediaProblem | null>(null);
	let open = $state(false);
	let prefs = $state(loadVideoPrefs());

	const src = $derived(`/recordings/${recording.file}`);
	const video = $derived(recording.kind === 'video');
	const meta = $derived(
		problem === 'missing'
			? t().figure.recordings.missing
			: problem === 'unplayable'
				? t().figure.recordings.unplayable
				: (given ??
					recordingMetaLine(
						recording.kind,
						byteSize(recording.sizeBytes),
						recording.sourceUrl !== null
					))
	);
	/** The person's own recording (offline phase 4c): where it is. Null: the server's, 4b's rules. */
	const phone = $derived<PhoneVideo>({ ...recording, table: 'recordings' });
	const place = $derived(video ? livePlace(phone) : null);
	const placed = $derived(place !== null && place.state !== 'server');
	/** On another device, or gone from this one: nothing here to play. */
	const away = $derived(place?.state === 'elsewhere' || place?.state === 'missing');
	/** Only on this iPhone (offline phase 4c, 3B): the ⓘ, and the card until it is closed. */
	const onIphone = $derived(place?.state === 'only' && place.iphone);
	/** On this phone, coming, or waiting (offline phase 4b), or where it is (4c): after the meta. */
	const keep = $derived(
		!video || problem !== null
			? null
			: placed
				? placeWord(place)
				: keepWord(videoKeep(kept.status, src))
	);
	/** A video that can play opens the player; anything else is a plain row. */
	const opens = $derived(video && problem === null && !away);

	function found(p: MediaProblem) {
		problem = p;
		onproblem?.(p);
	}
</script>

{#snippet lead()}
	<span
		class="grid size-10 shrink-0 place-items-center rounded-full bg-chip text-ink-2"
		class:opacity-70={away}
		aria-hidden="true"><Icon name={away ? 'phone' : video ? 'video' : 'mic'} size={20} /></span
	>
{/snippet}

{#snippet words()}
	<span class="min-w-0 py-2">
		<span class="block truncate text-[16px] font-bold">{day}</span>
		<span class="block truncate text-[13px] {problem ? 'font-bold text-status' : 'text-muted'}"
			>{keep ? `${meta} · ` : meta}{#if keep}<span
					class="font-bold {keep.tone === 'done'
						? 'text-done'
						: keep.tone === 'warn'
							? 'text-warn'
							: keep.tone === 'danger'
								? 'text-danger'
								: keep.tone === 'ink'
									? 'text-ink-2'
									: ''}">{keep.text}</span
				>{#if onIphone}<IphoneWhy />{/if}{/if}</span
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
				aria-label={t().figure.recordings.play(day)}
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
		{#if !trailing && placed && place && place.state !== 'elsewhere'}<WhereButton
				{place}
				video={phone}
			/>{:else if opens && !trailing}<KeepButton {src} />{/if}
		{#if trailing}
			{@render trailing()}
		{:else if problem === 'unplayable'}
			<a
				href={resolve('/recordings/[file]', { file: recording.file })}
				download
				class={button('tertiary', 'sm')}
				><Icon name="download" size={18} />{t().figure.recordings.download}</a
			>
		{:else if recording.sourceUrl && problem === null}
			<!-- A saved YouTube video: where it came from, as the inline player's "from YouTube" did. -->
			<a
				href={recording.sourceUrl}
				target="_blank"
				rel="external noopener noreferrer"
				class={iconButton('bare', 'muted')}
				aria-label={t().figure.recordings.openOnYouTube}><Icon name="external" size={20} /></a
			>
		{:else if opens}
			<span
				class="flex size-11 flex-none items-center justify-center text-chevron"
				aria-hidden="true"><Icon name="chevron-right" size={20} /></span
			>
		{/if}
	</div>
	{#if onIphone && iphoneCard.shown}
		<div class="pr-2.5 pb-3">
			<IphoneCard
				onupload={() =>
					void uploadOriginal({ table: 'recordings', id: recording.id, file: recording.file })}
			/>
		</div>
	{/if}
	{#if video && away}
		<!-- On another device or gone from this one (offline phase 4c): no file to ask about. -->
	{:else if video}
		<!-- Only to learn whether the file is there and plays: never shown. -->
		<video
			{src}
			preload="metadata"
			muted
			class="hidden"
			aria-hidden="true"
			{@attach watchMedia(src, found)}
		></video>
	{:else if problem !== 'missing'}
		<audio
			{src}
			controls
			preload="metadata"
			class="mb-3 w-full"
			aria-label={t().figure.recordings.from(day)}
			{@attach watchMedia(src, found)}
		></audio>
	{/if}
</div>

{#if open}
	<VideoPlayer
		{src}
		owner={{ recordingId: recording.id }}
		startAt={0}
		{title}
		subtitle={t().figure.recordings.recording}
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
