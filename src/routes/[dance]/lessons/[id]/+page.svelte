<script lang="ts">
	import { leaveRemoved } from '$lib/nav/trail.svelte';
	import { tick } from 'svelte';
	import { focusKeyed, focusAfterRemoval } from '$lib/focus';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { isClash } from '$lib/clash/clash';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { staleFailure } from '$lib/page-epoch';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import LessonFields from '$lib/components/lessons/LessonFields.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Picker from '$lib/components/picker/Picker.svelte';
	import PickerField from '$lib/components/picker/PickerField.svelte';
	import PickerOpener from '$lib/components/picker/PickerOpener.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { exerciseGroups, figureRows, routineRows, variationEntries } from '$lib/picker/build';
	import type { PickRow } from '$lib/picker/model';
	import { linkSubmit as makeLinkSubmit } from '$lib/picker/link-submit';
	import { restoreArchived, type ArchivedTarget } from '$lib/teams/restore-api';
	import VideoSections from '$lib/components/lessons/VideoSections.svelte';
	import UnlinkVia from '$lib/components/lessons/UnlinkVia.svelte';
	import AppUploadLink from '$lib/components/ui/AppUploadLink.svelte';
	import ChunkedUploadButton from '$lib/components/ui/ChunkedUploadButton.svelte';
	import { uploadLink } from '$lib/app-mode';
	import { page } from '$app/state';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import FrequencyField from '$lib/components/exercises/FrequencyField.svelte';
	import {
		CLIP,
		FIELD,
		GROUP,
		LABEL,
		SECTION_LABEL,
		TEXTAREA,
		button,
		iconButton
	} from '$lib/components/ui/styles';
	import { logFor } from '$lib/components/exercises/kinds';
	import { DEFAULT_EVERY_DAYS } from '$lib/frequency';
	import { byteSize, fullDateLabel } from '$lib/format';
	import {
		deleteBlock,
		deleteVideoBody,
		exerciseMeta,
		figureMeta,
		yoursMeta,
		reviewMeta,
		routineMeta,
		sectionHeading,
		viaBadge
	} from '$lib/lessons/page';
	import { lessonVideoCaption } from '$lib/video/caption';
	import VideoProblem from '$lib/components/ui/VideoProblem.svelte';
	import AddSheet from '$lib/components/teams/AddSheet.svelte';
	import MakeMineSheet from '$lib/components/clones/MakeMineSheet.svelte';
	import SourceTabs from '$lib/components/clones/SourceTabs.svelte';
	import { cloneSubtitle } from '$lib/clones/view';
	import { newLine } from '$lib/teams/add';
	import { MAX_LESSON_VIDEO_BYTES } from '$lib/limits';
	import type { MediaProblem } from '$lib/media';
	import { reportOpen } from '$lib/teams/opens-api';
	import type { AddOffer, ViaSection } from '$lib/types';
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
		focusKeyed(key);
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
	// A group lesson's Add sheet, its menu (Remove from my lessons) and the question before removing.
	/** The Add sheet's offer, kept as opened: once the Add lands the page's is gone. */
	let adding = $state<{ offer: AddOffer; fresh: boolean } | null>(null);
	function openAdd() {
		if (data.add?.offer) adding = { offer: data.add.offer, fresh: data.add.added };
	}
	let lessonMenu = $state(false);
	/** A reader's Edit, or the deleted group's banner: the Make it mine sheet (ruling 12). */
	let makingMine = $state(false);
	let removing = $state(false);
	let removeBusy = $state(false);
	let notNowBusy = $state(false);
	let archiveBusy = $state(false);
	let archiveError = $state<string | null>(null);
	const messageOf = (data: unknown, fallback: string) => {
		const m = (data as { message?: unknown } | undefined)?.message;
		return typeof m === 'string' ? m : fallback;
	};

	// --- Delete a video: what blocks it is said at once; otherwise a question.
	/** Why a video cannot go, by video id; cleared by the next tap of its trash. */
	let videoRefused = $state<Record<number, string>>({});
	/** The video the dialog asks about, with how many sections go with it. */
	let deletingVideo = $state<{ id: number; sections: number } | null>(null);
	let deleteBusy = $state(false);
	function askDeleteVideo(id: number, sections: Parameters<typeof deleteBlock>[0]) {
		const blocked = deleteBlock(sections);
		videoRefused = blocked
			? { ...videoRefused, [id]: blocked }
			: Object.fromEntries(Object.entries(videoRefused).filter(([k]) => Number(k) !== id));
		if (!blocked) deletingVideo = { id, sections: sections.length };
	}

	let addingFigure = $state(false);
	let addingExercise = $state(false);
	let addingRoutine = $state(false);
	let logging = $state(false);
	let broken = $state<Record<number, MediaProblem>>({});
	/** Where focus goes when that row is gone: the list's keys, the row, the list's add control. */
	let viaFocus: { keys: string[]; gone: string; fallback: string } | null = null;
	/** The focus keys of a link list, in page order, and its add control. */
	function listFocus(kind: LinkKind, id: number) {
		const rows: { id: number }[] =
			kind === 'figure' ? data.figures : kind === 'routine' ? data.routines : data.exercises;
		return {
			keys: rows.map((r) => `${kind}-${r.id}`),
			gone: `${kind}-${id}`,
			fallback: `${kind}-add`
		};
	}
	/** A one-tap Unlink: once it lands, focus goes to the next row, else the list's opener. */
	const unlinkRow =
		(kind: LinkKind, id: number): SubmitFunction =>
		() => {
			const f = listFocus(kind, id);
			return async ({ update, result }) => {
				await update();
				if (result.type === 'success') await focusAfterRemoval(f.keys, f.gone, f.fallback);
			};
		};
	/** A row there through a section, whose Unlink is asking first. */
	let unlinkingVia = $state<{
		action: string;
		name: string;
		id: number;
		label: string;
		via: ViaSection[];
	} | null>(null);

	const lesson = $derived(data.lesson);
	/** Opened from the person's copy (`?vs=`): the place this page is, for the note under the tabs. */
	const sourcePlace = $derived(
		data.vs !== null && data.cloneLine.self.kind === 'team' ? data.cloneLine.self.name : null
	);
	// Shown, not preloaded: a group's lesson counts as opened here, and again after
	// the editor's own Publish reloads the data with a new publishedAt.
	$effect(() => {
		if (data.team) {
			void lesson.publishedAt;
			reportOpen('lesson', lesson.id);
		}
	});
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const LessonLog = logFor('lesson');
	const failure = (action: string) => (form?.action === action ? form.message : null);

	/** The "+ New figure" sheet's switch: a move of its own, or a figure of one. */
	const FIGURE_MODES = [
		{ value: 'figure', label: 'New move' },
		{ value: 'variation', label: 'New figure in a move' }
	];
	let figureMode = $state<string>('figure');
	/** Which of the three create sheets is posting: its footer button spins. */
	let creatingBusy = $state<'figure' | 'routine' | 'exercise' | null>(null);

	type CreateAction = 'newFigure' | 'newVariation' | 'newExercise' | 'newRoutine';
	/**
	 * The `form` there when a create sheet last opened: a refusal from before
	 * is not this sheet's, so it is not shown again on the next open.
	 */
	let seen: unknown = $state(null);
	/** A create sheet's refusal: a field's message goes under it, any other in a banner at the top. */
	function refusalOf(action: CreateAction): { field: string | null; message: string } | null {
		const f = form as { action?: unknown; field?: unknown; message?: unknown } | null;
		if (!f || f === seen || f.action !== action || typeof f.message !== 'string') return null;
		return { field: typeof f.field === 'string' ? f.field : null, message: f.message };
	}
	const errorsOf = (action: CreateAction): Record<string, string> => {
		const r = refusalOf(action);
		return r?.field ? { [r.field]: r.message } : {};
	};
	const bannerOf = (action: CreateAction) => {
		const r = refusalOf(action);
		return r && !r.field ? r.message : null;
	};
	let routineEvery = $state(DEFAULT_EVERY_DAYS);
	let exerciseEvery = $state(DEFAULT_EVERY_DAYS);

	/** A create sheet's submit: one post per tap, its footer spinning while it is out. */
	function createSubmit(
		which: 'figure' | 'routine' | 'exercise',
		done?: () => void
	): SubmitFunction {
		return ({ cancel }) => {
			if (creatingBusy) return cancel();
			creatingBusy = which;
			return async ({ update, result }) => {
				try {
					await update();
				} finally {
					creatingBusy = null;
				}
				if (result.type === 'success') done?.();
			};
		};
	}
	/** The move "New figure in a move" adds to: a `figure_groups` id, as its field posts it. */
	let variationOf = $state<number | null>(null);
	// What a refused `newVariation` posted, so the sheet reopens holding it.
	const variationTyped = $derived(form && 'groupId' in form ? form : null);
	/** What a create sheet's name field starts with: the picker's search, or a refused post. */
	let typed = $state({ figureName: '', name: '', notes: '' });

	/** The moves this lesson teaches, by hand or through a section: "New figure in a move" offers them first. */
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
			title: 'Moves',
			entries: figureRows(data.figureGroups.filter((g) => !taughtGroups.has(g.id)))
		}
	]);

	function openFigureSheet(mode: 'figure' | 'variation' = 'figure', query = '') {
		seen = form;
		figureMode = mode;
		variationOf = data.figureGroups.find((g) => taughtGroups.has(g.id))?.id ?? null;
		typed =
			mode === 'figure'
				? { figureName: query, name: '', notes: '' }
				: { figureName: '', name: query, notes: '' };
		addingFigure = true;
	}

	const closeFigureSheet = createSubmit('figure', () => {
		addingFigure = false;
		closePicker();
	});
	const closeExerciseSheet = createSubmit('exercise', () => {
		addingExercise = false;
		closePicker();
	});
	// A success redirects to the routine's page, where its slots are built.
	const routineSubmit = createSubmit('routine');

	// A refused create (and, without JavaScript, the page it re-renders) reopens its sheet holding what was typed.
	$effect(() => {
		const typedBack = (f: object) => ({
			figureName: 'figureName' in f ? String(f.figureName ?? '') : '',
			name: 'name' in f ? String(f.name ?? '') : '',
			notes: 'notes' in f ? String(f.notes ?? '') : ''
		});
		if (form && failure('newFigure')) {
			figureMode = 'figure';
			typed = typedBack(form);
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
		if (form && (failure('newExercise') || failure('newRoutine'))) {
			typed = typedBack(form);
			if (failure('newExercise')) addingExercise = true;
			else addingRoutine = true;
		}
	});

	// A refused edit (and, without JavaScript, the page it re-renders) stays in edit mode, holding what was typed.
	$effect(() => {
		if (form?.action !== 'update' || !('message' in form) || typeof form.message !== 'string')
			return;
		// Someone else saved it, or it went: the clash sheet's, holding what was typed.
		if (isClash(form)) return;
		refusal = {
			field: (form as { field?: LessonField }).field ?? null,
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
		figure: { action: '?/linkFigure', unlink: '?/unlinkFigure', field: 'figureId' },
		routine: { action: '?/linkRoutine', unlink: '?/unlinkRoutine', field: 'routineId' },
		exercise: { action: '?/linkExercise', unlink: '?/unlinkExercise', field: 'exerciseId' }
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
	/** Rows whose link is on its way: a second + on one would only be refused; the picker shows a spinner. */
	const inFlight = new SvelteSet<string>();
	/** What the hidden form is about to send; read by its submit, synchronously. */
	let sending: { key: string; label: string; keep: boolean } | null = null;

	function openPicker(kind: LinkKind) {
		opening += 1;
		added = 0;
		pickMessage = null;
		archivedPick = null;
		picking = kind;
	}

	function closePicker() {
		opening += 1;
		picking = null;
		added = 0;
		pickMessage = null;
		archivedPick = null;
	}

	/** The last row sent, so a refusal for something archived since can Restore it and link again. */
	let lastPick: { kind: LinkKind; row: PickRow; keep: boolean } | null = null;
	/** "Archived by Ana": Restore (and link) or Pick another. */
	let archivedPick = $state<{
		kind: LinkKind;
		row: PickRow;
		keep: boolean;
		restorable: boolean;
	} | null>(null);
	let restoring = $state(false);

	function link(kind: LinkKind, row: PickRow, keep: boolean) {
		const f = linkForms[kind];
		if (!f || inFlight.has(row.key)) return;
		const input = f.elements.namedItem(LINK[kind].field);
		if (!(input instanceof HTMLInputElement)) return;
		input.value = String(row.value);
		sending = { key: row.key, label: row.label, keep };
		lastPick = { kind, row, keep };
		f.requestSubmit();
	}

	const linkSubmit = makeLinkSubmit({
		take: () => {
			const s = sending;
			sending = null;
			return s;
		},
		opening: () => opening,
		inFlight,
		setMessage: (m) => {
			pickMessage = m;
			if (m === null) archivedPick = null;
		},
		added: () => (added += 1),
		close: closePicker,
		archived: (sent, restorable) => {
			const p = lastPick;
			archivedPick = p && p.row.key === sent.key ? { ...p, restorable } : null;
		}
	});

	/** Restore what was archived since, then make the link that was refused. */
	async function restoreAndLink() {
		const a = archivedPick;
		if (!a || restoring) return;
		restoring = true;
		const refused = await restoreArchived({
			[LINK[a.kind].field]: Number(a.row.value)
		} as ArchivedTarget);
		restoring = false;
		archivedPick = null;
		if (refused) {
			pickMessage = refused;
			return;
		}
		pickMessage = null;
		link(a.kind, a.row, a.keep);
	}

	/** The picker's "Archived by" choices, for the open picker of this kind. */
	function archivedChoice(kind: LinkKind) {
		const a = archivedPick;
		if (!a || a.kind !== kind) return null;
		return {
			restoring,
			onrestore: a.restorable ? restoreAndLink : undefined,
			onpickanother: () => {
				archivedPick = null;
				pickMessage = null;
			}
		};
	}

	/** A create row's button: the page's own sheet, on top of the still-open picker. */
	function createFrom(kind: LinkKind, key: string, query: string) {
		if (kind === 'figure') openFigureSheet(key === 'variation' ? 'variation' : 'figure', query);
		if (kind === 'routine') {
			seen = form;
			typed = { figureName: '', name: query, notes: '' };
			routineEvery = DEFAULT_EVERY_DAYS;
			addingRoutine = true;
		}
		if (kind === 'exercise') {
			seen = form;
			typed = { figureName: '', name: query, notes: '' };
			exerciseEvery = DEFAULT_EVERY_DAYS;
			addingExercise = true;
		}
	}
</script>

<svelte:head><title>{lesson.title} · {data.dance.label}</title></svelte:head>

{#snippet draftBand()}
	<!-- A group's draft: only its editors see it, until one of them publishes it. -->
	<div class="flex items-center gap-3">
		<Badge tone="warn" solid>Draft</Badge>
		<span class="min-w-0 flex-1 text-[13px] font-semibold text-band-small"
			>Only the group's editors see it</span
		>
		{#if data.canEdit}
			<form method="POST" action="?/publish" use:enhance>
				<button type="submit" class={button('secondary', 'sm')}>Publish</button>
			</form>
		{/if}
	</div>
{/snippet}

{#snippet addBand()}
	<!-- A published group lesson not yet in the person's own Lessons. -->
	<div class="flex items-center gap-3">
		<span class="min-w-0 flex-1 text-[13px] font-semibold text-band-small"
			>Not in your lessons yet</span
		>
		<button type="button" class={button('secondary', 'sm')} aria-haspopup="dialog" onclick={openAdd}
			>Add</button
		>
	</div>
{/snippet}

<Screen
	compact
	title={lesson.title}
	subtitle={editing
		? 'Editing'
		: data.team
			? `${fullDateLabel(lesson.lessonDay)} · ${data.team.name}`
			: [fullDateLabel(lesson.lessonDay), cloneSubtitle(data.cloneLine)]
					.filter((x) => x !== null)
					.join(' · ')}
	extra={editing
		? undefined
		: data.draft
			? draftBand
			: data.add && !data.add.added && data.add.offer
				? addBand
				: undefined}
>
	{#snippet left()}
		{#if editing}
			<BandButton focusKey="stop-editing" icon="close" label="Stop editing" onclick={stopEditing} />
		{:else}
			<BackButton
				fallback={{
					href: resolve('/[dance]/lessons', { dance: data.dance.slug }),
					label: 'Back to Lessons'
				}}
			/>
		{/if}
	{/snippet}
	{#snippet right()}
		{#if !editing && (data.add?.added || data.historyHref)}
			<BandButton icon="more" label="Lesson menu" onclick={() => (lessonMenu = true)} />
		{/if}
		<!-- While editing, the Save pinned at the bottom saves and closes edit mode. A reader's pencil makes it theirs. -->
		{#if !editing && data.canEdit}
			<BandButton
				focusKey="start-editing"
				icon="pencil"
				label="Edit lesson"
				onclick={startEditing}
			/>
		{:else if !editing && data.makeMine}
			<!-- A reader's Edit makes the lesson theirs (ruling 12: once Make my own copy). -->
			<BandButton icon="pencil" label="Edit lesson" onclick={() => (makingMine = true)} />
		{/if}
	{/snippet}
	<div class="flex flex-col gap-3 {editing ? 'pb-28' : 'pb-4'}">
		{#if !editing}
			<SourceTabs
				sources={data.sources}
				kind="lesson"
				dance={data.dance.slug}
				current={lesson.id}
				mineId={data.mineId}
				taking={sourcePlace}
			/>
		{/if}
		{#if failure('publish')}<Banner kind="error">{failure('publish')}</Banner>{/if}
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
				<!-- What this form saw: a save that saw another version is refused (the clash check). -->
				<input type="hidden" name="seen" value={JSON.stringify(data.seen)} />
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
			{#if data.notice}
				{@const notice = data.notice}
				<!-- The group is being deleted: read-only until the purge, with a way to keep it. -->
				<Banner kind={notice.tone}>
					{notice.text}
					{#snippet action()}
						{#if data.makeMine}
							<button
								type="button"
								class={button('tertiary', 'sm')}
								aria-haspopup="dialog"
								onclick={() => (makingMine = true)}>{notice.action}</button
							>
						{/if}
					{/snippet}
				</Banner>
			{/if}
			{#if data.edited}<p class="text-[13px] font-semibold text-muted">{data.edited}</p>{/if}
			{#if data.add?.added && data.add.offer}
				<!-- What came into the lesson since the person added it: Add, or Not now until something else does. -->
				<div
					class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-accent-soft py-2 pr-2 pl-4"
				>
					<span class="min-w-0 flex-1 text-[15px] font-bold text-accent-text"
						>{newLine(data.add.offer.items)}</span
					>
					<form
						method="POST"
						action="?/notNow"
						use:enhance={() => {
							notNowBusy = true;
							return async ({ update }) => {
								try {
									await update();
								} finally {
									notNowBusy = false;
								}
							};
						}}
					>
						<button
							type="submit"
							class={button('tertiary', 'sm')}
							aria-busy={notNowBusy}
							disabled={notNowBusy}>Not now</button
						>
					</form>
					<button
						type="button"
						class={button('primary', 'sm')}
						aria-haspopup="dialog"
						onclick={openAdd}>Add</button
					>
				</div>
			{/if}
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
							class={iconButton('bare', 'accent')}
							aria-label="Log a set of {review.name}"
							onclick={() => (logging = true)}
						>
							<Icon name="plus" size={24} />
						</button>
					</div>
				</div>
			{/if}

			<section class="flex flex-col gap-2 pt-2.5">
				<h2 class={SECTION_LABEL} tabindex="-1" data-focus="videos-heading">
					{sectionHeading('Videos', data.videos.length)}
				</h2>
				{#if data.videos.length}
					<ul class="flex flex-col gap-3">
						{#each data.videos as video, i (video.id)}
							{@const videoSections = data.sections[video.id] ?? []}
							{#snippet videoTrash()}
								{#if data.canEdit}<button
										data-focus="video-{video.id}"
										type="button"
										aria-label="Delete video {i + 1}"
										aria-haspopup="dialog"
										class={iconButton('bare', 'danger')}
										onclick={() => askDeleteVideo(video.id, videoSections)}
										><Icon name="trash" size={22} /></button
									>{/if}
							{/snippet}
							<li class="{CLIP} rounded-[22px] bg-surface">
								{#if broken[video.id] === 'missing'}
									<VideoProblem
										title="This file is missing"
										body="The server has no file for this video."
										meta={byteSize(video.sizeBytes)}
									>
										{#snippet action()}{@render videoTrash()}{/snippet}
									</VideoProblem>
								{:else if broken[video.id] === 'unplayable'}
									<VideoProblem
										title="Can’t play here"
										body="This browser can’t play this file. Download it or open it on your phone."
										meta={byteSize(video.sizeBytes)}
									>
										{#snippet action()}
											<span class="flex items-center gap-1">
												<a
													href={resolve('/lesson-videos/[file]', { file: video.file })}
													download
													class={button('tertiary', 'sm')}
													><Icon name="download" size={18} />Download</a
												>
												{@render videoTrash()}
											</span>
										{/snippet}
									</VideoProblem>
								{:else}
									<VideoFrame
										src="/lesson-videos/{video.file}"
										sourceUrl={video.sourceUrl}
										owner={{ lessonVideoId: video.id }}
										title={lesson.title}
										caption={lessonVideoCaption(i, video)}
										onproblem={(p) => (broken = { ...broken, [video.id]: p })}
										onclosed={() => void refreshWhenSettled()}
										linking={data.canEdit}
										canEdit={data.canEdit}
										action={data.canEdit ? videoTrash : undefined}
										sections={videoSections}
									/>
								{/if}
								{#if videoRefused[video.id]}
									<div class="px-3 pb-2.5">
										<Banner kind="error" title="Can’t delete this video"
											>{videoRefused[video.id]}</Banner
										>
									</div>
								{/if}
								<VideoSections
									sections={videoSections}
									src="/lesson-videos/{video.file}"
									owner={{ lessonVideoId: video.id }}
									linking={data.canEdit}
									canEdit={data.canEdit}
								/>
							</li>
						{/each}
					</ul>
				{/if}
				{#if !data.canEdit}
					{#if data.videos.length === 0}
						<p class="px-1 text-[15px] text-muted">No videos yet.</p>
					{/if}
				{:else}<div class={data.videos.length ? 'mt-3' : ''}>
						{#if data.app}
							<AppUploadLink
								kind="dashed"
								href={uploadLink(
									{ lesson: lesson.id },
									{ back: page.url.pathname, name: lesson.title }
								)}
								label="Add videos"
							/>
						{:else}
							<ChunkedUploadButton
								uploadUrl="/api/lessons/{lesson.id}/videos"
								accept="video/*"
								label="Add videos"
								maxBytes={MAX_LESSON_VIDEO_BYTES}
							/>
						{/if}
					</div>{/if}
			</section>
			<section class="flex flex-col gap-2 pt-2.5">
				<h2 class={SECTION_LABEL}>{sectionHeading('Links', data.links.length)}</h2>
				{#if data.canEdit}
					<LinksEditor
						compact
						links={data.links}
						canSave
						message={failure('addLink') ?? failure('saveVideo') ?? failure('retryVideo') ?? null}
						entered={form && 'urls' in form ? String(form.urls) : ''}
					/>
				{:else}
					<LinkList compact links={data.links} />
				{/if}
			</section>
			<!-- What the lesson teaches: by hand, or through a section of its videos ("via section"). -->
			<div class="flex flex-col gap-2.5 pt-2.5">
				<section class="flex flex-col gap-2">
					{@render labelRow(sectionHeading('Figures', data.figures.length), 'figure', () =>
						openFigureSheet()
					)}
					{#if data.figures.length > 0}
						<ul class={GROUP}>
							{#each data.figures as figure (figure.id)}
								<li class="flex min-h-16 items-center gap-0.5 pr-1.5 pl-4">
									<a
										data-focus="figure-{figure.id}"
										href={resolve('/[dance]/figures/[id]', {
											dance: data.dance.slug,
											id: String(figure.mineId ?? figure.id)
										})}
										class="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-1"
									>
										{@render itemText(
											figure.name,
											viaBadge(figure.viaSections),
											yoursMeta(figureMeta(figure), figure.mineId)
										)}
									</a>
									{@render unlinkButton('figure', figure.id, figure.name, figure.viaSections)}
								</li>
							{/each}
						</ul>
					{/if}
					{#if data.canEdit}
						<PickerOpener
							data-focus="figure-add"
							label="Link an existing figure…"
							onclick={() => openPicker('figure')}
						/>
					{/if}
				</section>
				<section class="flex flex-col gap-2">
					{@render labelRow(sectionHeading('Routines', data.routines.length), 'routine', () =>
						createFrom('routine', '', '')
					)}
					{#if data.routines.length > 0}
						<ul class={GROUP}>
							{#each data.routines as routine (routine.id)}
								<li class="flex min-h-16 items-center gap-0.5 pr-1.5 pl-4">
									<a
										data-focus="routine-{routine.id}"
										href={resolve('/[dance]/routines/[id]', {
											dance: data.dance.slug,
											id: String(routine.mineId ?? routine.id)
										})}
										class="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-1"
									>
										{@render itemText(
											routine.name,
											null,
											yoursMeta(routineMeta(routine), routine.mineId)
										)}
									</a>
									<!-- A routine never reaches a lesson through a section. -->
									{@render unlinkButton('routine', routine.id, routine.name, [])}
								</li>
							{/each}
						</ul>
					{/if}
					{#if data.canEdit}
						<PickerOpener
							data-focus="routine-add"
							label="Link an existing routine…"
							onclick={() => openPicker('routine')}
						/>
					{/if}
				</section>
				<section class="flex flex-col gap-2">
					{@render labelRow(sectionHeading('Exercises', data.exercises.length), 'exercise', () =>
						createFrom('exercise', '', '')
					)}
					{#if data.exercises.length > 0}
						<ul class={GROUP}>
							{#each data.exercises as exercise (exercise.id)}
								<li class="flex min-h-16 items-center gap-0.5 pr-1.5 pl-4">
									<a
										data-focus="exercise-{exercise.id}"
										href={resolve('/[dance]/exercises/[id]', {
											dance: data.dance.slug,
											id: String(exercise.mineId ?? exercise.id)
										})}
										class="flex min-w-0 flex-1 flex-col gap-0.5 py-2.5 pr-1"
									>
										{@render itemText(
											exercise.name,
											viaBadge(exercise.viaSections),
											yoursMeta(exerciseMeta(exercise), exercise.mineId)
										)}
									</a>
									<!-- The "+" is an icon, so bare accent is allowed. A group's drill is
									     logged through each person's own entry, never from here. -->
									{#if !data.team}
										<a
											href={resolve(`/${data.dance.slug}/exercises/${exercise.id}?log=1`)}
											class={iconButton('bare', 'accent')}
											aria-label="Log a set of {exercise.name}"><Icon name="plus" size={24} /></a
										>
									{/if}
									{@render unlinkButton(
										'exercise',
										exercise.id,
										exercise.name,
										exercise.viaSections
									)}
								</li>
							{/each}
						</ul>
					{/if}
					{#if data.canEdit}
						<PickerOpener
							data-focus="exercise-add"
							label="Link an existing exercise…"
							onclick={() => openPicker('exercise')}
						/>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</Screen>

{#if editing}
	<BottomBar mode>
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
	open={deletingVideo !== null}
	title="Delete this video?"
	body={deleteVideoBody(deletingVideo?.sections ?? 0)}
	icon="trash"
	tone="danger"
	onclose={() => (deletingVideo = null)}
>
	{#snippet actions()}
		<button type="button" class={button('tertiary', 'sm')} onclick={() => (deletingVideo = null)}
			>Cancel</button
		>
		<form
			method="POST"
			action="?/deleteVideo"
			use:enhance={() => {
				deleteBusy = true;
				const id = deletingVideo?.id;
				const keys = data.videos.map((v) => `video-${v.id}`);
				return async ({ update, result }) => {
					try {
						if (result.type === 'failure' && id !== undefined) {
							videoRefused = {
								...videoRefused,
								[id]: messageOf(result.data, 'That video could not be deleted.')
							};
							// Not on a stale page's refusal: the reload would be held back for good.
							if (!staleFailure(result)) await invalidateAll();
						} else {
							await update();
						}
					} finally {
						deleteBusy = false;
						deletingVideo = null;
					}
					if (result.type === 'success' && id !== undefined)
						await focusAfterRemoval(keys, `video-${id}`, 'videos-heading');
				};
			}}
		>
			<input type="hidden" name="videoId" value={deletingVideo?.id ?? ''} />
			<button
				type="submit"
				class={button('danger', 'sm')}
				aria-busy={deleteBusy}
				disabled={deleteBusy}
			>
				{#if deleteBusy}<Spinner /><span class="sr-only">Deleting…</span>{:else}Delete{/if}
			</button>
		</form>
	{/snippet}
</Dialog>

{#if adding}
	<AddSheet
		open={true}
		onclose={() => (adding = null)}
		title={lesson.title}
		lessonId={lesson.id}
		offer={adding.offer}
		action="?/add"
		fresh={adding.fresh}
	/>
{/if}

{#if data.makeMine}
	<MakeMineSheet open={makingMine} onclose={() => (makingMine = false)} offer={data.makeMine} />
{/if}

{#if data.add?.added || data.historyHref}
	<Sheet title={lesson.title} open={lessonMenu} onclose={() => (lessonMenu = false)}>
		<div class={GROUP}>
			{#if data.historyHref}
				<a
					href={resolve('/[dance]/groups/[id]/history/[kind]/[rootId]', {
						dance: data.dance.slug,
						id: String(data.team?.id),
						kind: 'lesson',
						rootId: String(lesson.id)
					})}
					class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-step"
				>
					<span class="flex-none text-accent-text"><Icon name="clock" size={22} /></span>
					<span class="text-[16px] font-bold text-ink">History</span>
				</a>
			{/if}
			{#if data.add?.added}
				<button
					type="button"
					class="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-step"
					aria-haspopup="dialog"
					onclick={() => {
						lessonMenu = false;
						removing = true;
					}}
				>
					<span class="flex-none text-danger"><Icon name="trash" size={22} /></span>
					<span class="text-[16px] font-bold text-danger">Remove from my lessons</span>
				</button>
			{/if}
		</div>
	</Sheet>

	<Dialog
		open={removing}
		title="Remove from your lessons?"
		body="What it put on Today goes, unless another lesson you have holds it. Your logs are kept."
		icon="trash"
		tone="danger"
		onclose={() => (removing = false)}
	>
		{#snippet actions()}
			<button type="button" class={button('tertiary', 'sm')} onclick={() => (removing = false)}
				>Cancel</button
			>
			<form
				method="POST"
				action="?/remove"
				use:enhance={() => {
					removeBusy = true;
					return async ({ update, result }) => {
						if (result.type === 'redirect') {
							removing = false;
							await tick();
							await leaveRemoved(result.location);
							removeBusy = false;
							return;
						}
						try {
							await update();
						} finally {
							removeBusy = false;
							removing = false;
						}
					};
				}}
			>
				<button
					type="submit"
					class={button('danger', 'sm')}
					aria-busy={removeBusy}
					disabled={removeBusy}
				>
					{#if removeBusy}<Spinner /><span class="sr-only">Removing…</span>{:else}Remove{/if}
				</button>
			</form>
		{/snippet}
	</Dialog>
{/if}

<Dialog
	open={archiving}
	title="Archive this lesson?"
	body={data.team
		? 'The videos and links are kept.'
		: 'Its review exercise goes too. The videos, links and sets are kept.'}
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
					// An error result would be rendered as the error page by update() first,
					// so it is handled before it.
					if (result.type === 'error') {
						archiveBusy = false;
						archiving = false;
						archiveError = messageOf(result.error, 'That lesson could not be archived.');
						return;
					}
					if (result.type === 'redirect') {
						// Archived: the edit form goes first, so leaving for Lessons is not
						// asked about as unsaved changes.
						editing = false;
						archiving = false;
						await tick();
						await leaveRemoved(result.location);
						archiveBusy = false;
						return;
					}
					try {
						await update();
					} finally {
						archiveBusy = false;
					}
					if (result.type === 'failure') {
						archiving = false;
						archiveError = messageOf(result.data, 'That lesson could not be archived.');
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

{#snippet labelRow(heading: string, what: LinkKind, onclick: () => void)}
	<div class="flex items-center justify-between pr-1">
		<h2 class={SECTION_LABEL}>{heading}</h2>
		{#if data.canEdit}
			<button type="button" class={button('tertiary', 'sm')} aria-label="New {what}" {onclick}
				><Icon name="plus" size={18} />New</button
			>
		{/if}
	</div>
{/snippet}

{#snippet itemText(title: string, badge: string | null, meta: string | null)}
	<span
		class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] leading-[1.3] font-bold text-ink"
	>
		<span class="min-w-0 break-words">{title}</span>
		{#if badge}<Badge tone="neutral"><Icon name="link" size={12} />{badge}</Badge>{/if}
	</span>
	{#if meta}<span class="text-[13px] leading-[1.35] text-muted">{meta}</span>{/if}
{/snippet}

<!-- A row there by hand unlinks at once; one there through a section asks first, and takes the section links too. -->
{#snippet unlinkButton(kind: LinkKind, id: number, name: string, via: ViaSection[])}
	{#if !data.canEdit}
		<!-- A reader unlinks nothing. -->
	{:else if via.length > 0}
		<button
			type="button"
			aria-haspopup="dialog"
			aria-label="Unlink {name}"
			class={iconButton('bare', 'muted')}
			onclick={() => {
				viaFocus = listFocus(kind, id);
				unlinkingVia = {
					action: LINK[kind].unlink,
					name: LINK[kind].field,
					id,
					label: name,
					via
				};
			}}><Icon name="unlink" size={22} /></button
		>
	{:else}
		<form method="POST" action={LINK[kind].unlink} class="flex" use:enhance={unlinkRow(kind, id)}>
			<input type="hidden" name={LINK[kind].field} value={id} />
			<button type="submit" aria-label="Unlink {name}" class={iconButton('bare', 'muted')}
				><Icon name="unlink" size={22} /></button
			>
		</form>
	{/if}
{/snippet}

<!-- Linking and making things are an editor's: a reader gets none of the pickers or sheets. -->
{#if data.canEdit}
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
		pending={inFlight}
		groups={[{ title: 'Figures', entries: variationEntries(data.linkableFigures) }]}
		nothingLeft="There are no figures yet."
		create={[
			{ key: 'figure', label: 'Move' },
			{ key: 'variation', label: 'Figure' }
		]}
		{added}
		message={picking === 'figure' ? pickMessage : null}
		archived={picking === 'figure' ? archivedChoice('figure') : null}
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
		pending={inFlight}
		groups={[{ title: 'Routines', entries: routineRows(data.linkableRoutines) }]}
		nothingLeft="There are no routines yet."
		create={[{ key: 'routine', label: 'Routine' }]}
		{added}
		message={picking === 'routine' ? pickMessage : null}
		archived={picking === 'routine' ? archivedChoice('routine') : null}
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
		pending={inFlight}
		groups={exerciseGroups(data.linkableExercises)}
		nothingLeft="Nothing left to link. A figure’s or routine’s exercise lives under it."
		create={[{ key: 'exercise', label: 'Exercise' }]}
		{added}
		message={picking === 'exercise' ? pickMessage : null}
		archived={picking === 'exercise' ? archivedChoice('exercise') : null}
		onpick={(row) => link('exercise', row, false)}
		onadd={(row) => link('exercise', row, true)}
		oncreate={(key, query) => createFrom('exercise', key, query)}
		ondone={closePicker}
		onclose={closePicker}
	/>
{/if}

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

{#if data.canEdit}
	<Sheet title="New figure" open={addingFigure} onclose={() => (addingFigure = false)}>
		<div class="flex flex-col gap-3">
			<Segmented name="make" label="Make" items={FIGURE_MODES} bind:value={figureMode} />
			<!-- One form per mode: each is guarded against its own first paint, so the switch alone is never "unsaved".
		     `novalidate`: the server's refusal shows under the field it is about, not the browser's bubble. -->
			{#if figureMode === 'figure'}
				<form
					id="lesson-new-figure"
					method="POST"
					action="?/newFigure"
					novalidate
					class="flex flex-col gap-3"
					use:guarded={{ label: 'New figure', submit: closeFigureSheet }}
				>
					{#if bannerOf('newFigure')}<Banner kind="error">{bannerOf('newFigure')}</Banner>{/if}
					<FigureFields
						dance={data.dance}
						figureName={typed.figureName}
						name={typed.name}
						notes={typed.notes}
						style={data.defaultStyle}
						errors={errorsOf('newFigure')}
					/>
				</form>
			{:else}
				{@const groupError = errorsOf('newVariation').groupId}
				<form
					id="lesson-new-variation"
					method="POST"
					action="?/newVariation"
					novalidate
					class="flex flex-col gap-3"
					use:guarded={{ label: 'New figure', submit: closeFigureSheet }}
				>
					{#if bannerOf('newVariation')}<Banner kind="error">{bannerOf('newVariation')}</Banner
						>{/if}
					{#if data.figureGroups.length === 0}
						<p class="text-[13px] text-muted">There are no moves yet.</p>
					{:else}
						<div>
							<PickerField
								name="groupId"
								label="Move"
								placeholder="Choose a move…"
								title="Choose a move"
								search="Search moves"
								groups={variationGroups}
								nothingLeft="There are no moves yet."
								bind:value={variationOf}
								required
							/>
							<p class="mt-1.5 pl-1 text-[13px] text-muted">Moves in this lesson come first</p>
							{#if groupError}<FieldError
									id="lesson-variation-group-error"
									message={groupError}
								/>{/if}
						</div>
					{/if}
					<FigureFields
						dance={data.dance}
						asksFigureName={false}
						name={typed.name}
						style={data.defaultStyle}
						notes={typed.notes}
						errors={errorsOf('newVariation')}
					/>
				</form>
			{/if}
		</div>

		{#snippet footer()}
			{@const busy = creatingBusy === 'figure'}
			<button
				type="submit"
				form={figureMode === 'figure' ? 'lesson-new-figure' : 'lesson-new-variation'}
				class={button('primary', 'md', true)}
				disabled={figureMode === 'variation' && data.figureGroups.length === 0}
				aria-busy={busy}
				aria-label={busy ? 'Adding' : undefined}
			>
				{#if busy}<Spinner />{:else}Add figure{/if}
			</button>
		{/snippet}
	</Sheet>

	<Sheet
		title="New routine from this lesson"
		sub="Linked here, then opened to build its slots"
		open={addingRoutine}
		onclose={() => (addingRoutine = false)}
	>
		{@render createFields('lesson-new-routine', '?/newRoutine', 'New routine', 'newRoutine')}
		{#snippet footer()}
			{@const busy = creatingBusy === 'routine'}
			<button
				type="submit"
				form="lesson-new-routine"
				class={button('primary', 'md', true)}
				aria-busy={busy}
				aria-label={busy ? 'Adding routine' : undefined}
			>
				{#if busy}<Spinner />{:else}Add routine and build it{/if}
			</button>
		{/snippet}
	</Sheet>

	<Sheet
		title="New exercise from this lesson"
		open={addingExercise}
		onclose={() => (addingExercise = false)}
	>
		{@render createFields('lesson-new-exercise', '?/newExercise', 'New exercise', 'newExercise')}
		{#snippet footer()}
			{@const busy = creatingBusy === 'exercise'}
			<button
				type="submit"
				form="lesson-new-exercise"
				class={button('primary', 'md', true)}
				aria-busy={busy}
				aria-label={busy ? 'Adding exercise' : undefined}
			>
				{#if busy}<Spinner />{:else}Add exercise{/if}
			</button>
		{/snippet}
	</Sheet>
{/if}

<!-- The routine and exercise sheets' form: Name, How often, Notes. A success of
     the routine's redirects to its page, where its slots are built. -->
{#snippet createFields(
	id: string,
	action: string,
	label: string,
	kind: 'newRoutine' | 'newExercise'
)}
	{@const errors = errorsOf(kind)}
	<form
		{id}
		method="POST"
		{action}
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{ label, submit: kind === 'newRoutine' ? routineSubmit : closeExerciseSheet }}
	>
		{#if bannerOf(kind)}<Banner kind="error">{bannerOf(kind)}</Banner>{/if}
		<div>
			<label class={LABEL} for="{id}-name">Name</label>
			<input
				id="{id}-name"
				name="name"
				required
				maxlength="200"
				class={FIELD}
				value={typed.name}
				aria-invalid={errors.name ? 'true' : undefined}
				aria-describedby={errors.name ? `${id}-name-error` : undefined}
			/>
			{#if errors.name}<FieldError id="{id}-name-error" message={errors.name} />{/if}
		</div>
		{#if kind === 'newRoutine'}
			<FrequencyField name="everyDays" label="How often" bind:value={routineEvery} />
		{:else}
			<FrequencyField name="everyDays" label="How often" bind:value={exerciseEvery} />
		{/if}
		<div>
			<label class={LABEL} for="{id}-notes"
				>Notes<span class="font-medium text-muted">&nbsp;(optional)</span></label
			>
			<textarea
				id="{id}-notes"
				name="notes"
				rows="2"
				maxlength="2000"
				class={TEXTAREA}
				aria-invalid={errors.notes ? 'true' : undefined}
				aria-describedby={errors.notes ? `${id}-notes-error` : undefined}>{typed.notes}</textarea
			>
			{#if errors.notes}<FieldError id="{id}-notes-error" message={errors.notes} />{/if}
		</div>
	</form>
{/snippet}

{#if unlinkingVia}
	<UnlinkVia
		{...unlinkingVia}
		onclose={() => (unlinkingVia = null)}
		onunlinked={() =>
			viaFocus && void focusAfterRemoval(viaFocus.keys, viaFocus.gone, viaFocus.fallback)}
	/>
{/if}
