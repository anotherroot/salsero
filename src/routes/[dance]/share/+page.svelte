<script lang="ts">
	import { uploadLink } from '$lib/app-mode';
	import { dateLabel } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Add to a lesson · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 pb-3 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
>
	<h1 class="text-[17px] font-semibold">Add to a {data.dance.label.toLowerCase()} lesson</h1>
	<p class="text-[13px] text-muted">The video is compressed and uploaded in the background.</p>
</header>

<main class="px-4 py-4">
	{#if data.lessons.length === 0}
		<p class="text-[13px] text-muted">No lessons yet.</p>
	{:else}
		<ul class="space-y-2">
			{#each data.lessons as lesson (lesson.id)}
				<li class="overflow-hidden rounded-xl border border-line bg-raised">
					<!-- eslint-disable svelte/no-navigation-without-resolve -- an app link, not a route -->
					<a
						href={uploadLink(
							{ lesson: lesson.id },
							{
								back: `/${data.dance.slug}/lessons/${lesson.id}`,
								name: lesson.title,
								share: data.key
							}
						)}
						class="block px-4 py-3"
					>
						<span class="block truncate text-[15px] font-medium">{lesson.title}</span>
						<span class="mt-0.5 block text-[12px] text-muted">{dateLabel(lesson.lessonDay)}</span>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	{/if}
</main>
