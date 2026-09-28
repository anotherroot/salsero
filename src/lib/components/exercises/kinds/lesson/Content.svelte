<!-- src/lib/components/exercises/kinds/lesson/Content.svelte -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import { dateLabel } from '$lib/format';
	import type { MediaProblem } from '$lib/media';
	import type { ContentProps } from '../index';

	let { dance, content }: ContentProps = $props();
	let broken = $state<Record<number, MediaProblem>>({});
</script>

{#if content.type === 'lesson'}
	<div class="space-y-3">
		<p class="text-[13px] text-muted">
			<a
				class="text-accent"
				href={resolve('/[dance]/lessons/[id]', {
					dance: dance.slug,
					id: String(content.lesson.id)
				})}>{content.lesson.title}</a
			>
			· {dateLabel(content.lesson.lessonDay)}
		</p>
		{#if content.lesson.notes}
			<LinkedText text={content.lesson.notes} class="text-[15px] whitespace-pre-line" />
		{/if}
		<LinkList links={content.links} />
		{#each content.videos as video (video.id)}
			<div class="overflow-hidden rounded-xl border border-line bg-raised pb-2">
				{#if broken[video.id]}
					<p class="p-4 text-[13px] text-muted">
						{broken[video.id] === 'missing'
							? 'The file for this video is missing.'
							: "This browser can't play this file."}
					</p>
				{:else}
					<VideoFrame
						src="/lesson-videos/{video.file}"
						onproblem={(p) => (broken = { ...broken, [video.id]: p })}
					/>
				{/if}
			</div>
		{/each}
		{#if content.figures.length > 0}
			<ul class="flex flex-wrap gap-2">
				{#each content.figures as f (f.id)}
					<li>
						<a
							href={resolve('/[dance]/figures/[id]', { dance: dance.slug, id: String(f.id) })}
							class="inline-block rounded-full border border-rule px-3 py-1.5 text-[13px]"
							>{f.name}</a
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
