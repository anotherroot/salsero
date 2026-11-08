<!-- src/lib/components/exercises/kinds/lesson/Content.svelte -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { CLIP } from '$lib/components/ui/styles';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import type { MediaProblem } from '$lib/media';
	import { lessonVideoCaption } from '$lib/video/caption';
	import { t } from '$lib/i18n/catalog';
	import { PROSE, SECTION_HEAD } from '../prose';
	import type { ContentProps } from '../index';

	let { dance, content, canEdit = true, simple = false }: ContentProps = $props();
	let broken = $state<Record<number, MediaProblem>>({});
</script>

{#if content.type === 'lesson'}
	<div class="flex flex-col gap-3">
		{#if content.lesson.notes}
			<LinkedText text={content.lesson.notes} class={PROSE} />
		{/if}
		{#if content.figures.length > 0}
			<h2 class={SECTION_HEAD}>{t().exercise.content.figures}</h2>
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
							? t().exercise.content.videoMissing
							: t().exercise.content.cantPlay}
					</p>
				{:else}
					<VideoFrame
						src="/lesson-videos/{video.file}"
						{canEdit}
						linking={canEdit && !simple}
						onclosed={() => void refreshWhenSettled()}
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
