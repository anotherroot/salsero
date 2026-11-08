<script lang="ts">
	import { loadVideoPrefs, saveVideoPrefs } from '$lib/video-prefs';
	import { dateLabel } from '$lib/format';
	import { spotLabel } from '$lib/video/spots';
	import SectionPlayer from '$lib/components/ui/SectionPlayer.svelte';
	import VideoPlayer from '$lib/components/ui/VideoPlayer.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CLIP } from '$lib/components/ui/styles';
	import type { TopVideo } from '$lib/figures/page';
	import type { LinkedSection, RecordingRow } from '$lib/types';
	import { t } from '$lib/i18n/catalog';

	/**
	 * The figure page's first thing (figure page rework, "The video"): the first
	 * section, else the first video recording, as a still picture with a play disc
	 * and a caption at its foot. A tap opens it full screen, a section looping.
	 */
	let {
		top,
		title,
		day,
		linking,
		canEdit,
		onclosed
	}: {
		top: NonNullable<TopVideo<LinkedSection, RecordingRow>>;
		/** The figure label, for the player's top bar. */
		title: string;
		/** A recording's day, for its caption. */
		day: string;
		linking: boolean;
		canEdit: boolean;
		onclosed: () => void;
	} = $props();

	let open = $state(false);
	let prefs = $state(loadVideoPrefs());

	const src = $derived(
		top.kind === 'section' ? top.section.video.src : `/recordings/${top.recording.file}`
	);
	const startS = $derived(top.kind === 'section' ? top.section.spot.startMs / 1000 : 0);
	const label = $derived(
		top.kind === 'section' ? spotLabel(top.section.spot) : t().figure.recordings.recording
	);
	const caption = $derived.by(() => {
		if (top.kind === 'recording') return t().figure.recordings.recordingOf(day);
		const s = top.section;
		const from =
			s.video.from.kind === 'lesson'
				? `${s.video.from.title} · ${dateLabel(s.video.from.lessonDay)}`
				: t().figure.recordings.recordingOf(s.video.from.figure);
		const range = spotLabel({ ...s.spot, label: null });
		return `${spotLabel(s.spot)} · ${from} · ${range}`;
	});

	function close() {
		open = false;
		onclosed();
	}
</script>

<button
	type="button"
	class="{CLIP} relative block aspect-video w-full cursor-pointer rounded-2xl bg-black text-left desk:max-h-[70dvh]"
	aria-label={t().figure.recordings.playLabel(label)}
	onclick={() => {
		prefs = loadVideoPrefs();
		open = true;
	}}
>
	<!-- The picture at the section's start: no controls, nothing plays here. -->
	<video
		src="{src}#t={startS}"
		preload="metadata"
		muted
		playsinline
		tabindex="-1"
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 h-full w-full object-contain"
	></video>
	<span
		class="absolute top-[46%] left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-black"
		aria-hidden="true"><Icon name="play" size={26} filled /></span
	>
	<span
		class="absolute inset-x-0 bottom-0 truncate bg-linear-to-b from-transparent to-black/65 px-3 pt-6 pb-2.5 text-[13px] font-semibold text-white"
		>{caption}</span
	>
</button>

{#if open}
	{#if top.kind === 'section'}
		<SectionPlayer
			src={top.section.video.src}
			owner={top.section.video.owner}
			spot={top.section.spot}
			from={top.section.video.from}
			{canEdit}
			{linking}
			onclose={close}
		/>
	{:else}
		<VideoPlayer
			{src}
			owner={{ recordingId: top.recording.id }}
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
			onclose={close}
		/>
	{/if}
{/if}
