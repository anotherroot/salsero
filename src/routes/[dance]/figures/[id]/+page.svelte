<script lang="ts">
	import { tick } from 'svelte';
	import { focusKeyed, focusAfterRemoval } from '$lib/focus';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import StartPositions from '$lib/components/figures/StartPositions.svelte';
	import FigureTiming from '$lib/components/figures/FigureTiming.svelte';
	import VariationBar from '$lib/components/figures/VariationBar.svelte';
	import MoveSheet from '$lib/components/figures/MoveSheet.svelte';
	import RemoveWarning from '$lib/components/figures/RemoveWarning.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import PickerOpener from '$lib/components/picker/PickerOpener.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import UploadButton from '$lib/components/ui/UploadButton.svelte';
	import VideoProblem from '$lib/components/ui/VideoProblem.svelte';
	import AppUploadLink from '$lib/components/ui/AppUploadLink.svelte';
	import { uploadLink } from '$lib/app-mode';
	import { page } from '$app/state';
	import { spotLabel } from '$lib/video/spots';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import VideoSections from '$lib/components/lessons/VideoSections.svelte';
	import LinkSectionSheet from '$lib/components/ui/LinkSectionSheet.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import {
		button,
		CLIP,
		DANGER_SHARED,
		FIELD,
		GROUP,
		iconButton,
		LABEL,
		SECTION_LABEL
	} from '$lib/components/ui/styles';
	import { logFor } from '$lib/components/exercises/kinds';
	import { PARTNER_LABEL } from '$lib/labels';
	import { frequencyLabel } from '$lib/frequency';
	import { byteSize, longDayLabel, plural } from '$lib/format';
	import {
		archiveCopy,
		deleteRecordingBody,
		recordingDay,
		routineUseMeta,
		timingLine
	} from '$lib/figures/page';
	import { localDay } from '$lib/day/day';
	import type { MediaProblem } from '$lib/media';
	import type { ActionData, PageData, SubmitFunction } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let editing = $state(false);
	// A derived compares by value: the effect below re-runs only when the id changes,
	// not on every refresh of `data` (an action, an upload, a closed player).
	const variationId = $derived(data.variation.id);
	// Stepping to another variation keeps this page: leave edit mode for it.
	$effect(() => {
		void variationId;
		editing = false;
	});
	let logging = $state(false);
	let linkingSection = $state(false);
	let moving = $state(false);
	let archiving = $state(false);
	$effect(() => {
		if (failed('move')) moving = true;
	});
	const FigureLog = logFor('figure');
	/**
	 * Recordings whose player failed, and why. "missing" means the server has no
	 * file; "unplayable" means the file is there but this browser cannot decode
	 * it — typically an iPhone HEVC .mov opened in desktop Chrome — so it is
	 * offered as a download instead of being reported as lost.
	 */
	let broken = $state<Record<number, MediaProblem>>({});

	const figure = $derived(data.figure);
	const variation = $derived(data.variation);
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
	const neutralName = $derived(data.positions.find((p) => p.neutral)?.name ?? 'the neutral hold');
	const positionName = (id: number) =>
		data.positions.find((p) => p.id === id)?.name ?? 'an untagged position';

	/** "Open two hands / Cross-hand" → "Hammerlock", neutral already resolved by the graph. */
	const handholds = $derived({
		from: data.effective.starts.map(positionName).join(' / ') || neutralName,
		to: data.effective.end === null ? neutralName : positionName(data.effective.end)
	});
	const timing = $derived(timingLine(data.effective.startCount, data.effective.lengthCounts));
	const archive = $derived(archiveCopy(figure.name, variation.name, last));
	let practising = $state(false);
	let uploading = $state(false);
	const empty = $derived(variation.recordings.length === 0);
	const today = $derived(localDay(Date.now(), timezone));

	const figureHref = (id: number) =>
		resolve('/[dance]/figures/[id]', { dance: slug, id: String(id) });
	const routineHref = (id: number) =>
		resolve('/[dance]/routines/[id]', { dance: slug, id: String(id) });

	const linkFailure = $derived(failed('addLink') ?? failed('saveVideo') ?? failed('retryVideo'));
	const linkEntered = $derived(form && 'urls' in form ? String(form.urls) : '');

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
			else if (result.type === 'failure') {
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
	const deleteRefusal = (id: number) =>
		form && 'action' in form && form.action === 'deleteRecording' && 'recordingId' in form
			? form.recordingId === id
				? String(form.message)
				: null
			: null;
	/** Archive lands on a sibling (the same route, so the sheet would stay) or the figures list. */
	let archiveBusy = $state(false);
	const closeOnArchive: SubmitFunction = () => {
		archiveBusy = true;
		return async ({ update, result }) => {
			try {
				await update();
			} finally {
				archiveBusy = false;
			}
			if (result.type === 'redirect') archiving = false;
		};
	};
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

<Screen
	compact
	title={figure.name}
	subtitle={editing ? `Editing ${variation.name}` : variation.name}
>
	{#snippet left()}
		{#if editing}
			<BandButton focusKey="stop-editing" icon="close" label="Stop editing" onclick={stopEditing} />
		{:else}
			<BandButton
				icon="back"
				label="Back to Moves"
				href={resolve('/[dance]/figures', { dance: slug })}
			/>
		{/if}
	{/snippet}
	{#snippet right()}
		<!-- While editing, the Save pinned at the bottom saves and closes edit mode. -->
		{#if !editing}
			<BandButton focusKey="start-editing" icon="pencil" label="Edit" onclick={startEditing} />
		{/if}
	{/snippet}

	<div class="flex flex-col gap-2 {editing ? 'pb-28' : 'pb-4'}">
		{#if editing}
			<!--
			Keyed on the variation: `editing` survives a step to another one, and
			StartPositions and FigureTiming seed their own state once — without the
			key, one variation's unsaved positions and timing would be carried over
			and saved onto the next.
		-->
			{#key variation.id}
				<form
					id="edit-form"
					method="POST"
					action="?/update"
					class="flex flex-col gap-3.5 pt-1.5"
					bind:this={editForm}
					use:guarded={{ label: `${variation.name} edits`, submit: closeOnSuccess }}
				>
					<FigureFields
						dance={data.dance}
						figureName={figure.name}
						figureHelp={data.siblings.length > 1
							? `Shared by its ${plural(data.siblings.length, 'variation', 'variations')}`
							: undefined}
						name={variation.name}
						partner={variation.partner}
						style={variation.styleTag ?? undefined}
						notes={variation.notes}
					/>
					<StartPositions positions={data.positions} initial={data.tags.startIds} {neutralName} />
					<div>
						<label class={LABEL} for="edit-end">Ends at</label>
						<div class="relative">
							<select
								id="edit-end"
								name="endId"
								class="own-arrow {FIELD} cursor-pointer appearance-none pr-10"
							>
								<option value="" selected={data.tags.endId === null}>{neutralName}</option>
								{#each data.positions as position (position.id)}
									<option value={position.id} selected={data.tags.endId === position.id}>
										{position.name}{position.archived ? ' (archived)' : ''}
									</option>
								{/each}
							</select>
							<span
								class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted"
								aria-hidden="true"><Icon name="chevron-down" size={20} /></span
							>
						</div>
					</div>
					<FigureTiming startCount={data.shape.startCount} lengthCounts={data.shape.lengthCounts} />
					{#if refusal}
						<!-- Keyed on the answer: each refusal is brought into view as it arrives. -->
						{#key refusal}
							<div use:scrollIn>
								<Banner kind="error" title="Not saved">{refusal.message}</Banner>
							</div>
						{/key}
					{/if}
				</form>
			{/key}
		{:else}
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
					<div
						role="img"
						aria-label="Starts on count {data.effective.startCount}"
						class="flex gap-1"
					>
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
					<span class="text-[13px] font-bold text-muted">Handholds</span>
					<span class="text-[15px] leading-[1.35] font-bold text-ink"
						>{handholds.from} <span class="font-semibold text-muted">→</span>
						{handholds.to}</span
					>
				</div>
				{#if variation.notes}
					<div class="-mx-4 h-px bg-hairline"></div>
					<LinkedText
						text={variation.notes}
						class="text-[15px] leading-[1.45] font-medium whitespace-pre-line text-ink-2"
					/>
				{/if}
			</section>

			<h2 class="{SECTION_LABEL} pt-2">Practice</h2>
			{#if data.exercise && data.popup}
				{@const popup = data.popup}
				<ul class={GROUP}>
					<li class="flex min-h-[60px] items-center gap-2.5 py-2 pr-1.5 pl-4">
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[16px] leading-tight font-bold text-ink"
								>{data.practice?.title ?? frequencyLabel(data.exercise.everyDays)}</span
							>
							{#if data.practice}
								<span
									class="text-[13px] {data.practice.meta.tone === 'status'
										? 'font-bold text-status'
										: data.practice.meta.tone === 'done'
											? 'font-bold text-done'
											: 'text-muted'}">{data.practice.meta.text}</span
								>
							{/if}
						</span>
						<button
							type="button"
							class={iconButton('bare', 'accent')}
							aria-label="Log {popup.exercise.name}"
							aria-haspopup="dialog"
							onclick={() => (logging = true)}><Icon name="plus" size={24} /></button
						>
					</li>
					<li>
						<a
							href={resolve('/[dance]/exercises/[id]', {
								dance: slug,
								id: String(data.exercise.id)
							})}
							class="flex min-h-[60px] items-center gap-2.5 py-2 pr-3.5 pl-4"
						>
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-[16px] leading-tight font-bold text-ink">Its exercise</span>
								<span class="text-[13px] text-muted">History, how often, active</span>
							</span>
							<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
						</a>
					</li>
				</ul>
			{:else if !data.exercise}
				<form
					method="POST"
					action="?/practise"
					use:enhance={() => {
						practising = true;
						return async ({ update }) => {
							try {
								await update();
							} finally {
								practising = false;
							}
						};
					}}
					class={GROUP}
				>
					<div class="flex min-h-[60px] items-center gap-2.5 py-2 pr-1.5 pl-4">
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[16px] leading-tight font-bold text-ink">Via routines</span>
							<span class="text-[13px] text-muted">No exercise of its own</span>
						</span>
						<button
							type="submit"
							class={button('secondary', 'sm')}
							aria-busy={practising}
							disabled={practising}
							aria-describedby={failed('practise') ? 'practise-error' : undefined}
						>
							<!-- Both in one cell: the label keeps the width while the spinner shows. -->
							<span class="grid place-items-center">
								<span class="col-start-1 row-start-1" class:invisible={practising}
									>Practise on its own</span
								>
								{#if practising}<span class="col-start-1 row-start-1"><Spinner /></span>{/if}
							</span>
						</button>
					</div>
				</form>
				{#if failed('practise')}
					<FieldError id="practise-error" message={failed('practise') ?? ''} />
				{/if}
			{/if}

			<h2 class="{SECTION_LABEL} pt-2">
				{data.routines.length > 0 ? `In routines · ${data.routines.length}` : 'In routines'}
			</h2>
			{#if data.routines.length === 0}
				<p class="rounded-2xl bg-surface px-4 py-3.5 text-[15px] font-bold text-status">
					Not in a routine yet
				</p>
			{:else}
				<ul class={GROUP}>
					{#each data.routines as use (use.id)}
						<li>
							<a
								href={routineHref(use.id)}
								class="flex min-h-[60px] items-center gap-2.5 py-2 pr-3.5 pl-4"
							>
								<span class="flex min-w-0 flex-1 flex-col gap-0.5">
									<span class="text-[16px] leading-tight font-bold text-ink">{use.name}</span>
									<span class="text-[13px] text-muted"
										>{routineUseMeta(use)}{use.loops ? ' · ' : ''}{#if use.loops}
											<span class="font-bold text-done">loops</span>{/if}</span
									>
								</span>
								<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}

			{#each [{ title: 'Follows from', items: data.followsFrom }, { title: 'Leads to', items: data.leadsTo }] as list, i (list.title)}
				<h2 class="{SECTION_LABEL} {i === 0 ? 'pt-2' : 'pt-1.5'}">{list.title}</h2>
				{#if list.items.length === 0}
					<p class="rounded-2xl bg-surface px-4 py-3.5 text-[14px] text-muted">Nothing yet</p>
				{:else}
					<ul class={GROUP}>
						{#each list.items as item (item.id)}
							<li>
								<a
									href={figureHref(item.id)}
									class="flex min-h-12 items-center gap-2.5 py-2 pr-3.5 pl-4"
								>
									<span class="min-w-0 flex-1 text-[16px] leading-tight font-bold text-ink"
										>{item.name}</span
									>
									<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			{/each}
		{/if}

		<!-- While editing: the recordings with their delete, and the linked sections with Unlink. -->
		<section class="flex flex-col gap-3 pt-3.5" class:hidden={editing && empty && !uploading}>
			{#if !editing || !empty}
				<h2 class="{SECTION_LABEL} -mb-1.5">
					{!empty ? `Recordings · ${variation.recordings.length}` : 'Recordings'}
				</h2>
			{/if}
			{#if variation.recordings.length > 0}
				<ul class="flex flex-col gap-3">
					{#each variation.recordings as rec (rec.id)}
						{@const day = recordingDay(localDay(rec.createdAt, timezone), today)}
						{@const refused = deleteRefusal(rec.id)}
						{#snippet recTrash()}{@render trash(rec, day)}{/snippet}
						<li class="{CLIP} rounded-2xl bg-surface">
							{#if broken[rec.id] === 'missing'}
								<VideoProblem
									title="This file is missing"
									body="The server has no file for this recording."
									meta="{day} · {byteSize(rec.sizeBytes)}"
								>
									{#snippet action()}
										{#if editing}{@render trash(rec, day)}{/if}
									{/snippet}
								</VideoProblem>
							{:else if broken[rec.id] === 'unplayable'}
								<VideoProblem
									title="Can’t play here"
									body="This browser can’t play this file. Download it or open it on your phone."
									meta="{day} · {byteSize(rec.sizeBytes)}"
								>
									{#snippet action()}
										{#if editing}
											{@render trash(rec, day)}
										{:else}
											<a
												href={resolve('/recordings/[file]', { file: rec.file })}
												download
												class={button('tertiary', 'sm')}
												><Icon name="download" size={18} />Download</a
											>
										{/if}
									{/snippet}
								</VideoProblem>
							{:else}
								<VideoFrame
									src="/recordings/{rec.file}"
									sourceUrl={rec.sourceUrl}
									kind={rec.kind}
									owner={{ recordingId: rec.id }}
									title="{figure.name} · {variation.name}"
									caption={{ title: day, meta: byteSize(rec.sizeBytes) }}
									onproblem={(p) => (broken = { ...broken, [rec.id]: p })}
									onclosed={() => void refreshWhenSettled()}
									linking
									action={editing ? recTrash : undefined}
									sections={variation.recordingSections[rec.id]}
								/>
							{/if}
							{#if refused}
								<div class="px-4 pb-3">
									<Banner kind="error" title="Not deleted">{refused}</Banner>
								</div>
							{/if}
							<!-- Linking is done from the figure or drill a section shows; here a link
					     can be undone, archived target or not, so the recording can go. -->
							{#if (variation.recordingSections[rec.id] ?? []).length > 0}
								<VideoSections
									sections={variation.recordingSections[rec.id]}
									src="/recordings/{rec.file}"
									owner={{ recordingId: rec.id }}
									linking
									unlink={editing}
								/>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			<!-- Keyed: the buttons hold upload state, and a step to another variation must not carry it over.
			     One tree whether or not it sits in the empty card (or is hidden while editing), so a
			     started upload is not remounted. While a file goes up its own card stands alone. -->
			{#key variation.id}
				<div
					class={empty && !uploading
						? 'flex flex-col gap-3 rounded-2xl bg-surface p-4'
						: 'flex flex-col'}
					class:hidden={editing && !uploading}
				>
					{#if empty && !uploading}
						<div class="flex items-center gap-3">
							<span
								class="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
								><Icon name="video" size={22} /></span
							>
							<span class="flex flex-col gap-0.5">
								<span class="text-[16px] font-bold">No recordings yet</span>
								<span class="text-[13px] text-muted">Film it after class, or add a voice note</span>
							</span>
						</div>
					{/if}
					{#if data.app}
						<!-- Video goes to the app to compress; audio is small and stays a page upload. -->
						<AppUploadLink
							href={uploadLink(
								{ figure: variation.id },
								{
									back: page.url.pathname + page.url.search,
									name: `${figure.name} · ${variation.name}`
								}
							)}
							label="Add video"
							kind={empty ? 'primary' : 'secondary'}
						/>
						<div class="mt-3">
							<UploadButton
								url="/api/figures/{variation.id}/recordings"
								accept="audio/*"
								icon="mic"
								label="Add audio"
								noun="recording"
								bind:busy={uploading}
							/>
						</div>
					{:else}
						<UploadButton
							url="/api/figures/{variation.id}/recordings"
							accept="video/*,audio/*"
							label="Add video or audio"
							noun="recording"
							kind={empty ? 'primary' : 'secondary'}
							size={empty ? 'sm' : 'md'}
							bind:busy={uploading}
						/>
					{/if}
				</div>
			{/key}
		</section>

		{#if !editing || variation.sections.length > 0}
			<section class="pt-4">
				<div class="flex min-h-11 items-center justify-between pr-1.5">
					<h2 class={SECTION_LABEL}>
						{variation.sections.length > 0 ? `Sections · ${variation.sections.length}` : 'Sections'}
					</h2>
				</div>
				<div class="mt-1">
					{#if variation.sections.length === 0}
						<p class="rounded-2xl bg-surface px-4 py-3.5 text-[14px] text-muted">
							Point at the part of a lesson video that shows this.
						</p>
					{:else}
						<ul class="flex flex-col gap-2">
							{#each variation.sections as s (s.linkId)}
								<li>
									<SectionCard section={s} focusKey="section-{s.linkId}">
										{#snippet unlink()}
											<!-- Unlinking is an edit, like deleting a recording. -->
											{#if editing}
												<form
													method="POST"
													action="?/unlinkSection"
													use:enhance={unlinkSection(s.linkId)}
												>
													<input type="hidden" name="linkId" value={s.linkId} />
													<button
														type="submit"
														class={button('tertiary', 'sm')}
														aria-label="Unlink {spotLabel(
															s.spot
														)} from {figure.name} · {variation.name}"
														aria-describedby={failed('unlinkSection') ? 'unlink-error' : undefined}
														>Unlink</button
													>
												</form>
											{/if}
										{/snippet}
									</SectionCard>
								</li>
							{/each}
						</ul>
					{/if}
					{#if failed('unlinkSection')}
						<FieldError id="unlink-error" message={failed('unlinkSection') ?? ''} />
					{/if}
					<!-- Links are added while reading; editing only takes them away. -->
					{#if !editing}
						<div class="mt-2">
							<PickerOpener label="Link a section…" onclick={() => (linkingSection = true)} />
						</div>
					{/if}
				</div>
			</section>
		{/if}

		{#if !editing}
			<section class="pt-4">
				<h2 class={SECTION_LABEL}>
					{data.links.length > 0 ? `Links · ${data.links.length}` : 'Links'}
				</h2>
				<div class="mt-1">
					<LinksEditor links={data.links} canSave message={linkFailure} entered={linkEntered} />
				</div>
			</section>
		{/if}

		{#if !editing}
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
									<span class="text-[13px] text-muted">{longDayLabel(lesson.lessonDay)}</span>
								</span>
								<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}

			<!-- What changes where the variation lives, kept at the end, out of the way. -->
			<div class="mt-[18px] mb-[10px] h-px bg-hairline"></div>
			<div class={GROUP}>
				<button
					type="button"
					aria-haspopup="dialog"
					onclick={() => (moving = true)}
					class="flex min-h-16 w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
				>
					<span
						class="flex size-10 flex-none items-center justify-center rounded-full bg-chip text-ink-2"
						><Icon name="move-to" size={22} /></span
					>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-[16px] leading-tight font-bold text-ink"
							>Move {variation.name} to…</span
						>
						<span class="text-[13px] text-muted">A new figure of its own, or another figure</span>
					</span>
					<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
				</button>
			</div>
			<button
				type="button"
				aria-haspopup="dialog"
				onclick={() => (archiving = true)}
				class={button('danger-text', 'md', true)}
				><Icon name="trash" size={20} />Archive {variation.name}</button
			>
			<p class="px-4 text-center text-[13px] text-muted">{archive.caption}</p>
			<!-- The variation bar is pinned over the page's end; this lets the caption clear it. -->
			<div aria-hidden="true" class="h-[calc(4.5rem+var(--safe-bottom))]"></div>
		{/if}
	</div>
</Screen>

{#if !editing}
	<VariationBar
		figureName={figure.name}
		siblings={data.siblings}
		currentId={variation.id}
		{slug}
		failed={failed('createVariation')}
	/>
{/if}

{#if editing}
	<BottomBar>
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

{#if logging && data.popup}
	<FigureLog
		dance={data.dance}
		exercise={data.popup.exercise}
		sets={data.popup.sets}
		songs={data.popup.songs}
		takes={data.popup.takes}
		backfillDay={null}
		{timezone}
		message={failed('log')}
		onclose={() => (logging = false)}
	/>
{/if}
