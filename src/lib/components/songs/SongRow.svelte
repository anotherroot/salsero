<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { SampleSong } from '$lib/types';
	import { clock } from '$lib/format';
	import { segments } from '$lib/picker/model';
	import { sampling } from '$lib/songs/sample-player.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { TWINS_CHIP } from '$lib/clones/twins';
	import Badge from '$lib/components/ui/Badge.svelte';
	import SampleButton from './SampleButton.svelte';

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
		isNew = false,
		twinned = false,
		trailing
	}: {
		href: string;
		name: string;
		query?: string;
		meta: string;
		tone?: 'danger' | null;
		sample?: SampleSong | null;
		/** A group's song only its editors see yet. */
		draft?: boolean;
		/** A class song not opened since it was shared. */
		isNew?: boolean;
		/** Stands for its twins (board C7): the "Twins" chip. */
		twinned?: boolean;
		trailing?: Snippet;
	} = $props();

	// Every word the search matched, marked as in every picker.
	const segs = $derived(segments(name, query));
	const sampled = $derived(sample !== null && sampling.id === sample.id);
</script>

<li class="flex min-h-16 items-center gap-1 pl-4 {sample ? 'pr-1' : 'pr-3.5'}">
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a resolved href -->
	<a {href} class="flex min-w-0 flex-1 flex-col gap-0.5 py-[9px]">
		<span class="flex min-w-0 items-center gap-2">
			<span class="truncate text-[16px] leading-[1.3] font-bold text-ink"
				>{#each segs as seg, i (i)}{#if seg.hit}<mark
							class="rounded bg-accent-soft px-px font-extrabold text-accent-text">{seg.text}</mark
						>{:else}{seg.text}{/if}{/each}</span
			>
			{#if draft}<Badge tone="warn">Draft</Badge>{/if}
			{#if isNew}<Badge tone="accent">New</Badge>{/if}
			<!-- The twin icon is the kit's `link`: the kit has none of its own. -->
			{#if twinned}<Badge><Icon name="link" size={14} />{TWINS_CHIP}</Badge>{/if}
		</span>
		{#if sampled && sample}
			<span class="truncate text-[13px] leading-[1.35] font-bold text-accent-text"
				>Sample from {clock(sample.startS)}</span
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
		<SampleButton song={sample} {name} />
	{:else}
		{#if trailing}{@render trailing()}{/if}
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	{/if}
</li>
