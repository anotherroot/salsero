<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import LessonFields from '$lib/components/lessons/LessonFields.svelte';
	import { DEFAULT_EVERY_DAYS, FREQUENCIES } from '$lib/frequency';
	import { byteSize, dateLabel } from '$lib/format';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creating = $state(false);
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form?.message) creating = true;
	});
	let busy = $state(false);

	const label = 'mb-1 block text-[13px] text-muted';
	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
</script>

<svelte:head><title>Lessons · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 pb-3 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
>
	<div class="flex items-center justify-between">
		<h1 class="text-[17px] font-semibold">Lessons</h1>
		<button
			type="button"
			class="h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
			onclick={() => (creating = true)}>+ New</button
		>
	</div>
	{#if data.storageBytes > 0}
		<p class="mt-2 text-[12px] text-muted">
			Videos on disk: {byteSize(data.storageBytes)}
		</p>
	{/if}
</header>

<div class="px-4 py-4">
	{#if data.lessons.length === 0}
		<p class="mt-10 text-center text-[15px] text-muted">
			No lessons yet. Add one after your next class — the videos, the notes, and something on Today
			to make you go back over it.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each data.lessons as lesson (lesson.id)}
				<li class="overflow-hidden rounded-xl border border-line bg-raised">
					<a href={resolve('/lessons/[id]', { id: String(lesson.id) })} class="block px-4 py-3">
						<span class="block truncate text-[15px] font-medium">{lesson.title}</span>
						<span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
							<span>{dateLabel(lesson.lessonDay)}</span>
							{#if lesson.videos > 0}
								<span aria-hidden="true">·</span>
								<span
									>{lesson.videos}
									{lesson.videos === 1 ? 'video' : 'videos'} · {byteSize(lesson.videoBytes)}</span
								>
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<Sheet title="New lesson" open={creating} onclose={() => (creating = false)}>
	<form
		method="POST"
		action="?/create"
		class="space-y-3"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		{#if form?.message}
			<p class="bg-danger-bg rounded-lg px-3 py-2 text-[13px] text-danger">{form.message}</p>
		{/if}

		<LessonFields
			lessonDay={form?.lessonDay ?? data.today}
			title={form?.title ?? ''}
			notes={form?.notes ?? null}
			max={data.today}
		/>

		<label class="block">
			<span class={label}>Go over it again</span>
			<select name="everyDays" class={field} value={DEFAULT_EVERY_DAYS}>
				{#each FREQUENCIES as f (f.days)}
					<option value={f.days}>{f.label}</option>
				{/each}
			</select>
		</label>

		<button
			type="submit"
			disabled={busy}
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50"
			>Create lesson</button
		>
	</form>
</Sheet>
