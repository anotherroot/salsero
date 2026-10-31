<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import StartPositions from '$lib/components/figures/StartPositions.svelte';
	import FigureTiming from '$lib/components/figures/FigureTiming.svelte';
	import VariationBar from '$lib/components/figures/VariationBar.svelte';
	import MoveSheet from '$lib/components/figures/MoveSheet.svelte';
	import RemoveWarning from '$lib/components/figures/RemoveWarning.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import UploadButton from '$lib/components/ui/UploadButton.svelte';
	import VideoProblem from '$lib/components/ui/VideoProblem.svelte';
	import AppUploadLink from '$lib/components/ui/AppUploadLink.svelte';
	import { uploadLink } from '$lib/app-mode';
	import { page } from '$app/state';
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
	import { button, GROUP, iconButton, SECTION_LABEL } from '$lib/components/ui/styles';
	import { logFor } from '$lib/components/exercises/kinds';
	import { PARTNER_LABEL } from '$lib/labels';
	import { frequencyLabel } from '$lib/frequency';
	import { byteSize, longDayLabel } from '$lib/format';
	import { archiveCopy, recordingDay, routineUseMeta, timingLine } from '$lib/figures/page';
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
					field: ('field' in form ? (form.field as 'name' | 'figureName') : null) ?? null
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

	const errorBox = 'rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger';
	const closeOnSuccess: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update({ reset: false });
			if (result.type === 'success') editing = false;
		};
	/** Archive lands on a sibling (the same route, so the sheet would stay) or the figures list. */
	let archiveBusy = $state(false);
	const closeOnArchive: SubmitFunction = () => {
		archiveBusy = true;
		return async ({ update, result }) => {
			await update();
			archiveBusy = false;
			if (result.type === 'redirect') archiving = false;
		};
	};
</script>

<svelte:head><title>{figure.name} · {variation.name} · {data.dance.label}</title></svelte:head>

<Screen compact title={figure.name} subtitle={variation.name}>
	{#snippet left()}
		<BandButton
			icon="back"
			label="Back to Moves"
			href={resolve('/[dance]/figures', { dance: slug })}
		/>
	{/snippet}
	{#snippet right()}
		<!-- While editing, the form's own Save saves and closes edit mode. -->
		{#if !editing}
			<BandButton
				icon="pencil"
				label="Edit"
				onclick={() => {
					editing = true;
					window.scrollTo({ top: 0 });
				}}
			/>
		{/if}
	{/snippet}

	<div class="flex flex-col gap-2 pb-4">
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
					class="space-y-3"
					use:guarded={{ label: `${variation.name} edits`, submit: closeOnSuccess }}
				>
					<FigureFields
						dance={data.dance}
						figureName={figure.name}
						name={variation.name}
						partner={variation.partner}
						style={variation.styleTag ?? undefined}
						notes={variation.notes}
					/>
					<StartPositions positions={data.positions} initial={data.tags.startIds} {neutralName} />
					<label class="block">
						<span class="text-[13px] font-medium">Ends at</span>
						<select
							name="endId"
							class="mt-1 h-11 w-full rounded-xl border border-line bg-raised px-3 text-[15px]"
						>
							<option value="" selected={data.tags.endId === null}>{neutralName}</option>
							{#each data.positions as position (position.id)}
								<option value={position.id} selected={data.tags.endId === position.id}>
									{position.name}{position.archived ? ' (archived)' : ''}
								</option>
							{/each}
						</select>
					</label>
					<FigureTiming startCount={data.shape.startCount} lengthCounts={data.shape.lengthCounts} />
					{#if failed('update')}
						<p class={errorBox} role="alert">{failed('update')}</p>
					{/if}
					<button
						type="submit"
						class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
						>Save</button
					>
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
							class={iconButton('bare').replace('text-ink', 'text-accent')}
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

		<section class="flex flex-col gap-3 pt-3.5">
			<h2 class="{SECTION_LABEL} -mb-1.5">
				{!empty ? `Recordings · ${variation.recordings.length}` : 'Recordings'}
			</h2>
			{#if variation.recordings.length > 0}
				<ul class="flex flex-col gap-3">
					{#each variation.recordings as rec (rec.id)}
						{@const day = recordingDay(localDay(rec.createdAt, timezone), today)}
						<li class="overflow-hidden rounded-2xl bg-surface">
							{#if broken[rec.id] === 'missing'}
								<VideoProblem
									title="This file is missing"
									body="The server has no file for this recording."
									meta="{day} · {byteSize(rec.sizeBytes)}"
								/>
							{:else if broken[rec.id] === 'unplayable'}
								<VideoProblem
									title="Can’t play here"
									body="This browser can’t play this file. Download it or open it on your phone."
									meta="{day} · {byteSize(rec.sizeBytes)}"
								>
									{#snippet action()}
										<a
											href={resolve('/recordings/[file]', { file: rec.file })}
											download
											class={button('tertiary', 'sm')}><Icon name="download" size={18} />Download</a
										>
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
									onclosed={() => void invalidateAll()}
									linking
								>
									{#snippet action()}
										<!-- Deleting is an edit; adding a recording stays one tap away in view mode. -->
										{#if editing}
											<form
												method="POST"
												action="?/deleteRecording"
												use:enhance
												onsubmit={(e) => {
													if (!confirm('Delete this recording?')) e.preventDefault();
												}}
											>
												<input type="hidden" name="recordingId" value={rec.id} />
												<button
													type="submit"
													aria-label="Delete this recording"
													class="{iconButton('bare')} text-danger"
													><Icon name="trash" size={22} /></button
												>
											</form>
										{/if}
									{/snippet}
								</VideoFrame>
							{/if}
							{#if form?.action === 'deleteRecording' && 'recordingId' in form && form.recordingId === rec.id}
								<p class="px-4 pb-2 text-[13px] text-danger" role="alert">{form.message}</p>
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
			     One tree whether or not it sits in the empty card, so a started upload is not remounted. -->
			{#key variation.id}
				<div class={empty ? 'flex flex-col gap-3 rounded-2xl bg-surface p-4' : 'flex flex-col'}>
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
								bind:busy={uploading}
							/>
						</div>
					{:else}
						<UploadButton
							url="/api/figures/{variation.id}/recordings"
							accept="video/*,audio/*"
							label="Add video or audio"
							kind={empty ? 'primary' : 'secondary'}
							size={empty ? 'sm' : 'md'}
							bind:busy={uploading}
						/>
					{/if}
				</div>
			{/key}
		</section>

		<section class="pt-4">
			<div class="flex items-center justify-between pr-1.5">
				<h2 class={SECTION_LABEL}>
					{variation.sections.length > 0 ? `Sections · ${variation.sections.length}` : 'Sections'}
				</h2>
				<button
					type="button"
					class={button('tertiary', 'sm')}
					aria-haspopup="dialog"
					onclick={() => (linkingSection = true)}
					><Icon name="link" size={18} />Link a section</button
				>
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
								<SectionCard section={s}>
									{#snippet unlink()}
										<!-- Unlinking is an edit, like deleting a recording. -->
										{#if editing}
											<form method="POST" action="?/unlinkSection" use:enhance>
												<input type="hidden" name="linkId" value={s.linkId} />
												<button
													type="submit"
													class={button('tertiary', 'sm')}
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
			</div>
		</section>

		<section class="pt-4">
			<h2 class={SECTION_LABEL}>
				{data.links.length > 0 ? `Links · ${data.links.length}` : 'Links'}
			</h2>
			<div class="mt-1">
				<LinksEditor links={data.links} canSave message={linkFailure} entered={linkEntered} />
			</div>
		</section>

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
			<div aria-hidden="true" class="h-[calc(4.5rem+env(safe-area-inset-bottom))]"></div>
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
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => (archiving = false)}
				class="{button('secondary', 'md', true)} flex-1!">Cancel</button
			>
			<button
				type="submit"
				form="archive-form"
				disabled={archiveBusy}
				aria-busy={archiveBusy}
				class="{button('danger', 'md', true)} flex-[2]! px-3!"
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
