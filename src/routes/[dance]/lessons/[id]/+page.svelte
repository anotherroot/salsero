<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import LessonFields from '$lib/components/lessons/LessonFields.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import LinkPicker from '$lib/components/lessons/LinkPicker.svelte';
	import ChunkedUploadButton from '$lib/components/ui/ChunkedUploadButton.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import { logFor } from '$lib/components/exercises/kinds';
	import { DEFAULT_EVERY_DAYS, FREQUENCIES, frequencyLabel } from '$lib/frequency';
	import { byteSize, dateLabel } from '$lib/format';
	import { PARTNER_LABEL } from '$lib/labels';
	import { MAX_LESSON_VIDEO_BYTES } from '$lib/limits';
	import type { MediaProblem } from '$lib/media';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	let addingFigure = $state(false);
	let addingExercise = $state(false);
	let addingRoutine = $state(false);
	let logging = $state(false);
	let broken = $state<Record<number, MediaProblem>>({});

	const lesson = $derived(data.lesson);
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const LessonLog = logFor('lesson');
	const failure = (action: string) => (form?.action === action ? form.message : null);

	$effect(() => {
		if (failure('newFigure')) addingFigure = true;
		if (failure('newExercise')) addingExercise = true;
		if (failure('newRoutine')) addingRoutine = true;
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
		<!--
			Done SAVES: it submits the edit form (by `form=`, since the header is
			outside it). A refused save keeps you editing with the message showing,
			so nothing typed is lost; a successful one closes edit mode.
		-->
		{#if editing}
			<button type="submit" form="edit-form" class="h-10 px-2 text-[14px] font-medium text-accent"
				>Done</button
			>
		{:else}
			<button
				type="button"
				class="h-10 px-2 text-[14px] font-medium text-accent"
				onclick={() => (editing = true)}>Edit</button
			>
		{/if}
	</div>
</header>

<div class="space-y-6 px-4 py-4">
	{#if editing}
		<form
			id="edit-form"
			method="POST"
			action="?/update"
			class="space-y-3"
			use:guarded={{
				label: 'Lesson edits',
				submit:
					() =>
					async ({ update, result }) => {
						await update({ reset: false });
						if (result.type === 'success') editing = false;
					}
			}}
		>
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
				<LinkedText text={lesson.notes} class="mt-2 text-[15px] whitespace-pre-line" />
			{/if}
		</section>

		{#if data.exercise && data.popup}
			<section class="rounded-xl border border-line bg-raised px-4 py-3">
				<div class="flex items-center justify-between gap-3">
					<div class="min-w-0">
						<span class="block truncate text-[15px] font-medium">Go over this lesson</span>
						<a
							href={resolve('/[dance]/exercises/[id]', {
								dance: data.dance.slug,
								id: String(data.exercise.id)
							})}
							class="text-[12px] text-accent"
							>{frequencyLabel(data.exercise.everyDays)}{data.exercise.active ? '' : ' · inactive'} ·
							Exercise →</a
						>
					</div>
					<button
						type="button"
						class="h-10 rounded-xl border border-rule px-4 text-[14px] font-medium"
						onclick={() => (logging = true)}>Log…</button
					>
				</div>
			</section>
		{/if}

		<section>
			<h2 class={heading}>Links</h2>
			<LinksEditor
				links={data.links}
				message={failure('addLink') ?? null}
				entered={form && 'urls' in form ? String(form.urls) : ''}
			/>
		</section>

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
							<VideoFrame
								src="/lesson-videos/{video.file}"
								onproblem={(p) => (broken = { ...broken, [video.id]: p })}
							/>
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
							<a
								href={resolve('/[dance]/exercises/[id]', {
									dance: data.dance.slug,
									id: String(exercise.id)
								})}
								class="min-w-0 flex-1 truncate text-[15px]">{exercise.name}</a
							>
							<a
								href={resolve(`/${data.dance.slug}/exercises/${exercise.id}?log=1`)}
								class="grid size-9 place-items-center text-[20px] text-accent"
								aria-label="Log a set of {exercise.name}">+</a
							>
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
				empty="Nothing left to link. A figure’s or routine’s exercise lives under it."
			/>
			{#if failure('linkExercise')}
				<p class="mt-2 text-[13px] text-danger">{failure('linkExercise')}</p>
			{/if}
		</section>

		<section>
			<div class="flex items-center justify-between">
				<h2 class={heading}>Routines</h2>
				<button
					type="button"
					class="mb-2 text-[13px] font-medium text-accent"
					onclick={() => (addingRoutine = true)}>+ New routine</button
				>
			</div>
			{#if data.routines.length > 0}
				<ul class="space-y-2">
					{#each data.routines as routine (routine.id)}
						<li class="flex items-center gap-2 rounded-xl border border-line bg-raised px-4 py-3">
							<a
								href={resolve('/[dance]/routines/[id]', {
									dance: data.dance.slug,
									id: String(routine.id)
								})}
								class="min-w-0 flex-1 truncate text-[15px] font-medium">{routine.name}</a
							>
							<form method="POST" action="?/unlinkRoutine" use:enhance>
								<input type="hidden" name="routineId" value={routine.id} />
								<button type="submit" class="h-9 px-2 text-[13px] text-muted">Unlink</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
			<LinkPicker
				action="?/linkRoutine"
				name="routineId"
				items={data.linkableRoutines}
				label="Link an existing routine"
				empty="Every routine is already linked."
			/>
			{#if failure('linkRoutine')}
				<p class="mt-2 text-[13px] text-danger">{failure('linkRoutine')}</p>
			{/if}
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
	{/if}
</div>

{#if logging && data.popup}
	<LessonLog
		dance={data.dance}
		exercise={data.popup.exercise}
		sets={data.popup.sets}
		songs={data.popup.songs}
		takes={data.popup.takes}
		backfillDay={null}
		{timezone}
		message={form && 'action' in form && form.action === 'log' && 'message' in form
			? String(form.message)
			: null}
		onclose={() => (logging = false)}
	/>
{/if}

<Sheet
	title="New figure from this lesson"
	open={addingFigure}
	onclose={() => (addingFigure = false)}
>
	<form
		method="POST"
		action="?/newFigure"
		class="space-y-3"
		use:guarded={{
			label: 'New figure',
			submit:
				() =>
				async ({ update, result }) => {
					await update();
					if (result.type === 'success') addingFigure = false;
				}
		}}
	>
		{#if failure('newFigure')}
			<p class="bg-danger-bg rounded-lg px-3 py-2 text-[13px] text-danger">
				{failure('newFigure')}
			</p>
		{/if}
		<FigureFields dance={data.dance} />
		<button
			type="submit"
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
			>Add figure</button
		>
	</form>
</Sheet>

<Sheet
	title="New routine from this lesson"
	open={addingRoutine}
	onclose={() => (addingRoutine = false)}
>
	<!-- A success redirects to the routine's page, where its slots are built. -->
	<form
		method="POST"
		action="?/newRoutine"
		class="space-y-3"
		use:guarded={{ label: 'New routine' }}
	>
		{#if failure('newRoutine')}
			<p class="bg-danger-bg rounded-lg px-3 py-2 text-[13px] text-danger">
				{failure('newRoutine')}
			</p>
		{/if}
		<label class="block">
			<span class={label}>Name</span>
			<input
				name="name"
				required
				maxlength="200"
				class={field}
				value={form && 'name' in form && form.action === 'newRoutine' ? String(form.name) : ''}
			/>
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
			<textarea name="notes" rows="2" maxlength="2000" class={field}
				>{form && 'notes' in form && form.action === 'newRoutine'
					? String(form.notes)
					: ''}</textarea
			>
		</label>
		<button
			type="submit"
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
			>Add routine and build it →</button
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
		use:guarded={{
			label: 'New exercise',
			submit:
				() =>
				async ({ update, result }) => {
					await update();
					if (result.type === 'success') addingExercise = false;
				}
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
