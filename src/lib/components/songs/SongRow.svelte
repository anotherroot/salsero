<script lang="ts">
	import WaitingBadge from '$lib/components/ui/WaitingBadge.svelte';
	import type { Snippet } from 'svelte';
	import type { SampleSong } from '$lib/types';
	import { clock } from '$lib/format';
	import { segments } from '$lib/picker/model';
	import { sampling } from '$lib/songs/sample-player.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cloneChip, twinsChip } from '$lib/clones/twins';
	import Badge from '$lib/components/ui/Badge.svelte';
	import SampleButton from './SampleButton.svelte';
	import { t } from '$lib/i18n/catalog';

	/*
	 * A song in a list: the text part is the link; the sample button, or the
	 * trailing badge and the chevron, sit beside it — never inside it.
	 */
	let {
		href,
		name,
		query = '',
		meta,
		tone = null,
		sample = null,
		draft = false,
		songId,
		isNew = false,
		twinned = false,
		cloned = false,
		current = false,
		onopen,
		trailing
	}: {
		href: string;
		name: string;
		query?: string;
		meta: string;
		tone?: 'danger' | null;
		/** The song's id: its Waiting badge while it was added offline (offline phase 3). */
		songId?: number;
		sample?: SampleSong | null;
		/** A group's song only its editors see yet. */
		draft?: boolean;
		/** A class song not opened since it was shared. */
		isNew?: boolean;
		/** Stands for its twins (board C7): the "Twins" chip. */
		twinned?: boolean;
		/** Has clones (copies in your app or a group's): the "Clone" chip. */
		cloned?: boolean;
		/** The song open beside the list (desktop): tinted, and the link says so. */
		current?: boolean;
		/** A tap on the link, before it goes (My class records the song as opened). */
		onopen?: () => void;
		trailing?: Snippet;
	} = $props();

	// Every word the search matched, marked as in every picker.
	const segs = $derived(segments(name, query));
	const sampled = $derived(sample !== null && sampling.id === sample.id);
	/** `aria-current` on the link of the song open beside the list. */
	const lit = $derived(current ? ('page' as const) : undefined);
</script>

<li
	class="flex min-h-16 items-center gap-1 pl-4 {sample ? 'pr-1' : 'pr-3.5'}"
	class:bg-accent-soft={current}
>
	<a
		{href}
		aria-current={lit}
		onclick={onopen}
		class="flex min-w-0 flex-1 flex-col gap-0.5 py-[9px]"
	>
		<span class="flex min-w-0 items-center gap-2">
			<span class="truncate text-[16px] leading-[1.3] font-bold text-ink"
				>{#each segs as seg, i (i)}{#if seg.hit}<mark
							class="rounded bg-accent-soft px-px font-extrabold text-accent-text">{seg.text}</mark
						>{:else}{seg.text}{/if}{/each}</span
			>
			{#if draft}<Badge tone="warn">{t().songs.row.draft}</Badge>{/if}
			{#if songId !== undefined}<WaitingBadge table="songs" id={songId} />{/if}
			{#if isNew}<Badge tone="accent">{t().songs.row.isNew}</Badge>{/if}
			<!-- The twin icon is the kit's `link`: the kit has none of its own. -->
			{#if twinned}<Badge><Icon name="link" size={14} />{twinsChip()}</Badge>{/if}
			{#if cloned}<Badge><Icon name="copy" size={14} />{cloneChip()}</Badge>{/if}
		</span>
		{#if sampled && sample}
			<span class="truncate text-[13px] leading-[1.35] font-bold text-accent-text"
				>{t().songs.sample.from(clock(sample.startS))}</span
			>
		{:else}
			<span
				class="truncate text-[13px] leading-[1.35] {tone === 'danger'
					? 'font-bold text-danger'
					: 'text-muted'}">{meta}</span
			>
		{/if}
	</a>
	{#if sample}
		<SampleButton song={sample} {name} tinted={current} />
	{:else}
		{#if trailing}{@render trailing()}{/if}
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	{/if}
</li>
