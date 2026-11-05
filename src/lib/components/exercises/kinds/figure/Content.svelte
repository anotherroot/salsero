<!-- src/lib/components/exercises/kinds/figure/Content.svelte -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { CLIP } from '$lib/components/ui/styles';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { recordingCaption } from '$lib/video/caption';
	import type { MediaProblem } from '$lib/media';
	import { PROSE, SECTION_HEAD } from '../prose';
	import type { ContentProps } from '../index';

	let { dance, content, timezone, onPage = false, canEdit = true }: ContentProps = $props();
	let broken = $state<Record<number, MediaProblem>>({});
</script>

{#if content.type === 'figure'}
	<div class="flex flex-col gap-3">
		{#if onPage}<h2 class={SECTION_HEAD}>Reference</h2>{/if}
		{#if content.figure.notes}
			<LinkedText text={content.figure.notes} class={PROSE} />
		{/if}
		{#each content.recordings as rec (rec.id)}
			<div class="{CLIP} rounded-2xl bg-surface">
				{#if broken[rec.id]}
					<p class="p-4 text-[13px] text-muted">
						{broken[rec.id] === 'missing'
							? 'The file for this recording is missing.'
							: "This browser can't play this file."}
					</p>
				{:else}
					<VideoFrame
						src="/recordings/{rec.file}"
						{canEdit}
						linking={canEdit}
						onclosed={() => void refreshWhenSettled()}
						sourceUrl={rec.sourceUrl}
						kind={rec.kind}
						owner={{ recordingId: rec.id }}
						caption={recordingCaption(rec, timezone)}
						onproblem={(p) => (broken = { ...broken, [rec.id]: p })}
					/>
				{/if}
			</div>
		{/each}
		{#each content.sections as s (s.linkId)}
			<SectionCard section={s} {canEdit} />
		{/each}
		<LinkList links={content.links} />
		{#if !content.figure.notes && content.recordings.length === 0 && content.sections.length === 0 && content.links.length === 0}
			<p class="px-1 text-[13px] text-muted">
				No notes, recordings, sections or links yet — add them on the figure page.
			</p>
		{/if}
		{#if onPage}
			<a
				href={resolve('/[dance]/(moves)/figures/[id]', {
					dance: dance.slug,
					id: String(content.figure.id)
				})}
				class="flex h-11 items-center gap-0.5 self-start px-1 text-[14px] font-extrabold text-accent-text"
				>Edit links on the figure page<Icon name="chevron-right" size={18} /></a
			>
		{/if}
	</div>
{/if}
