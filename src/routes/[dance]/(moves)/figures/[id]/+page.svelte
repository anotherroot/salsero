<script lang="ts">
	import { leaveRemoved } from '$lib/nav/trail.svelte';
	import { tick, untrack } from 'svelte';
	import { focusKeyed, focusAfterRemoval } from '$lib/focus';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { isClash } from '$lib/clash/clash';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import PositionTags from '$lib/components/figures/PositionTags.svelte';
	import FigureTiming from '$lib/components/figures/FigureTiming.svelte';
	import VariationBar from '$lib/components/figures/VariationBar.svelte';
	import FigureTabs from '$lib/components/figures/FigureTabs.svelte';
	import PaneColumns from '$lib/components/ui/PaneColumns.svelte';
	import MoveSheet from '$lib/components/figures/MoveSheet.svelte';
	import RemoveWarning from '$lib/components/figures/RemoveWarning.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import UploadButton from '$lib/components/ui/UploadButton.svelte';
	import { uploadLink } from '$lib/app-mode';
	import { page } from '$app/state';
	import { spotLabel } from '$lib/video/spots';
	import TopVideo from '$lib/components/figures/TopVideo.svelte';
	import SectionRow from '$lib/components/figures/SectionRow.svelte';
	import RecordingRow from '$lib/components/figures/RecordingRow.svelte';
	import RelationsCard from '$lib/components/figures/RelationsCard.svelte';
	import AddRecordingSheet from '$lib/components/figures/AddRecordingSheet.svelte';
	import LinkSectionSheet from '$lib/components/ui/LinkSectionSheet.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import AddLinkSheet from '$lib/components/links/AddLinkSheet.svelte';
	import LinkRow from '$lib/components/figures/LinkRow.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { cloneSubtitle, fromLessonNote, NOT_TAKEN, recordingMeta, TAKE } from '$lib/clones/view';
	import Versions from '$lib/components/clones/Versions.svelte';
	import ItemMenu from '$lib/components/clones/ItemMenu.svelte';
	import { hasMenu, type CloneOffers } from '$lib/clones/menu';
	import { menuLabel } from '$lib/menu';
	import { act } from '$lib/act';
	import { refusalMessage } from '$lib/act-toast';
	import Toast from '$lib/components/ui/Toast.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import MakeMineSheet from '$lib/components/clones/MakeMineSheet.svelte';
	import {
		button,
		DANGER_SHARED,
		GROUP,
		iconButton,
		SECTION_LABEL
	} from '$lib/components/ui/styles';
	import { PARTNER_LABEL } from '$lib/labels';
	import { byteSize, weekdayDayMonth } from '$lib/format';
	import {
		archiveCopy,
		deleteRecordingBody,
		figureMenuItems,
		figureSubtitle,
		recordingDay,
		recordingsCount,
		recordingsTitle,
		showRecordings,
		timingLine,
		topVideo
	} from '$lib/figures/page';
	import { styleLabelOf, tagsEmpty } from '$lib/positions/view';
	import { localDay } from '$lib/day/day';
	import { t } from '$lib/i18n/catalog';
	import type { SubmitFunction as KitSubmit } from '@sveltejs/kit';
	import type { ActionData, PageData, SubmitFunction } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	// A derived compares by value: the effect below re-runs only when the id changes,
	// not on every refresh of `data` (an action, an upload, a closed player).
	const variationId = $derived(data.variation.id);
	// Stepping to another variation keeps this page: leave edit mode for it.
	// `?edit=1` (a position's "+ Positions", ruling 8) opens in edit mode for an editor.
	$effect(() => {
		void variationId;
		editing = untrack(() => data.canEdit && page.url.searchParams.get('edit') === '1');
	});
	let linkingSection = $state(false);
	let moving = $state(false);
	let archiving = $state(false);
	$effect(() => {
		if (failed('move')) moving = true;
	});
	/** Recordings' `+ Add`: the sheet, and the page's own upload it starts (`UploadButton` with `bare`). */
	let adding = $state(false);
	let chooseVideo = $state<(() => void) | undefined>();
	/** Recordings whose file is missing or will not play here, as their rows found: never the top video. */
	let broken = $state<number[]>([]);

	const figure = $derived(data.figure);
	const variation = $derived(data.variation);
	/** A group's figure read by someone who cannot edit it: the group it is the group's. */
	const readerTeam = $derived(data.canEdit ? null : data.team);
	const slug = $derived(data.dance.slug);
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	/** Its figure's only variation: taking it away removes the figure. */
	const last = $derived(data.siblings.length === 1);
	/** `move`'s refusal with the field it is about, for the sheet to place. */
	const moveFailed = $derived(
		form && 'action' in form && form.action === 'move' && 'message' in form
			? {
					message: String(form.message),
					field: 'field' in form ? (form.field as 'name' | 'figureName') : null
				}
			: null
	);
	const failed = (action: string) =>
		form && 'action' in form && form.action === action && 'message' in form
			? String(form.message)
			: null;
	// The variation's real style tag, not the vestigial `figures.style` column.
	const styleLabel = $derived(
		variation.styleTag ? data.dance.styleLabel[variation.styleTag] : undefined
	);
	/** Handholds: the figure's own live tags; both sides empty, it fits anywhere. */
	const holds = $derived(data.handholds);
	const untagged = $derived(holds.starts.length === 0 && holds.ends.length === 0);
	// A position's own page. Built from a path, not the route id: `/[dance]/positions/[id]`
	// lands with the position page.
	const positionHref = (id: number) => resolve(`/${slug}/positions/${id}`);
	const timing = $derived(timingLine(data.effective.startCount, data.effective.lengthCounts));
	const archive = $derived(archiveCopy(figure.name, variation.name, last));
	let practising = $state(false);
	/** A reader's Edit: the Make it mine sheet (ruling 1). */
	let makingMine = $state(false);
	let uploading = $state(false);
	/** Sections and recordings: one list, Recordings. */
	const items = $derived(
		recordingsCount({
			sections: variation.sections.length,
			recordings: variation.recordings.length,
			links: data.links.length
		})
	);
	const empty = $derived(items === 0);
	const top = $derived(topVideo(variation.sections, variation.recordings, new Set(broken)));
	const today = $derived(localDay(Date.now(), timezone));

	const figureHref = (id: number) =>
		resolve('/[dance]/(moves)/figures/[id]', { dance: slug, id: String(id) });
	const routineHref = (id: number) =>
		resolve('/[dance]/(moves)/routines/[id]', { dance: slug, id: String(id) });

	/** A link row's post refused (Save, Retry, Remove): shown under the card. */
	const linkFailure = $derived(failed('saveVideo') ?? failed('retryVideo') ?? failed('deleteLink'));
	/** "Add a link" (slot 5's popup): open, and what a refused addLink hands back. */
	let addingLink = $state(false);
	const linkEntered = $derived(
		failed('addLink') && form && 'urls' in form ? String(form.urls) : ''
	);
	$effect(() => {
		if (failed('addLink')) addingLink = true;
	});
	// Removing a link: focus goes to the next link's trash, else the band's stop-editing.
	const removeLink =
		(id: number): KitSubmit =>
		() => {
			const keys = data.links.map((l) => `link-${l.id}`);
			return async ({ update, result }) => {
				await update();
				if (result.type === 'success') await focusAfterRemoval(keys, `link-${id}`, 'stop-editing');
			};
		};

	// --- Edit mode: the band's pencil, × to stop (asks if unsaved), one Save pinned.
	let editForm: HTMLFormElement | undefined = $state();
	let saving = $state(false);
	/** The last `update` refusal, until the next save or the next time editing starts. A new object each time, so its banner scrolls in again. */
	let refusal = $state<{ message: string } | null>(null);
	// The band button that was focused is replaced when edit mode flips, so hand focus to its successor.
	async function setEditing(on: boolean) {
		editing = on;
		await tick();
		// The page has a big header and a slim band, each with the button; one is inert.
		const key = on ? 'stop-editing' : 'start-editing';
		focusKeyed(key);
	}
	async function startEditing() {
		refusal = null;
		window.scrollTo({ top: 0 });
		await setEditing(true);
	}
	function stopEditing() {
		leaveOrAsk(editForm ?? null, () => void setEditing(false), 'Stop editing');
	}
	const closeOnSuccess: SubmitFunction = () => {
		saving = true;
		refusal = null;
		return async ({ update, result }) => {
			try {
				await update({ reset: false });
			} finally {
				saving = false;
			}
			if (result.type === 'success') await setEditing(false);
			// A clash or gone is the clash sheet's, which holds what was typed.
			else if (result.type === 'failure' && !isClash(result.data)) {
				const m = result.data?.message;
				refusal = { message: typeof m === 'string' ? m : 'It did not save.' };
			}
		};
	};
	/** A refusal that just arrived: bring it into view, gently unless motion is reduced. */
	function scrollIn(node: HTMLElement) {
		const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		node.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
	}

	// --- Deleting a recording: a question first, in place of the old confirm().
	let deleting = $state<{ id: number; body: string } | null>(null);
	let deleteBusy = $state(false);
	const deleteRecording: SubmitFunction = () => {
		deleteBusy = true;
		const keys = variation.recordings.map((r) => `recording-${r.id}`);
		const gone = `recording-${deleting?.id}`;
		return async ({ update, result }) => {
			try {
				await update();
			} finally {
				deleteBusy = false;
				// Any answer closes the question; a refusal shows in the recording's card.
				deleting = null;
			}
			// Already gone: show the list as it is now.
			if (result.type === 'failure' && result.status === 404) await invalidateAll();
			if (result.type === 'success') await focusAfterRemoval(keys, gone, 'stop-editing');
		};
	};
	const askDelete = (rec: { id: number; sizeBytes: number }, day: string) => {
		deleting = {
			id: rec.id,
			body: deleteRecordingBody(
				day,
				byteSize(rec.sizeBytes),
				(variation.recordingSections[rec.id] ?? []).length
			)
		};
	};
	// Unlinking a section: focus goes to the next section, else the band's stop-editing.
	const unlinkSection =
		(linkId: number): SubmitFunction =>
		() => {
			const keys = variation.sections.map((x) => `section-${x.linkId}`);
			return async ({ update, result }) => {
				await update();
				if (result.type === 'success')
					await focusAfterRemoval(keys, `section-${linkId}`, 'stop-editing');
			};
		};
	/** An action's refusal about one recording (a delete's, a take's), shown in its card. */
	const recordingRefusal = (action: string, id: number) => {
		if (!form || !('action' in form) || form.action !== action) return null;
		const answer = form as { recordingId?: unknown; message?: unknown };
		return answer.recordingId === id && typeof answer.message === 'string' ? answer.message : null;
	};
	const deleteRefusal = (id: number) => recordingRefusal('deleteRecording', id);
	// --- Take: one of a source's recordings into the person's copy (board C2 p2b).
	let takingId = $state<number | null>(null);
	const take: SubmitFunction = ({ formData, cancel }) => {
		// One take at a time: a second tap while the first is out is dropped.
		if (takingId !== null) return cancel();
		takingId = Number(formData.get('recordingId'));
		return async ({ update }) => {
			try {
				await update();
			} finally {
				takingId = null;
			}
		};
	};
	const takeRefusal = (id: number) => recordingRefusal('takeRecording', id);
	/** The page's own place, named on a source's tab: "Salsa Tuesdays’ version, read-only…". */
	const sourcePlace = $derived(
		data.cloneLine.self.kind === 'team' ? data.cloneLine.self.name : null
	);
	/** The band's subtitle: where a row of yours came from, else the usual one. */
	const subtitle = $derived(
		(data.cloneLine.self.kind === 'mine' ? cloneSubtitle(data.cloneLine) : null) ??
			figureSubtitle(data.effective, readerTeam?.name)
	);
	/** A group's figure read from a lesson the person added: the note above the columns. */
	const fromLesson = $derived(
		readerTeam && data.fromLesson && !data.taking
			? fromLessonNote(data.fromLesson, readerTeam.name)
			: null
	);
	/** The desktop tabs' "+ Figure": VariationBar's New figure sheet, the one for both. */
	let addingFigure = $state(false);
	/** A half of the edit form: no box below `two:`, a column of the form's own gap from it. */
	const EDIT_HALF = 'contents two:flex two:min-w-0 two:flex-col two:gap-3.5';

	/** Archive lands on a sibling (the same route, so the sheet would stay) or the figures list. */
	let archiveBusy = $state(false);
	const closeOnArchive: SubmitFunction = () => {
		archiveBusy = true;
		return async ({ update, result }) => {
			if (result.type === 'redirect') {
				// Close the sheet, then replace this page with the sibling or the list.
				archiving = false;
				try {
					await leaveRemoved(result.location);
				} finally {
					archiveBusy = false;
				}
				return;
			}
			try {
				await update();
			} finally {
				archiveBusy = false;
			}
		};
	};
	/** The band's ⋯ is open. */
	let menuOpen = $state(false);
	/** What the ⋯ offers of the copy actions (ItemMenu, mounted once below the page). */
	const offers = $derived<CloneOffers>({
		sync: data.keep.mode ? data.keep : null,
		drop: data.drop,
		detach: data.detach,
		copy: data.copyTo,
		sameAs: data.sameAs
	});
	/** Create exercise is on its way: the menu leaves it out, a toast says so. */
	let creating = $state(false);
	const exerciseHref = (id: number) =>
		resolve('/[dance]/(today)/exercises/[id]', { dance: slug, id: String(id) });
	/** The page's own ⋯ items (rework plan 2): Its exercise or Create exercise, History, Move, Archive. */
	const ownMenu = $derived(
		figureMenuItems(
			{
				canEdit: data.canEdit,
				reader: !!data.makeMine,
				practisable: data.practisable,
				exercise: data.exercise
					? { href: exerciseHref(data.exercise.id), line: data.practice?.text ?? 'Practice' }
					: null,
				historyHref: data.historyHref,
				variationName: variation.name,
				creating
			},
			{
				create: () => void createExercise(),
				move: () => (moving = true),
				archive: () => (archiving = true)
			}
		)
	);
	/** Create exercise answers here: the menu has closed by then. */
	let toast = $state<{ id: number; message: string; href?: string } | null>(null);
	let toastSeq = 0;
	async function createExercise() {
		creating = true;
		toast = { id: ++toastSeq, message: 'Adding to Today…' };
		let result;
		try {
			result = await act('practise', {});
		} finally {
			creating = false;
		}
		const refused = refusalMessage(result, 'Could not add it to Today.');
		const id = data.exercise?.id;
		toast = refused
			? { id: ++toastSeq, message: refused }
			: { id: ++toastSeq, message: 'On Today now', href: id ? exerciseHref(id) : undefined };
	}
</script>

<svelte:head><title>{figure.name} · {variation.name} · {data.dance.label}</title></svelte:head>

<!-- A recording's delete, while editing: asks first, in the Dialog below. -->
{#snippet trash(rec: { id: number; sizeBytes: number }, day: string)}
	<button
		data-focus="recording-{rec.id}"
		type="button"
		aria-label="Delete this recording"
		aria-haspopup="dialog"
		class={iconButton('bare', 'danger')}
		onclick={() => askDelete(rec, day)}><Icon name="trash" size={22} /></button
	>
{/snippet}

<!-- A source's recording not yet in the person's copy: Take brings it (board C2 p2b). -->
{#snippet takeButton(rec: { id: number })}
	<form method="POST" action="?/takeRecording" use:enhance={take}>
		<input type="hidden" name="recordingId" value={rec.id} />
		<input type="hidden" name="into" value={data.taking?.into} />
		<button
			type="submit"
			class={button('secondary', 'sm')}
			aria-busy={takingId === rec.id}
			disabled={takingId !== null}
		>
			<!-- Both in one cell: the label keeps the width while the spinner shows. -->
			<span class="grid place-items-center">
				<span class="col-start-1 row-start-1" class:invisible={takingId === rec.id}>{TAKE}</span>
				{#if takingId === rec.id}<span class="col-start-1 row-start-1"><Spinner size={18} /></span
					>{/if}
			</span>
		</button>
	</form>
{/snippet}

<Screen
	compact
	width="two"
	title="{figure.name} · {variation.name}"
	subtitle={editing ? `Editing ${variation.name}` : subtitle}
>
	{#snippet left()}
		{#if editing}
			<BandButton focusKey="stop-editing" icon="close" label="Stop editing" onclick={stopEditing} />
		{:else}
			<BackButton
				fallback={{
					href: resolve('/[dance]/(moves)/figures', { dance: slug }),
					label: 'Back to Moves'
				}}
			/>
		{/if}
	{/snippet}
	{#snippet right()}
		<!-- While editing, the Save pinned at the bottom saves and closes edit mode. A reader has no pencil. -->
		{#if !editing && data.canEdit}
			<BandButton focusKey="start-editing" icon="pencil" label="Edit" onclick={startEditing} />
		{/if}
		{#if !editing}
			{#if hasMenu(ownMenu, offers)}
				<BandButton
					icon="more"
					label={menuLabel('figure')}
					focusKey="item-menu"
					onclick={() => (menuOpen = true)}
				/>
			{/if}
		{/if}
	{/snippet}

	<!--
		The figure in its pane (desktop spec, "Two columns"): the move's figures as tabs
		and the source tabs under the header, then two columns from a 780 px pane, 5 : 7
		(about it on the left, what is watched on the right). One column below that and
		on the phone, in the phone's order. The tabs and Versions (whose toast is
		`fixed`) sit outside PaneColumns: nothing pinned lives in its size container.
	-->
	<div class="flex flex-col gap-2 {editing ? 'pb-28' : 'pb-4'}">
		{#if !editing}
			<FigureTabs
				moveName={figure.name}
				moveId={figure.id}
				siblings={data.siblings}
				currentId={variation.id}
				{slug}
				canEdit={data.canEdit}
				onnew={() => (addingFigure = true)}
			/>
			<Versions
				sources={data.sources}
				kind="figure"
				dance={slug}
				current={variation.id}
				mineId={data.mineId}
				self={data.cloneLine.self}
				title="{figure.name} · {variation.name}"
				family={data.family}
				step={data.step}
				keep={data.keep}
				taking={data.taking ? sourcePlace : null}
			/>
		{/if}
		<!--
			Editing: the form across the top, its own two halves from `two:`, and the
			recordings and sections (still `right`, so an upload in flight is never
			remounted) under its right half: the columns turn 1 : 1.
		-->
		<PaneColumns
			ratio={editing ? '1:1' : '5:7'}
			class="gap-2"
			top={editing || fromLesson ? colsTop : undefined}
			left={about}
			right={watched}
			leftEnd={editing ? undefined : aboutEnd}
		/>
		{#if !editing}
			<!-- The variation bar is pinned over the page's end; this lets the caption clear it. On the desktop only a reader's bar is pinned. -->
			<div
				aria-hidden="true"
				class={data.makeMine
					? 'h-[calc(8.5rem+var(--pin-safe,var(--safe-bottom)))] desk:h-[calc(4.5rem+var(--pin-safe,var(--safe-bottom)))]'
					: 'h-[calc(4.5rem+var(--pin-safe,var(--safe-bottom)))] desk:hidden'}
			></div>
		{/if}
	</div>
</Screen>

{#snippet colsTop()}
	{#if editing}
		<!--
			Keyed on the variation: `editing` survives a step to another one, and
			PositionTags and FigureTiming seed their own state once — without the
			key, one variation's unsaved positions and timing would be carried over
			and saved onto the next.
		-->
		{#key variation.id}
			<form
				id="edit-form"
				method="POST"
				action="?/update"
				class="flex flex-col gap-3.5 pt-1.5 two:grid two:grid-cols-[1fr_1fr] two:items-start two:gap-x-8"
				bind:this={editForm}
				use:guarded={{ label: `${variation.name} edits`, submit: closeOnSuccess }}
			>
				<!-- What this form saw: a save that saw another version is refused (the clash check). -->
				<input type="hidden" name="seen" value={JSON.stringify(data.seen)} />
				<div class={EDIT_HALF}>
					<!-- No Move name here: the move's own page renames it. -->
					<FigureFields
						dance={data.dance}
						name={variation.name}
						partner={variation.partner}
						style={variation.styleTag ?? undefined}
						notes={variation.notes}
					/>
				</div>
				<div class={EDIT_HALF}>
					<PositionTags
						dance={data.dance.slug}
						startIds={data.tags.startIds}
						endIds={data.tags.endIds}
						groups={data.positionChoices}
						figureLabel="{figure.name} · {variation.name}"
						figureStyle={variation.styleTag}
						styleLabel={styleLabelOf(data.dance.styleLabel)}
						figureId={variation.id}
					/>
					<FigureTiming startCount={data.shape.startCount} lengthCounts={data.shape.lengthCounts} />
					{#if refusal}
						<!-- Keyed on the answer: each refusal is brought into view as it arrives. -->
						{#key refusal}
							<div use:scrollIn>
								<Banner kind="error" title="Not saved">{refusal.message}</Banner>
							</div>
						{/key}
					{/if}
				</div>
			</form>
		{/key}
	{:else if fromLesson}
		<p
			class="flex items-start gap-2.5 rounded-2xl bg-accent-soft px-4 py-3 text-[14px] leading-snug text-accent-text"
		>
			<span class="mt-px flex-none"><Icon name="group" size={18} /></span>
			<span>{fromLesson}</span>
		</p>
	{/if}
{/snippet}

{#snippet about()}
	{#if !editing}
		{#if top}
			<TopVideo
				{top}
				title="{figure.name} · {variation.name}"
				day={top.kind === 'recording'
					? recordingDay(localDay(top.recording.createdAt, timezone), today)
					: ''}
				linking={data.canEdit}
				canEdit={data.canEdit}
				onclosed={() => void refreshWhenSettled()}
			/>
		{/if}
		<!-- The variation's own facts: style and partner, timing, handholds, notes. -->
		<section class="flex flex-col gap-3.5 rounded-2xl bg-surface p-4" aria-label="Facts">
			<div class="flex flex-wrap gap-1.5">
				{#if styleLabel}<Badge tone="accent">{styleLabel}</Badge>{/if}
				<Badge tone="neutral"
					><Icon
						name={variation.partner === 'partner' ? 'people' : 'solo'}
						size={14}
					/>{PARTNER_LABEL[variation.partner]}</Badge
				>
			</div>
			<div class="flex flex-col gap-2">
				<div class="flex items-baseline justify-between gap-3">
					<span class="text-[13px] font-bold text-muted">Timing</span>
					<span class="text-right text-[15px] font-bold text-ink"
						>{timing.main}<span class="font-medium text-muted">{timing.extra}</span></span
					>
				</div>
				<div role="img" aria-label="Starts on count {data.effective.startCount}" class="flex gap-1">
					{#each [1, 2, 3, 4, 5, 6, 7, 8] as count (count)}
						<span
							class="flex h-[30px] flex-1 items-center justify-center rounded-lg text-[14px] font-extrabold tabular-nums {count ===
							data.effective.startCount
								? 'bg-accent text-on-accent'
								: 'bg-chip text-ink-2'}">{count}</span
						>
					{/each}
				</div>
			</div>
			<div class="-mx-4 h-px bg-hairline"></div>
			<div class="flex flex-col gap-[3px]">
				<span class="text-[13px] font-bold text-muted">Positions</span>
				{#if untagged}
					<span class="text-[15px] leading-[1.35] font-bold text-ink">{tagsEmpty}</span>
				{:else}
					<!-- Each position links to its page; an empty side reads "No position". -->
					{#snippet side(refs: { id: number; name: string }[])}
						{#if refs.length === 0}
							<span class="font-semibold text-muted">No position</span>
						{:else}
							{#each refs as p, i (p.id)}{#if i > 0}<span class="mx-1 font-semibold text-muted"
										>or</span
									>{/if}<a href={positionHref(p.id)} class="underline-offset-2 hover:underline"
									>{p.name}</a
								>{/each}
						{/if}
					{/snippet}
					<span class="text-[15px] leading-[1.35] font-bold text-ink"
						>{@render side(holds.starts)}<span class="mx-1 font-semibold text-muted">→</span
						>{@render side(holds.ends)}</span
					>
				{/if}
			</div>
			{#if variation.notes}
				<div class="-mx-4 h-px bg-hairline"></div>
				<LinkedText
					text={variation.notes}
					class="text-[15px] leading-[1.45] font-medium whitespace-pre-line text-ink-2"
				/>
			{/if}
		</section>
	{/if}
{/snippet}

{#snippet watched()}
	<!--
		Recordings (figure page rework): the linked sections and the recordings in one
		card, `+ Add` in the heading row. While editing: each recording's delete and each
		section's Unlink. A reader with nothing here sees nothing. At the right column's
		top from `two:`, level with the video.
	-->
	{#if showRecordings({ canEdit: data.canEdit, items })}
		<section
			class="flex flex-col gap-2 pt-3.5 {editing ? '' : 'two:pt-0'}"
			class:hidden={editing && empty && !uploading}
		>
			<div class="flex min-h-11 items-center justify-between">
				<h2 class={SECTION_LABEL}>{recordingsTitle(items)}</h2>
				{#if data.canEdit && !editing}
					<button
						type="button"
						data-focus="recordings-add"
						class={button('tertiary', 'sm')}
						aria-label="Add to Recordings"
						aria-haspopup="dialog"
						onclick={() => (adding = true)}><Icon name="plus" size={20} />Add</button
					>
				{/if}
			</div>
			<!-- Keyed: the upload's state must not carry over to another variation. Mounted
			     in and out of edit mode, so a started upload is never remounted; it draws
			     only its progress card and a failure. -->
			{#if data.canEdit && !data.app}
				{#key variation.id}
					<UploadButton
						bare
						bind:chooser={chooseVideo}
						url="/api/figures/{variation.id}/recordings"
						accept="video/*"
						label="Add video"
						noun={t().shell.upload.nouns.recording}
						bind:busy={uploading}
					/>
				{/key}
			{/if}
			{#if !empty}
				<ul class={GROUP}>
					{#each variation.sections as s (s.linkId)}
						<!-- Unlinking is an edit, like deleting a recording. -->
						{#snippet unlink()}
							<form method="POST" action="?/unlinkSection" use:enhance={unlinkSection(s.linkId)}>
								<input type="hidden" name="linkId" value={s.linkId} />
								<button
									type="submit"
									class={button('tertiary', 'sm')}
									aria-label="Unlink {spotLabel(s.spot)} from {figure.name} · {variation.name}"
									aria-describedby={failed('unlinkSection') ? 'unlink-error' : undefined}
									>Unlink</button
								>
							</form>
						{/snippet}
						<li>
							<SectionRow
								section={s}
								focusKey="section-{s.linkId}"
								canEdit={data.canEdit}
								trailing={editing ? unlink : undefined}
							/>
						</li>
					{/each}
					{#each variation.recordings as rec (rec.id)}
						{@const day = recordingDay(localDay(rec.createdAt, timezone), today)}
						{@const refused = deleteRefusal(rec.id)}
						{@const held = data.taking?.held[rec.id] ?? false}
						{@const taken = takeRefusal(rec.id)}
						{#snippet recTrash()}{@render trash(rec, day)}{/snippet}
						{#snippet recTake()}{@render takeButton(rec)}{/snippet}
						<li>
							<RecordingRow
								recording={rec}
								{day}
								title="{figure.name} · {variation.name}"
								focusKey="recording-open-{rec.id}"
								linking={data.canEdit}
								canEdit={data.canEdit}
								meta={data.taking ? recordingMeta(held, byteSize(rec.sizeBytes)) : undefined}
								trailing={editing ? recTrash : data.taking && !held ? recTake : undefined}
								onproblem={() => {
									if (!broken.includes(rec.id)) broken = [...broken, rec.id];
								}}
								onclosed={() => void refreshWhenSettled()}
							/>
							{#if refused}
								<div class="px-4 pb-3">
									<Banner kind="error" title="Not deleted">{refused}</Banner>
								</div>
							{/if}
							{#if taken}
								<div class="px-4 pb-3">
									<Banner kind="error" title={NOT_TAKEN}>{taken}</Banner>
								</div>
							{/if}
						</li>
					{/each}
					{#each data.links as link (link.id)}
						<li>
							<LinkRow {link} canSave={data.canEdit} {editing} onremove={removeLink(link.id)} />
						</li>
					{/each}
				</ul>
			{/if}
			{#if failed('unlinkSection')}
				<FieldError id="unlink-error" message={failed('unlinkSection') ?? ''} />
			{/if}
			{#if linkFailure}
				<FieldError id="link-error" message={linkFailure} />
			{/if}
		</section>
	{/if}
{/snippet}

{#snippet aboutEnd()}
	<!-- What grows with use: three rows, each opening a sheet with search (option B2). -->
	<div class="pt-3.5">
		<RelationsCard
			follows={data.followsFrom}
			leads={data.leadsTo}
			routines={data.routines}
			mine={data.myRoutines}
			mineLabel={data.myRoutines.length > 0 ? (readerTeam?.name ?? data.team?.name ?? null) : null}
			{figureHref}
			{routineHref}
		/>
	</div>
	{#if data.taughtIn.length > 0}
		<h2 class="{SECTION_LABEL} pt-3.5">Taught in · {data.taughtIn.length}</h2>
		<ul class={GROUP}>
			{#each data.taughtIn as lesson (lesson.id)}
				<li>
					<a
						href={resolve('/[dance]/lessons/[id]', { dance: slug, id: String(lesson.id) })}
						class="flex min-h-[60px] items-center gap-2.5 py-2 pr-3.5 pl-4"
					>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[16px] leading-tight font-bold text-ink">{lesson.title}</span>
							<span class="text-[13px] text-muted">{weekdayDayMonth(lesson.lessonDay)}</span>
						</span>
						<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<!-- A reader's pinned row (board C1 p1): Edit makes the figure theirs; Practise logs or starts practising it. -->
{#snippet readerActions()}
	<button
		type="button"
		class={button('secondary', 'md', true)}
		aria-haspopup="dialog"
		onclick={() => (makingMine = true)}><Icon name="pencil" size={20} />Edit</button
	>
	{#if data.exercise}
		<!-- Practise opens the exercise page: Done, the history and the rest are there. -->
		<a
			href={resolve('/[dance]/(today)/exercises/[id]', {
				dance: slug,
				id: String(data.exercise.id)
			})}
			class={button('primary', 'md', true)}><Icon name="play" size={20} />Practise</a
		>
	{:else}
		<!-- Practise on its own; a group's figure only from a lesson the person added (R8). -->
		<form
			method="POST"
			action="?/practise"
			class="contents"
			use:enhance={() => {
				practising = true;
				return async ({ result, update }) => {
					try {
						// Its new exercise page opens: Practise always lands there.
						if (result.type === 'success' && typeof result.data?.exerciseId === 'number') {
							await goto(exerciseHref(result.data.exerciseId));
							return;
						}
						await update();
					} finally {
						practising = false;
					}
				};
			}}
		>
			<button
				type="submit"
				class={button('primary', 'md', true)}
				disabled={!data.practisable || practising}
				aria-busy={practising}><Icon name="play" size={20} />Practise</button
			>
		</form>
	{/if}
{/snippet}

{#if !editing}
	<VariationBar
		figureName={figure.name}
		moveId={data.figure.id}
		siblings={data.siblings}
		currentId={variation.id}
		{slug}
		failed={failed('createVariation')}
		canEdit={data.canEdit}
		actions={data.makeMine ? readerActions : undefined}
		bind:adding={addingFigure}
	/>
{/if}

{#if editing}
	<BottomBar mode>
		<button
			type="submit"
			form="edit-form"
			class={button('primary', 'md', true)}
			aria-busy={saving}
			disabled={saving}
		>
			{#if saving}<Spinner /><span class="sr-only">Saving…</span>{:else}<Icon
					name="check"
					size={20}
				/>Save{/if}
		</button>
	</BottomBar>
{/if}

{#if data.canEdit}
	<Dialog
		open={deleting !== null}
		title="Delete this recording?"
		icon="trash"
		tone="danger"
		body={deleting?.body}
		onclose={() => (deleting = null)}
	>
		{#snippet actions()}
			<button type="button" class={button('tertiary', 'sm')} onclick={() => (deleting = null)}
				>Cancel</button
			>
			<form method="POST" action="?/deleteRecording" use:enhance={deleteRecording}>
				<input type="hidden" name="recordingId" value={deleting?.id} />
				<button
					type="submit"
					class={button('danger', 'sm')}
					aria-busy={deleteBusy}
					disabled={deleteBusy}
				>
					<!-- Both in one cell: the label keeps the width while the spinner shows. -->
					<span class="grid place-items-center">
						<span class="col-start-1 row-start-1" class:invisible={deleteBusy}>Delete</span>
						{#if deleteBusy}<span class="col-start-1 row-start-1"><Spinner size={18} /></span>{/if}
					</span>
				</button>
			</form>
		{/snippet}
	</Dialog>

	<MoveSheet
		variation={variation.name}
		figure={figure.name}
		targets={data.moveTargets}
		{last}
		failed={moveFailed}
		typedName={form && 'action' in form && form.action === 'move' && 'name' in form
			? String(form.name)
			: null}
		open={moving}
		onclose={() => (moving = false)}
	/>

	<Sheet title={archive.title} open={archiving} onclose={() => (archiving = false)}>
		<form id="archive-form" method="POST" action="?/archive" use:enhance={closeOnArchive}>
			{#if last}
				<RemoveWarning figure={figure.name} variation={variation.name} kept />
			{:else}
				<p class="text-[15px] font-medium text-ink-2">{archive.caption}</p>
			{/if}
		</form>
		{#snippet footer()}
			<div class="grid grid-cols-[1fr_2fr] gap-2">
				<button
					type="button"
					onclick={() => (archiving = false)}
					class={button('secondary', 'md', true)}>Cancel</button
				>
				<button
					type="submit"
					form="archive-form"
					disabled={archiveBusy}
					aria-busy={archiveBusy}
					class={DANGER_SHARED}
					>{#if archiveBusy}<Spinner size={18} />{/if}{archive.button}</button
				>
			</div>
		{/snippet}
	</Sheet>

	<LinkSectionSheet
		open={linkingSection}
		onclose={() => (linkingSection = false)}
		groups={data.linkable}
		hidden={{}}
	/>

	<AddLinkSheet
		open={addingLink}
		onclose={() => (addingLink = false)}
		action="?/addLink"
		canSave
		message={failed('addLink')}
		entered={linkEntered}
	/>
	<AddRecordingSheet
		open={adding}
		onclose={() => (adding = false)}
		figureLabel="{figure.name} · {variation.name}"
		app={!!data.app}
		{uploading}
		appHref={uploadLink(
			{ figure: variation.id },
			{ back: page.url.pathname + page.url.search, name: `${figure.name} · ${variation.name}` }
		)}
		onsection={() => (linkingSection = true)}
		onvideo={() => chooseVideo?.()}
		onlink={() => (addingLink = true)}
	/>
{/if}

{#if data.makeMine}
	<MakeMineSheet open={makingMine} onclose={() => (makingMine = false)} offer={data.makeMine} />
{/if}

<!-- The ⋯ menu and its sheets, once: the band (drawn twice) only holds its button. -->
<ItemMenu
	bind:open={menuOpen}
	title={`${figure.name} · ${variation.name}`}
	kind="figure"
	current={variation.id}
	own={ownMenu}
	{offers}
/>

<!-- Create exercise's answer: the menu has closed, so it speaks here. -->
<Toast
	toast={toast && {
		id: toast.id,
		message: toast.message,
		action: toast.href ? 'Open' : undefined,
		icon: toast.href ? 'check' : undefined,
		tone: toast.href ? 'done' : undefined
	}}
	onaction={() => {
		const href = toast?.href;
		toast = null;
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved by exerciseHref
		if (href) void goto(href);
	}}
	ondismiss={() => (toast = null)}
/>
