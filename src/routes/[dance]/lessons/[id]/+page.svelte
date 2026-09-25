<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import LessonFields from '$lib/components/lessons/LessonFields.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import LinkPicker from '$lib/components/lessons/LinkPicker.svelte';
	import ChunkedUploadButton from '$lib/components/ui/ChunkedUploadButton.svelte';
	import { DEFAULT_EVERY_DAYS, FREQUENCIES, frequencyLabel } from '$lib/frequency';
	import { byteSize, dateLabel } from '$lib/format';
	import { PARTNER_LABEL } from '$lib/labels';
	import { MAX_LESSON_VIDEO_BYTES } from '$lib/limits';
	import { watchMedia, type MediaProblem } from '$lib/media';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	let addingFigure = $state(false);
	let addingExercise = $state(false);
	let broken = $state<Record<number, MediaProblem>>({});

	const lesson = $derived(data.lesson);
	const failure = (action: string) => (form?.action === action ? form.message : null);

	$effect(() => {
		if (failure('newFigure')) addingFigure = true;
		if (failure('newExercise')) addingExercise = true;
		if (failure('update')) editing = true;
	});

	const label = 'mb-1 block text-[13px] text-muted';
	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const heading = 'mb-2 text-[12px] font-medium tracking-wide text-muted uppercase';
</script>

<svelte:head><title>{lesson.title} · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 pb-3 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
>
	<div class="flex items-center gap-2">
		<a
			href={resolve('/[dance]/lessons', { dance: data.dance.slug })}
			class="-ml-1 px-1 text-[20px] text-muted"
			aria-label="Back">‹</a
		>
		<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{lesson.title}</h1>
		<button
			type="button"
			class="h-10 px-2 text-[14px] font-medium text-accent"
			onclick={() => (editing = !editing)}>{editing ? 'Done' : 'Edit'}</button
		>
	</div>
</header>

<div class="space-y-6 px-4 py-4">
	{#if editing}
		<form method="POST" action="?/update" class="space-y-3" use:enhance>
			{#if failure('update')}
				<p class="bg-danger-bg rounded-lg px-3 py-2 text-[13px] text-danger">
					{failure('update')}
				</p>
			{/if}
			<LessonFields
				lessonDay={lesson.lessonDay}
				title={lesson.title}
				notes={lesson.notes}
				max={data.today}
			/>
			<button
				type="submit"
				class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
				>Save</button
			>
		</form>

		<form
			method="POST"
			action="?/archive"
			use:enhance
			onsubmit={(e) => {
				if (!confirm('Archive this lesson? Its review exercise goes too.')) e.preventDefault();
			}}
		>
			<button type="submit" class="h-10 text-[14px] text-danger">Archive lesson</button>
		</form>
	{:else}
		<section>
			<p class="text-[13px] text-muted">{dateLabel(lesson.lessonDay)}</p>
			{#if lesson.notes}
				<p class="mt-2 text-[15px] whitespace-pre-line">{lesson.notes}</p>
			{/if}
		</section>

		{#if data.exercise}
			<section class="rounded-xl border border-line bg-raised px-4 py-3">
				<div class="flex items-center justify-between gap-3">
					<div class="min-w-0">
						<span class="block truncate text-[15px] font-medium">Go over this lesson</span>
						<span class="text-[12px] text-muted"
							>{frequencyLabel(data.exercise.everyDays)}{data.exercise.active
								? ''
								: ' · inactive'}</span
						>
					</div>
					<form method="POST" action="?/log" use:enhance>
						<input type="hidden" name="exerciseId" value={data.exercise.id} />
						<button
							type="submit"
							class="h-10 rounded-xl border border-rule px-4 text-[14px] font-medium"
							>Log set</button
						>
					</form>
				</div>
			</section>
		{/if}

		<section>
			<h2 class={heading}>Videos</h2>
			<ul class="space-y-3">
				{#each data.videos as video (video.id)}
					<li class="overflow-hidden rounded-xl border border-line bg-raised">
						{#if broken[video.id] === 'missing'}
							<p class="p-4 text-[13px] text-muted">The file for this video is missing.</p>
						{:else if broken[video.id] === 'unplayable'}
							<p class="p-4 text-[13px] text-muted">
								This browser can't play this file.
								<a
									href={resolve('/lesson-videos/[file]', { file: video.file })}
									download
									class="font-medium text-accent">Download it</a
								>
								or open it on your phone.
							</p>
						{:else}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								src="/lesson-videos/{video.file}"
								controls
								playsinline
								preload="metadata"
								class="aspect-video w-full bg-black"
								{@attach watchMedia(
									`/lesson-videos/${video.file}`,
									(p) => (broken = { ...broken, [video.id]: p })
								)}
							></video>
						{/if}
						<div class="flex items-center justify-between px-3 py-2 text-[12px] text-muted">
							<span>{byteSize(video.sizeBytes)}</span>
							<form
								method="POST"
								action="?/deleteVideo"
								use:enhance
								onsubmit={(e) => {
									if (!confirm('Delete this video?')) e.preventDefault();
								}}
							>
								<input type="hidden" name="videoId" value={video.id} />
								<button type="submit" class="h-9 px-2 text-danger">Delete</button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
			<div class="mt-3">
				<ChunkedUploadButton
					uploadUrl="/api/lessons/{lesson.id}/videos"
					accept="video/*"
					label="+ Add videos"
					maxBytes={MAX_LESSON_VIDEO_BYTES}
				/>
			</div>
		</section>

		<section>
			<div class="flex items-center justify-between">
				<h2 class={heading}>Figures</h2>
				<button
					type="button"
					class="mb-2 text-[13px] font-medium text-accent"
					onclick={() => (addingFigure = true)}>+ New figure</button
				>
			</div>
			{#if data.figures.length > 0}
				<ul class="space-y-2">
					{#each data.figures as figure (figure.id)}
						<li class="flex items-center gap-2 rounded-xl border border-line bg-raised px-4 py-3">
							<a
								href={resolve('/[dance]/figures/[id]', {
									dance: data.dance.slug,
									id: String(figure.id)
								})}
								class="min-w-0 flex-1"
							>
								<span class="block truncate text-[15px] font-medium">{figure.name}</span>
								<span class="text-[12px] text-muted">{PARTNER_LABEL[figure.partner]}</span>
							</a>
							<form method="POST" action="?/unlinkFigure" use:enhance>
								<input type="hidden" name="figureId" value={figure.id} />
								<button type="submit" class="h-9 px-2 text-[13px] text-muted">Unlink</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<LinkPicker
				action="?/linkFigure"
				name="figureId"
				items={data.linkableFigures}
				label="Link an existing figure"
				empty="Every figure is already linked."
			/>
			{#if failure('linkFigure')}
				<p class="mt-2 text-[13px] text-danger">{failure('linkFigure')}</p>
			{/if}
		</section>

		<section>
			<div class="flex items-center justify-between">
				<h2 class={heading}>Exercises</h2>
				<button
					type="button"
					class="mb-2 text-[13px] font-medium text-accent"
					onclick={() => (addingExercise = true)}>+ New exercise</button
				>
			</div>
			{#if data.exercises.length > 0}
				<ul class="space-y-2">
					{#each data.exercises as exercise (exercise.id)}
						<li class="flex items-center gap-2 rounded-xl border border-line bg-raised px-4 py-3">
							<span class="min-w-0 flex-1 truncate text-[15px]">{exercise.name}</span>
							<form method="POST" action="?/unlinkExercise" use:enhance>
								<input type="hidden" name="exerciseId" value={exercise.id} />
								<button type="submit" class="h-9 px-2 text-[13px] text-muted">Unlink</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<LinkPicker
				action="?/linkExercise"
				name="exerciseId"
				items={data.linkableExercises}
				label="Link an existing exercise"
				empty="Nothing left to link. A figure’s exercise lives under its figure."
			/>
			{#if failure('linkExercise')}
				<p class="mt-2 text-[13px] text-danger">{failure('linkExercise')}</p>
			{/if}
		</section>
	{/if}
</div>

<Sheet
	title="New figure from this lesson"
	open={addingFigure}
	onclose={() => (addingFigure = false)}
>
	<form
		method="POST"
		action="?/newFigure"
		class="space-y-3"
		use:enhance={() =>
			async ({ update, result }) => {
				await update();
				if (result.type === 'success') addingFigure = false;
			}}
	>
		{#if failure('newFigure')}
			<p class="bg-danger-bg rounded-lg px-3 py-2 text-[13px] text-danger">
				{failure('newFigure')}
			</p>
		{/if}
		<FigureFields dance={data.dance} />
		<label class="block">
			<span class={label}>How often</span>
			<select name="everyDays" class={field} value={DEFAULT_EVERY_DAYS}>
				{#each FREQUENCIES as f (f.days)}
					<option value={f.days}>{f.label}</option>
				{/each}
			</select>
		</label>
		<button
			type="submit"
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
			>Add figure</button
		>
	</form>
</Sheet>

<Sheet
	title="New exercise from this lesson"
	open={addingExercise}
	onclose={() => (addingExercise = false)}
>
	<form
		method="POST"
		action="?/newExercise"
		class="space-y-3"
		use:enhance={() =>
			async ({ update, result }) => {
				await update();
				if (result.type === 'success') addingExercise = false;
			}}
	>
		{#if failure('newExercise')}
			<p class="bg-danger-bg rounded-lg px-3 py-2 text-[13px] text-danger">
				{failure('newExercise')}
			</p>
		{/if}
		<label class="block">
			<span class={label}>Name</span>
			<input name="name" required maxlength="200" class={field} />
		</label>
		<label class="block">
			<span class={label}>How often</span>
			<select name="everyDays" class={field} value={DEFAULT_EVERY_DAYS}>
				{#each FREQUENCIES as f (f.days)}
					<option value={f.days}>{f.label}</option>
				{/each}
			</select>
		</label>
		<label class="block">
			<span class={label}>Notes</span>
			<textarea name="notes" rows="2" maxlength="2000" class={field}></textarea>
		</label>
		<button
			type="submit"
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
			>Add exercise</button
		>
	</form>
</Sheet>
