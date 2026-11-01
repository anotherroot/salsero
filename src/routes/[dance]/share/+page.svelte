<script lang="ts">
	import { onMount } from 'svelte';
	import { uploadLink } from '$lib/app-mode';
	import { dateLabel } from '$lib/format';
	import Screen from '$lib/components/ui/Screen.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import LeadTile from '$lib/components/system/LeadTile.svelte';
	import { GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// The row whose app link was tapped: it spins until the app takes over
	// (the page hides) or, if it never does, until we come back or 10 s pass.
	let tapped = $state<number | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	function tap(id: number) {
		tapped = id;
		clearTimeout(timer);
		timer = setTimeout(() => (tapped = null), 10_000);
	}
	onMount(() => {
		const back = () => {
			if (document.visibilityState === 'visible') {
				tapped = null;
				clearTimeout(timer);
			}
		};
		document.addEventListener('visibilitychange', back);
		return () => {
			document.removeEventListener('visibilitychange', back);
			clearTimeout(timer);
		};
	});
</script>

<svelte:head><title>Add to a lesson</title></svelte:head>

<Screen title="Add to a lesson" subtitle="Compressed and uploaded in the background">
	{#if data.lessons.length === 0}
		<EmptyState
			icon="lessons"
			title="No lessons yet"
			body="Make one in Lessons first, then share the video again."
		/>
	{:else}
		<h2 class={SECTION_LABEL}>Recent lessons</h2>
		<ul class={GROUP} aria-label="Lessons">
			{#each data.lessons as lesson (lesson.id)}
				<li>
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
						onclick={() => tap(lesson.id)}
						class="flex min-h-16 items-center gap-3 pr-3.5 pl-4 {tapped === lesson.id
							? 'bg-ink/[0.06]'
							: ''}"
					>
						<LeadTile icon="lessons" />
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="truncate text-[16px] font-bold text-ink">{lesson.title}</span>
							<span class="text-[13px] text-muted">{dateLabel(lesson.lessonDay)}</span>
						</span>
						{#if tapped === lesson.id}
							<span class="flex text-muted"><Spinner size={22} label="Opening the app" /></span>
						{:else}
							<span class="flex text-chevron" aria-hidden="true"
								><Icon name="chevron-right" size={20} /></span
							>
						{/if}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	{/if}
</Screen>
