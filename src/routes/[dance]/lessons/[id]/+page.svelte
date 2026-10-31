<script lang="ts">
	import { tick } from 'svelte';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import LessonFields from '$lib/components/lessons/LessonFields.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Picker from '$lib/components/picker/Picker.svelte';
	import PickerField from '$lib/components/picker/PickerField.svelte';
	import { exerciseGroups, figureRows, routineRows, variationEntries } from '$lib/picker/build';
	import type { PickRow } from '$lib/picker/model';
	import VideoSections from '$lib/components/lessons/VideoSections.svelte';
	import UnlinkVia from '$lib/components/lessons/UnlinkVia.svelte';
	import AppUploadLink from '$lib/components/ui/AppUploadLink.svelte';
	import ChunkedUploadButton from '$lib/components/ui/ChunkedUploadButton.svelte';
	import { uploadLink } from '$lib/app-mode';
	import { page } from '$app/state';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, SECTION_LABEL, button, iconButton } from '$lib/components/ui/styles';
	import { logFor } from '$lib/components/exercises/kinds';
	import { DEFAULT_EVERY_DAYS, FREQUENCIES } from '$lib/frequency';
	import { byteSize, fullDateLabel } from '$lib/format';
	import { reviewMeta, sectionHeading } from '$lib/lessons/page';
	import { PARTNER_LABEL } from '$lib/labels';
	import { MAX_LESSON_VIDEO_BYTES } from '$lib/limits';
	import { spotTime } from '$lib/video/spots';
	import type { MediaProblem } from '$lib/media';
	import type { ViaSection } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// --- Edit mode: the band's pencil, the form alone on the page, one Save pinned.
	let editing = $state(false);
	let saving = $state(false);
	let editForm: HTMLFormElement | undefined = $state();
	type LessonField = 'lessonDay' | 'title' | 'notes';
	/**
	 * The last `update` refusal with what was typed, until the next save or the
	 * next time editing starts: a field's message goes under it, any other at
	 * the top of the form.
	 */
	let refusal = $state<{
		field: LessonField | null;
		message: string;
		entered: { lessonDay: string; title: string; notes: string } | null;
	} | null>(null);
	const editErrors = $derived(
		refusal?.field ? { [refusal.field]: refusal.message } : ({} as Record<string, string>)
	);

	/** The band button that was pressed is replaced when edit mode flips: hand focus to its successor. */
	async function setEditing(on: boolean) {
		editing = on;
		await tick();
		// The big header and the slim band each draw the button; the hidden one is inert.
		const key = on ? 'stop-editing' : 'start-editing';
		document
			.querySelectorAll<HTMLElement>(`[data-focus="${key}"]`)
			.forEach((el) => !el.closest('[inert]') && el.focus());
	}
	function startEditing() {
		refusal = null;
		window.scrollTo({ top: 0 });
		void setEditing(true);
	}
	function stopEditing() {
		leaveOrAsk(editForm ?? null, () => void setEditing(false), 'Stop editing');
	}
	const saveEdit: SubmitFunction = () => {
		saving = true;
		refusal = null;
		return async ({ update, result }) => {
			try {
				await update({ reset: false });
			} finally {
				saving = false;
			}
			if (result.type === 'success') await setEditing(false);
		};
	};

	// --- Archive, behind a question.
	let archiving = $state(false);
	let archiveBusy = $state(false);
	let archiveError = $state<string | null>(null);
	const messageOf = (data: unknown, fallback: string) => {
		const m = (data as { message?: unknown } | undefined)?.message;
		return typeof m === 'string' ? m : fallback;
	};

	let addingFigure = $state(false);
	let addingExercise = $state(false);
	let addingRoutine = $state(false);
	let logging = $state(false);
	let broken = $state<Record<number, MediaProblem>>({});
	/** A row there through a section, whose Unlink is asking first. */
	let unlinkingVia = $state<{
		action: string;
		name: string;
		id: number;
		label: string;
		via: ViaSection[];
	} | null>(null);
	const viaTag = (via: ViaSection[]) =>
		via.length === 1 ? 'via section' : `via ${via.length} sections`;
	const viaRanges = (via: ViaSection[]) =>
		via.map((v) => `${spotTime(v.startMs)}–${spotTime(v.endMs)}`).join(', ');

	const lesson = $derived(data.lesson);
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const LessonLog = logFor('lesson');
	const failure = (action: string) => (form?.action === action ? form.message : null);

	/** The "+ New figure" sheet's switch: a figure of its own, or a variation of one. */
	const FIGURE_MODES = [
		['figure', 'New figure'],
		['variation', 'Variation of a figure']
	] as const;
	let figureMode = $state<'figure' | 'variation'>('figure');
	/** The figure "Variation of a figure" adds to: a `figure_groups` id, as its field posts it. */
	let variationOf = $state<number | null>(null);
	// What a refused `newVariation` posted, so the sheet reopens holding it.
	const variationTyped = $derived(form && 'groupId' in form ? form : null);
	/** What a create sheet's name field starts with: the picker's search, or a refused post. */
	let typed = $state({ figureName: '', name: '', notes: '' });

	/** The figures this lesson teaches, by hand or through a section: "Variation of a figure" offers them first. */
	const taughtGroups = $derived.by(() => {
		const linked = new Set(data.figures.map((f) => f.id));
		return new Set(data.linkableFigures.filter((f) => linked.has(f.id)).map((f) => f.groupId));
	});
	const variationGroups = $derived([
		{
			title: 'In this lesson',
			entries: figureRows(data.figureGroups.filter((g) => taughtGroups.has(g.id)))
		},
		{
			title: 'Figures',
			entries: figureRows(data.figureGroups.filter((g) => !taughtGroups.has(g.id)))
		}
	]);

	function openFigureSheet(mode: 'figure' | 'variation' = 'figure', query = '') {
		figureMode = mode;
		variationOf = data.figureGroups.find((g) => taughtGroups.has(g.id))?.id ?? null;
		typed =
			mode === 'figure'
				? { figureName: query, name: '', notes: '' }
				: { figureName: '', name: query, notes: '' };
		addingFigure = true;
	}

	const closeFigureSheet: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update();
			if (result.type === 'success') {
				addingFigure = false;
				closePicker();
			}
		};

	$effect(() => {
		if (failure('newFigure')) {
			figureMode = 'figure';
			addingFigure = true;
		}
		if (variationTyped) {
			figureMode = 'variation';
			variationOf = Number(variationTyped.groupId) || null;
			typed = {
				figureName: '',
				name: variationTyped.name ?? '',
				notes: variationTyped.notes ?? ''
			};
			addingFigure = true;
		}
		if (failure('newExercise')) addingExercise = true;
		if (failure('newRoutine')) addingRoutine = true;
	});

	// A refused edit (and, without JavaScript, the page it re-renders) stays in edit mode, holding what was typed.
	$effect(() => {
		if (form?.action !== 'update' || !('message' in form) || typeof form.message !== 'string')
			return;
		refusal = {
			field: 'field' in form && form.field ? (form.field as LessonField) : null,
			message: form.message,
			entered:
				'title' in form && 'lessonDay' in form
					? {
							lessonDay: String(form.lessonDay ?? ''),
							title: String(form.title ?? ''),
							notes: String(form.notes ?? '')
						}
					: null
		};
		editing = true;
	});

	/*
	 * The three "Link an existing …" pickers. A tap and a + post the section's
	 * one-tap link action through a hidden form (`use:enhance`, nothing typed to
	 * lose). A tap closes the picker once the link is made; a + keeps it open and
	 * its row turns "✓ Linked" from the reloaded data. A refused link keeps the
	 * picker open with the server's message, and the row stays as it was.
	 */
	type LinkKind = 'figure' | 'routine' | 'exercise';
	const LINK = {
		figure: { action: '?/linkFigure', field: 'figureId' },
		routine: { action: '?/linkRoutine', field: 'routineId' },
		exercise: { action: '?/linkExercise', field: 'exerciseId' }
	} as const;
	const LINK_KINDS = ['figure', 'routine', 'exercise'] as const;

	/** The open link picker; one at a time. */
	let picking = $state<LinkKind | null>(null);
	/** How many + this opening has linked. */
	let added = $state(0);
	let pickMessage = $state<string | null>(null);
	/** Counts openings, so an answer that lands after a close is not counted in the next one. */
	let opening = 0;
	const linkForms: Partial<Record<LinkKind, HTMLFormElement>> = $state({});
	/** Rows whose link is on its way: a second + on one would only be refused. Nothing renders it. */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const inFlight = new Set<string>();
	/** What the hidden form is about to send; read by its submit, synchronously. */
	let sending: { key: string; keep: boolean } | null = null;

	function openPicker(kind: LinkKind) {
		opening += 1;
		added = 0;
		pickMessage = null;
		picking = kind;
	}

	function closePicker() {
		opening += 1;
		picking = null;
		added = 0;
		pickMessage = null;
	}

	function link(kind: LinkKind, row: PickRow, keep: boolean) {
		const f = linkForms[kind];
		if (!f || inFlight.has(row.key)) return;
		const input = f.elements.namedItem(LINK[kind].field);
		if (!(input instanceof HTMLInputElement)) return;
		input.value = String(row.value);
		sending = { key: row.key, keep };
		f.requestSubmit();
	}

	const linkSubmit: SubmitFunction = () => {
		const sent = sending;
		sending = null;
		const at = opening;
		if (sent) inFlight.add(sent.key);
		pickMessage = null;
		return async ({ result, update }) => {
			if (sent) inFlight.delete(sent.key);
			const here = at === opening;
			if (result.type === 'failure') {
				const m = (result.data as { message?: unknown } | undefined)?.message;
				if (here) pickMessage = typeof m === 'string' ? m : 'That could not be linked.';
				return;
			}
			if (result.type === 'error') {
				const m = (result.error as { message?: unknown } | undefined)?.message;
				if (here) pickMessage = typeof m === 'string' ? m : 'That could not be linked.';
				return;
			}
			await update();
			if (result.type !== 'success' || !here || !sent) return;
			if (sent.keep) added += 1;
			else closePicker();
		};
	};

	/** A create row's button: the page's own sheet, on top of the still-open picker. */
	function createFrom(kind: LinkKind, key: string, query: string) {
		if (kind === 'figure') openFigureSheet(key === 'variation' ? 'variation' : 'figure', query);
		if (kind === 'routine') {
			typed = { figureName: '', name: query, notes: '' };
			addingRoutine = true;
		}
		if (kind === 'exercise') {
			typed = { figureName: '', name: query, notes: '' };
			addingExercise = true;
		}
	}

	const label = 'mb-1 block text-[13px] text-muted';
	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const tag =
		'ml-1.5 inline-block rounded-full border border-rule px-1.5 align-[1px] text-[11px] font-normal text-ink-2';
</script>

<svelte:head><title>{lesson.title} · {data.dance.label}</title></svelte:head>

<Screen
	compact
	title={lesson.title}
	subtitle={editing ? 'Editing' : fullDateLabel(lesson.lessonDay)}
>
	{#snippet left()}
		{#if editing}
			<BandButton focusKey="stop-editing" icon="close" label="Stop editing" onclick={stopEditing} />
		{:else}
			<BandButton
				icon="back"
				label="Back to Lessons"
				href={resolve('/[dance]/lessons', { dance: data.dance.slug })}
			/>
		{/if}
	{/snippet}
	{#snippet right()}
		<!-- While editing, the Save pinned at the bottom saves and closes edit mode. -->
		{#if !editing}
			<BandButton
				focusKey="start-editing"
				icon="pencil"
				label="Edit lesson"
				onclick={startEditing}
			/>
		{/if}
	{/snippet}

	<div class="flex flex-col gap-3 {editing ? 'pb-28' : 'pb-4'}">
		{#if editing}
			{#if archiveError}<Banner kind="error">{archiveError}</Banner>{/if}
			<!-- `novalidate`: the server's refusal shows under the field it is about, not the browser's bubble. -->
			<form
				id="edit-form"
				method="POST"
				action="?/update"
				novalidate
				bind:this={editForm}
				class="flex flex-col gap-3.5"
				use:guarded={{ label: 'Lesson edits', submit: saveEdit }}
			>
				{#if refusal && !refusal.field}<Banner kind="error">{refusal.message}</Banner>{/if}
				<LessonFields
					lessonDay={refusal?.entered?.lessonDay ?? lesson.lessonDay}
					title={refusal?.entered?.title ?? lesson.title}
					notes={refusal?.entered ? refusal.entered.notes : lesson.notes}
					max={data.today}
					errors={editErrors}
					notesRows={7}
					notesHelp="Links in notes open when tapped."
				/>
			</form>
			<div class="flex justify-center pt-1">
				<button
					type="button"
					class={button('danger-text', 'sm')}
					aria-haspopup="dialog"
					onclick={() => {
						archiveError = null;
						archiving = true;
					}}>Archive lesson</button
				>
			</div>
		{:else}
			{#if lesson.notes}
				<section class="flex flex-col gap-1.5 rounded-2xl bg-surface px-4 pt-3.5 pb-4">
					<h2 class="text-[13px] font-bold text-muted">Notes</h2>
					<LinkedText
						text={lesson.notes}
						class="text-[16px] leading-[1.45] font-medium whitespace-pre-line text-ink"
					/>
				</section>
			{/if}

			{#if data.exercise && data.popup}
				{@const review = data.exercise}
				<div class={GROUP}>
					<div class="flex min-h-16 items-center pr-1.5 pl-4">
						<a
							href={resolve('/[dance]/exercises/[id]', {
								dance: data.dance.slug,
								id: String(review.id)
							})}
							class="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1"
						>
							<span
								class="grid size-10 flex-none place-items-center rounded-full bg-accent-soft text-accent-text"
							>
								<Icon name="repeat" size={20} />
							</span>
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-[16px] leading-[1.3] font-bold text-ink">Go over this lesson</span
								>
								<span class="text-[13px] leading-[1.35] text-muted"
									>{#each reviewMeta(review) as part, i (i)}{i > 0 ? ' · ' : ''}<span
											class:font-bold={part.strong}>{part.text}</span
										>{/each}</span
								>
							</span>
						</a>
						<!-- The "+" is an icon, so bare accent is allowed. -->
						<button
							type="button"
							class={iconButton('bare').replace('text-ink', 'text-accent')}
							aria-label="Log a set of {review.name}"
							onclick={() => (logging = true)}
						>
							<Icon name="plus" size={24} />
						</button>
					</div>
				</div>
			{/if}

			<section class="flex flex-col gap-2 pt-2.5">
				<h2 class={SECTION_LABEL}>{sectionHeading('Videos', data.videos.length)}</h2>
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
									sourceUrl={video.sourceUrl}
									owner={{ lessonVideoId: video.id }}
									title={lesson.title}
									onproblem={(p) => (broken = { ...broken, [video.id]: p })}
									onclosed={() => void invalidateAll()}
									linking
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
							{#if form?.action === 'deleteVideo' && 'videoId' in form && form.videoId === video.id}
								<p class="px-3 pb-2 text-[13px] text-danger" role="alert">{form.message}</p>
							{/if}
							<VideoSections
								sections={data.sections[video.id] ?? []}
								src="/lesson-videos/{video.file}"
								owner={{ lessonVideoId: video.id }}
								linking
							/>
						</li>
					{/each}
				</ul>
				<div class="mt-3">
					{#if data.app}
						<AppUploadLink
							href={uploadLink(
								{ lesson: lesson.id },
								{ back: page.url.pathname, name: lesson.title }
							)}
							label="+ Add videos"
						/>
					{:else}
						<ChunkedUploadButton
							uploadUrl="/api/lessons/{lesson.id}/videos"
							accept="video/*"
							label="+ Add videos"
							maxBytes={MAX_LESSON_VIDEO_BYTES}
						/>
					{/if}
				</div>
			</section>
			<section class="flex flex-col gap-2 pt-2.5">
				<h2 class={SECTION_LABEL}>{sectionHeading('Links', data.links.length)}</h2>
				<LinksEditor
					links={data.links}
					canSave
					message={failure('addLink') ?? failure('saveVideo') ?? failure('retryVideo') ?? null}
					entered={form && 'urls' in form ? String(form.urls) : ''}
				/>
			</section>
			<section class="flex flex-col gap-2 pt-2.5">
				<div class="flex items-center justify-between">
					<h2 class={SECTION_LABEL}>{sectionHeading('Figures', data.figures.length)}</h2>
					<button
						type="button"
						class="text-[13px] font-medium text-accent-text"
						onclick={() => openFigureSheet()}>+ New figure</button
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
									<span class="block truncate text-[15px] font-medium"
										>{figure.name}{#if figure.viaSections.length > 0}<span class={tag}
												>{viaTag(figure.viaSections)}</span
											>{/if}</span
									>
									<span class="block truncate text-[12px] text-muted"
										>{figure.viaSections.length > 0
											? viaRanges(figure.viaSections)
											: PARTNER_LABEL[figure.partner]}</span
									>
								</a>
								{#if figure.viaSections.length > 0}
									<button
										type="button"
										class="h-9 px-2 text-[13px] text-muted"
										onclick={() =>
											(unlinkingVia = {
												action: '?/unlinkFigure',
												name: 'figureId',
												id: figure.id,
												label: figure.name,
												via: figure.viaSections
											})}>Unlink</button
									>
								{:else}
									<form method="POST" action="?/unlinkFigure" use:enhance>
										<input type="hidden" name="figureId" value={figure.id} />
										<button type="submit" class="h-9 px-2 text-[13px] text-muted">Unlink</button>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{@render linkButton('figure', 'Link an existing figure…')}
			</section>
			<section class="flex flex-col gap-2 pt-2.5">
				<div class="flex items-center justify-between">
					<h2 class={SECTION_LABEL}>{sectionHeading('Routines', data.routines.length)}</h2>
					<button
						type="button"
						class="text-[13px] font-medium text-accent-text"
						onclick={() => createFrom('routine', '', '')}>+ New routine</button
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
				{@render linkButton('routine', 'Link an existing routine…')}
			</section>
			<section class="flex flex-col gap-2 pt-2.5">
				<div class="flex items-center justify-between">
					<h2 class={SECTION_LABEL}>{sectionHeading('Exercises', data.exercises.length)}</h2>
					<button
						type="button"
						class="text-[13px] font-medium text-accent-text"
						onclick={() => createFrom('exercise', '', '')}>+ New exercise</button
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
									class="min-w-0 flex-1"
									><span class="block truncate text-[15px]"
										>{exercise.name}{#if exercise.viaSections.length > 0}<span class={tag}
												>{viaTag(exercise.viaSections)}</span
											>{/if}</span
									>{#if exercise.viaSections.length > 0}<span class="block text-[12px] text-muted"
											>{viaRanges(exercise.viaSections)}</span
										>{/if}</a
								>
								<a
									href={resolve(`/${data.dance.slug}/exercises/${exercise.id}?log=1`)}
									class="grid size-9 place-items-center text-[20px] text-accent"
									aria-label="Log a set of {exercise.name}">+</a
								>
								{#if exercise.viaSections.length > 0}
									<button
										type="button"
										class="h-9 px-2 text-[13px] text-muted"
										onclick={() =>
											(unlinkingVia = {
												action: '?/unlinkExercise',
												name: 'exerciseId',
												id: exercise.id,
												label: exercise.name,
												via: exercise.viaSections
											})}>Unlink</button
									>
								{:else}
									<form method="POST" action="?/unlinkExercise" use:enhance>
										<input type="hidden" name="exerciseId" value={exercise.id} />
										<button type="submit" class="h-9 px-2 text-[13px] text-muted">Unlink</button>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{@render linkButton('exercise', 'Link an existing exercise…')}
			</section>
		{/if}
	</div>
</Screen>

{#if editing}
	<BottomBar>
		<button
			type="submit"
			form="edit-form"
			class={button('primary', 'md', true)}
			aria-busy={saving}
			disabled={saving}
		>
			{#if saving}<Spinner /><span class="sr-only">Saving…</span>{:else}Save{/if}
		</button>
	</BottomBar>
{/if}

<Dialog
	open={archiving}
	title="Archive this lesson?"
	body="Its review exercise goes too. The videos, links and sets are kept."
	icon="warning"
	tone="danger"
	onclose={() => (archiving = false)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (archiving = false)}
			>Cancel</button
		>
		<form
			method="POST"
			action="?/archive"
			use:enhance={() => {
				archiveBusy = true;
				return async ({ update, result }) => {
					if (result.type === 'redirect') {
						// Archived: the edit form goes first, so leaving for Lessons is not
						// asked about as unsaved changes.
						editing = false;
						archiving = false;
						await tick();
					}
					try {
						await update();
					} finally {
						archiveBusy = false;
					}
					if (result.type === 'failure' || result.type === 'error') {
						archiving = false;
						archiveError =
							result.type === 'failure'
								? messageOf(result.data, 'That lesson could not be archived.')
								: messageOf(result.error, 'That lesson could not be archived.');
					}
				};
			}}
		>
			<button
				type="submit"
				class={button('danger', 'sm')}
				aria-busy={archiveBusy}
				disabled={archiveBusy}
			>
				{#if archiveBusy}<Spinner /><span class="sr-only">Archiving…</span>{:else}Archive{/if}
			</button>
		</form>
	{/snippet}
</Dialog>

{#snippet linkButton(kind: LinkKind, text: string)}
	<button
		type="button"
		class="mt-3 flex h-11 w-full cursor-pointer items-center gap-2 rounded-[10px] border border-rule bg-raised px-3 text-left text-[14.5px] font-medium text-accent"
		aria-haspopup="dialog"
		onclick={() => openPicker(kind)}
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			class="shrink-0 text-muted"
			aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg
		>
		{text}
	</button>
{/snippet}

<!-- What a picker's tap and + post: one-tap link actions, filled in by `link()`. -->
{#each LINK_KINDS as kind (kind)}
	<form
		bind:this={linkForms[kind]}
		method="POST"
		action={LINK[kind].action}
		hidden
		use:enhance={linkSubmit}
	>
		<input type="hidden" name={LINK[kind].field} />
	</form>
{/each}

<Picker
	open={picking === 'figure'}
	title="Link a figure"
	placeholder="Search figures"
	kind="link"
	groups={[{ title: 'Figures', entries: variationEntries(data.linkableFigures) }]}
	nothingLeft="There are no figures yet."
	create={[
		{ key: 'figure', label: '+ Figure' },
		{ key: 'variation', label: '+ Variation' }
	]}
	{added}
	message={picking === 'figure' ? pickMessage : null}
	onpick={(row) => link('figure', row, false)}
	onadd={(row) => link('figure', row, true)}
	oncreate={(key, query) => createFrom('figure', key, query)}
	ondone={closePicker}
	onclose={closePicker}
/>

<Picker
	open={picking === 'routine'}
	title="Link a routine"
	placeholder="Search routines"
	kind="link"
	groups={[{ title: 'Routines', entries: routineRows(data.linkableRoutines) }]}
	nothingLeft="There are no routines yet."
	create={[{ key: 'routine', label: '+ Routine' }]}
	{added}
	message={picking === 'routine' ? pickMessage : null}
	onpick={(row) => link('routine', row, false)}
	onadd={(row) => link('routine', row, true)}
	oncreate={(key, query) => createFrom('routine', key, query)}
	ondone={closePicker}
	onclose={closePicker}
/>

<Picker
	open={picking === 'exercise'}
	title="Link an exercise"
	placeholder="Search exercises"
	kind="link"
	groups={exerciseGroups(data.linkableExercises)}
	nothingLeft="Nothing left to link. A figure’s or routine’s exercise lives under it."
	create={[{ key: 'exercise', label: '+ Exercise' }]}
	{added}
	message={picking === 'exercise' ? pickMessage : null}
	onpick={(row) => link('exercise', row, false)}
	onadd={(row) => link('exercise', row, true)}
	oncreate={(key, query) => createFrom('exercise', key, query)}
	ondone={closePicker}
	onclose={closePicker}
/>

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
	title={figureMode === 'figure' ? 'New figure' : 'New variation'}
	open={addingFigure}
	onclose={() => (addingFigure = false)}
>
	<div class="mb-3 flex gap-2">
		{#each FIGURE_MODES as [mode, title] (mode)}
			<button
				type="button"
				aria-pressed={figureMode === mode}
				onclick={() => (figureMode = mode)}
				class="h-11 flex-1 rounded-lg border text-[14px] {figureMode === mode
					? 'border-accent bg-accent text-accent-ink'
					: 'border-rule bg-raised text-ink-2'}">{title}</button
			>
		{/each}
	</div>
	<!-- One form per mode: each is guarded against its own first paint, so the switch alone is never "unsaved". -->
	{#if figureMode === 'figure'}
		<form
			method="POST"
			action="?/newFigure"
			class="space-y-3"
			use:guarded={{ label: 'New figure', submit: closeFigureSheet }}
		>
			{#if failure('newFigure')}
				<p class="bg-danger-bg rounded-lg px-3 py-2 text-[13px] text-danger">
					{failure('newFigure')}
				</p>
			{/if}
			<FigureFields dance={data.dance} figureName={typed.figureName} style={data.defaultStyle} />
			<button
				type="submit"
				class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
				>Add figure</button
			>
		</form>
	{:else}
		<form
			method="POST"
			action="?/newVariation"
			class="space-y-3"
			use:guarded={{ label: 'New variation', submit: closeFigureSheet }}
		>
			{#if failure('newVariation')}
				<p class="bg-danger-bg rounded-lg px-3 py-2 text-[13px] text-danger">
					{failure('newVariation')}
				</p>
			{/if}
			{#if data.figureGroups.length === 0}
				<p class="text-[13px] text-muted">There are no figures yet.</p>
			{:else}
				<PickerField
					name="groupId"
					label="Figure"
					placeholder="Choose a figure…"
					title="Choose a figure"
					search="Search figures"
					groups={variationGroups}
					nothingLeft="There are no figures yet."
					bind:value={variationOf}
					required
				/>
			{/if}
			<FigureFields
				dance={data.dance}
				asksFigureName={false}
				name={typed.name}
				style={data.defaultStyle}
				notes={typed.notes}
			/>
			<button
				type="submit"
				disabled={data.figureGroups.length === 0}
				class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50"
				>Add variation</button
			>
		</form>
	{/if}
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
				value={form && 'name' in form && form.action === 'newRoutine'
					? String(form.name)
					: typed.name}
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
					if (result.type === 'success') {
						addingExercise = false;
						closePicker();
					}
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
			<input name="name" required maxlength="200" class={field} value={typed.name} />
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

{#if unlinkingVia}
	<UnlinkVia {...unlinkingVia} onclose={() => (unlinkingVia = null)} />
{/if}
