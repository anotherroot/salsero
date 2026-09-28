<!-- src/lib/components/exercises/kinds/figure/Content.svelte -->
<script lang="ts">
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import type { MediaProblem } from '$lib/media';
	import type { ContentProps } from '../index';

	let { content }: ContentProps = $props();
	let broken = $state<Record<number, MediaProblem>>({});
</script>

{#if content.type === 'figure'}
	<div class="space-y-3">
		{#if content.figure.notes}
			<LinkedText text={content.figure.notes} class="text-[15px] whitespace-pre-line" />
		{/if}
		{#each content.recordings as rec (rec.id)}
			<div class="overflow-hidden rounded-xl border border-line bg-raised pb-2">
				{#if broken[rec.id]}
					<p class="p-4 text-[13px] text-muted">
						{broken[rec.id] === 'missing'
							? 'The file for this recording is missing.'
							: "This browser can't play this file."}
					</p>
				{:else}
					<VideoFrame
						src="/recordings/{rec.file}"
						kind={rec.kind}
						onproblem={(p) => (broken = { ...broken, [rec.id]: p })}
					/>
				{/if}
			</div>
		{/each}
		<LinkList links={content.links} />
		{#if !content.figure.notes && content.recordings.length === 0 && content.links.length === 0}
			<p class="text-[13px] text-muted">
				No notes, recordings or links yet — add them on the figure page.
			</p>
		{/if}
	</div>
{/if}
