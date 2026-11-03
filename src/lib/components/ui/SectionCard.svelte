<!-- src/lib/components/ui/SectionCard.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dateLabel } from '$lib/format';
	import { spotLabel } from '$lib/video/spots';
	import SectionPlayer from './SectionPlayer.svelte';
	import Icon from './Icon.svelte';
	import type { LinkedSection } from '$lib/types';

	/**
	 * A linked section: where it is from and what it is. A tap plays it full
	 * screen, looping. `unlink` is the page's own form, when it offers one.
	 */
	let {
		section,
		unlink,
		focusKey,
		canEdit = true
	}: {
		section: LinkedSection;
		unlink?: Snippet;
		focusKey?: string;
		/** Marking and editing spots in its player: off for a reader of a group's video. */
		canEdit?: boolean;
	} = $props();

	let open = $state(false);

	const from = $derived(
		section.video.from.kind === 'lesson'
			? `${section.video.from.title} · ${dateLabel(section.video.from.lessonDay)}`
			: `Recording · ${section.video.from.figure}`
	);
	const range = $derived(spotLabel({ ...section.spot, label: null }));
</script>

<div class="flex min-h-16 items-center rounded-2xl bg-surface pr-1.5 pl-3">
	<button
		data-focus={focusKey}
		type="button"
		class="flex min-h-16 min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
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
	{#if unlink}
		{@render unlink()}
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
		onclose={() => (open = false)}
	/>
{/if}
