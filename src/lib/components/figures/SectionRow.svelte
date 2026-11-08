<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dateLabel } from '$lib/format';
	import { spotLabel } from '$lib/video/spots';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import SectionPlayer from '$lib/components/ui/SectionPlayer.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { LinkedSection } from '$lib/types';
	import { t } from '$lib/i18n/catalog';

	/**
	 * A linked section as a row of the figure page's Recordings card: what
	 * `SectionCard` shows, without a card of its own. A tap plays it full screen,
	 * looping. `trailing` (Unlink while editing) takes the repeat icon's place.
	 */
	let {
		section,
		focusKey,
		canEdit,
		trailing
	}: {
		section: LinkedSection;
		focusKey: string;
		/** Marking and editing spots in its player: off for a reader of a group's video. */
		canEdit: boolean;
		trailing?: Snippet;
	} = $props();

	let open = $state(false);

	const from = $derived(
		section.video.from.kind === 'lesson'
			? `${section.video.from.title} · ${dateLabel(section.video.from.lessonDay)}`
			: t().figure.recordings.recordingOf(section.video.from.figure)
	);
	const range = $derived(spotLabel({ ...section.spot, label: null }));
</script>

<div class="flex min-h-[60px] items-center pr-1.5 pl-4">
	<button
		data-focus={focusKey}
		type="button"
		class="flex min-h-[60px] min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
		onclick={() => (open = true)}
	>
		<span
			class="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-on-accent"
			aria-hidden="true"><Icon name="play" size={18} filled /></span
		>
		<span class="min-w-0 py-2">
			<span class="block truncate text-[16px] font-bold">{spotLabel(section.spot)}</span>
			<span class="block truncate text-[13px] text-muted"
				>{section.spot.label ? `${from} · ${range}` : from}</span
			>
		</span>
	</button>
	{#if trailing}
		{@render trailing()}
	{:else}
		<span class="flex size-11 flex-none items-center justify-center text-chevron" aria-hidden="true"
			><Icon name="repeat" size={20} /></span
		>
	{/if}
</div>

{#if open}
	<SectionPlayer
		src={section.video.src}
		owner={section.video.owner}
		spot={section.spot}
		from={section.video.from}
		{canEdit}
		linking={canEdit}
		onclose={() => {
			open = false;
			// The player may have renamed, moved or linked the section.
			if (canEdit) void refreshWhenSettled();
		}}
	/>
{/if}
