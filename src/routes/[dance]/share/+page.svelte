<script lang="ts">
	import { onMount } from 'svelte';
	import { uploadLink } from '$lib/app-mode';
	import { dateLabel } from '$lib/format';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import LeadTile from '$lib/components/system/LeadTile.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import NewLessonSheet from '$lib/components/lessons/NewLessonSheet.svelte';
	import type { ActionResult } from '@sveltejs/kit';
	import { GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import type { LessonItem } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// New lesson (spec A4): made here, then the key goes to the app with it,
	// as a tapped row's does. The `form` there when it opened: an older refusal
	// is not this opening's.
	let creating = $state(false);
	let creatingSeen: unknown = $state(null);
	const refusal = $derived(
		form !== creatingSeen && form && 'message' in form
			? (form as unknown as Record<string, string>)
			: null
	);
	function openNew() {
		creatingSeen = form;
		creating = true;
	}
	async function made(result: ActionResult, update: () => Promise<void>) {
		if (result.type === 'success' && result.data && 'lessonId' in result.data) {
			const id = Number(result.data.lessonId);
			creating = false;
			tap(id);
			location.href = uploadLink(
				{ lesson: id },
				{
					back: `/${data.dance.slug}/lessons/${id}`,
					name: String(result.data.title ?? ''),
					share: data.key
				}
			);
			return;
		}
		await update();
	}

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

<Screen width="narrow" title="Add to a lesson" subtitle="Compressed and uploaded in the background">
	{#if data.lessons.length > 0}<h2 class={SECTION_LABEL}>Recent lessons</h2>{/if}
	{@render list('Lessons', data.lessons, true)}
	{#if data.groups.length > 0}
		{#each data.groups as group (group.id)}
			<h2 class="{SECTION_LABEL} pt-2">{group.name}</h2>
			{@render list(group.name, group.lessons)}
		{/each}
	{/if}
</Screen>

{#snippet list(
	label: string,
	lessons: (LessonItem & { publishedAt?: number | null })[],
	newRow = false
)}
	<ul class={GROUP} aria-label={label}>
		{#if newRow}
			<li>
				<button
					type="button"
					aria-haspopup="dialog"
					onclick={openNew}
					class="flex min-h-16 w-full cursor-pointer items-center gap-3 pr-3.5 pl-4 text-left active:bg-step"
				>
					<span
						class="grid size-10 flex-none place-items-center rounded-xl bg-accent text-on-accent"
						><Icon name="plus" size={22} /></span
					>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-[16px] font-bold text-accent-text">New lesson</span>
						<span class="text-[13px] text-muted">Make one for this video</span>
					</span>
					<span class="flex text-chevron" aria-hidden="true"
						><Icon name="chevron-right" size={20} /></span
					>
				</button>
			</li>
		{/if}
		{#each lessons as lesson (lesson.id)}
			<li>
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
						<span class="flex min-w-0 items-center gap-2">
							<span class="truncate text-[16px] font-bold text-ink">{lesson.title}</span>
							{#if lesson.publishedAt === null}<Badge tone="warn">Draft</Badge>{/if}
						</span>
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
			</li>
		{/each}
	</ul>
{/snippet}

<NewLessonSheet
	open={creating}
	onclose={() => (creating = false)}
	action="?/create"
	{refusal}
	today={data.today}
	places={data.places}
	submit="Make it and add the video"
	handle={made}
/>
