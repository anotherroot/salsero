<script lang="ts">
	import { uploadLink } from '$lib/app-mode';
	import { dateLabel } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Add to a lesson · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 pb-3 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
>
	<h1 class="text-[17px] font-semibold">Add to a lesson</h1>
	<p class="text-[13px] text-muted">The video is compressed and uploaded in the background.</p>
</header>

<main class="space-y-6 px-4 py-4">
	{#each data.dances as dance (dance.slug)}
		<section>
			<h2 class="mb-2 text-[13px] font-medium text-muted">{dance.label}</h2>
			{#if dance.lessons.length === 0}
				<p class="text-[13px] text-muted">No lessons yet.</p>
			{:else}
				<ul class="space-y-2">
					{#each dance.lessons as lesson (lesson.id)}
						<li class="overflow-hidden rounded-xl border border-line bg-raised">
							<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- an app link, not a route -->
							<a href={uploadLink({ lesson: lesson.id }, data.key)} class="block px-4 py-3">
								<span class="block truncate text-[15px] font-medium">{lesson.title}</span>
								<span class="mt-0.5 block text-[12px] text-muted"
									>{dateLabel(lesson.lessonDay)}</span
								>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/each}
</main>
