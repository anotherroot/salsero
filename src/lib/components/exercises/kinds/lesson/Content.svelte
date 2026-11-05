<!-- src/lib/components/exercises/kinds/lesson/Content.svelte -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { CLIP } from '$lib/components/ui/styles';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import { longDayLabel } from '$lib/format';
	import type { MediaProblem } from '$lib/media';
	import { lessonVideoCaption } from '$lib/video/caption';
	import { PROSE, SECTION_HEAD } from '../prose';
	import type { ContentProps } from '../index';

	let { dance, content, onPage, canEdit = true, simple = false }: ContentProps = $props();
	let broken = $state<Record<number, MediaProblem>>({});
</script>

{#if content.type === 'lesson'}
	<div class="flex flex-col gap-3">
		{#if !onPage}
			<a
				class="flex items-center gap-3 rounded-2xl bg-surface py-2.5 pr-3.5 pl-3"
				href={resolve('/[dance]/lessons/[id]', {
					dance: dance.slug,
					id: String(content.lesson.id)
				})}
			>
				<span
					class="grid size-10 flex-none place-items-center rounded-xl bg-accent-soft text-accent-text"
					aria-hidden="true"><Icon name="lessons" size={20} /></span
				>
				<span class="flex min-w-0 flex-1 flex-col gap-px">
					<span class="truncate text-[16px] font-bold">{content.lesson.title}</span>
					<span class="truncate text-[13px] text-muted"
						>{longDayLabel(content.lesson.lessonDay)} · {content.videos.length}
						{content.videos.length === 1 ? 'video' : 'videos'}</span
					>
				</span>
				<span class="flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</a>
		{/if}
		{#if content.lesson.notes}
			<LinkedText text={content.lesson.notes} class={PROSE} />
		{/if}
		{#if content.figures.length > 0}
			{#if onPage}<h2 class={SECTION_HEAD}>Figures</h2>{:else}<h3 class={SECTION_HEAD}>
					Figures
				</h3>{/if}
			<ul class="-mt-1.5 flex flex-wrap gap-2">
				{#each content.figures as f (f.id)}
					<li>
						<a
							href={resolve('/[dance]/(moves)/figures/[id]', {
								dance: dance.slug,
								id: String(f.id)
							})}
							class="inline-flex h-9 items-center gap-1 rounded-full bg-chip px-3.5 text-[14px] font-semibold text-chip-ink"
							>{f.name}<span class="text-muted"><Icon name="chevron-right" size={16} /></span></a
						>
					</li>
				{/each}
			</ul>
		{/if}
		<LinkList links={content.links} />
		{#each content.videos as video, i (video.id)}
			<div class="{CLIP} rounded-2xl bg-surface">
				{#if broken[video.id]}
					<p class="p-4 text-[13px] text-muted">
						{broken[video.id] === 'missing'
							? 'The file for this video is missing.'
							: "This browser can't play this file."}
					</p>
				{:else}
					<VideoFrame
						src="/lesson-videos/{video.file}"
						{canEdit}
						{simple}
						sourceUrl={video.sourceUrl}
						owner={{ lessonVideoId: video.id }}
						caption={lessonVideoCaption(i, video)}
						onproblem={(p) => (broken = { ...broken, [video.id]: p })}
					/>
				{/if}
			</div>
		{/each}
	</div>
{/if}
