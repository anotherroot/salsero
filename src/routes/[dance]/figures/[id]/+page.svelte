<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import StartPositions from '$lib/components/figures/StartPositions.svelte';
	import FigureTiming from '$lib/components/figures/FigureTiming.svelte';
	import VariationBar from '$lib/components/figures/VariationBar.svelte';
	import MoveSheet from '$lib/components/figures/MoveSheet.svelte';
	import RemoveWarning from '$lib/components/figures/RemoveWarning.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import UploadButton from '$lib/components/ui/UploadButton.svelte';
	import AppUploadLink from '$lib/components/ui/AppUploadLink.svelte';
	import { uploadLink } from '$lib/app-mode';
	import { page } from '$app/state';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import VideoSections from '$lib/components/lessons/VideoSections.svelte';
	import LinkSectionSheet from '$lib/components/ui/LinkSectionSheet.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import { logFor } from '$lib/components/exercises/kinds';
	import { PARTNER_LABEL } from '$lib/labels';
	import { frequencyLabel } from '$lib/frequency';
	import { dateLabel } from '$lib/format';
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
		if (failed('linkSection')) linkingSection = true;
	});
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

	/** "Open two hands / Cross-hand → Hammerlock", neutral already resolved by the graph. */
	const handholds = $derived(
		`${data.effective.starts.map(positionName).join(' / ') || neutralName} → ${
			data.effective.end === null ? neutralName : positionName(data.effective.end)
		}`
	);

	const figureHref = (id: number) =>
		resolve('/[dance]/figures/[id]', { dance: slug, id: String(id) });

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
	const closeOnArchive: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update();
			if (result.type === 'redirect') archiving = false;
		};
</script>

<svelte:head><title>{figure.name} · {variation.name} · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/[dance]/figures', { dance: slug })}
		class="grid size-11 shrink-0 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to figures">‹</a
	>
	<h1 class="flex min-w-0 flex-1 flex-col">
		<span class="truncate text-[17px] font-semibold">{figure.name}</span>
		<span class="truncate text-[13px] font-medium text-muted">{variation.name}</span>
	</h1>
	<!--
		Done SAVES: it submits the edit form (by `form=`, since the header is
		outside it). A refused save keeps you editing with the message showing, so
		nothing typed is lost; a successful one closes edit mode.
	-->
	{#if editing}
		<button
			type="submit"
			form="edit-form"
			class="h-10 rounded-lg px-3 text-[14px] font-medium text-accent">Done</button
		>
	{:else}
		<button
			type="button"
			class="h-10 rounded-lg px-3 text-[14px] font-medium text-accent"
			onclick={() => (editing = true)}>Edit</button
		>
	{/if}
</header>

<!-- The bottom padding clears the variation bar pinned over the end of the page. -->
<main class="space-y-6 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
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
		<section>
			<p class="text-[13px] text-muted">
				{#if styleLabel}{styleLabel} ·
				{/if}{PARTNER_LABEL[variation.partner]}
			</p>
			<p class="text-[13px] text-muted">
				Starts on {data.effective.startCount} · {data.effective.lengthCounts} counts
			</p>
			<p class="text-[13px] text-muted">{handholds}</p>
			{#if variation.notes}
				<LinkedText text={variation.notes} class="mt-2 text-[15px] whitespace-pre-line" />
			{/if}
		</section>

		{#if data.exercise && data.popup}
			<section class="flex items-center gap-3 rounded-xl border border-line bg-raised p-3">
				<div class="min-w-0 flex-1">
					<p class="text-[14px] font-medium">Practice</p>
					<a
						href={resolve('/[dance]/exercises/[id]', {
							dance: slug,
							id: String(data.exercise.id)
						})}
						class="text-[12px] text-accent"
						>{frequencyLabel(data.exercise.everyDays)}{data.exercise.active ? '' : ' · inactive'} · Exercise
						→</a
					>
				</div>
				<button
					type="button"
					class="h-11 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
					onclick={() => (logging = true)}>Log…</button
				>
			</section>
		{:else if !data.exercise}
			<form
				method="POST"
				action="?/practise"
				use:enhance
				class="flex items-center gap-3 rounded-xl border border-line bg-raised p-3"
			>
				<div class="min-w-0 flex-1">
					<p class="text-[14px] font-medium">Practice</p>
					<p class="text-[12px] text-muted">Practised through its routines.</p>
					{#if failed('practise')}
						<p class="text-[12px] text-danger" role="alert">{failed('practise')}</p>
					{/if}
				</div>
				<button
					type="submit"
					class="h-11 rounded-xl border border-rule px-4 text-[14px] font-semibold text-ink-2"
					>Practise on its own</button
				>
			</form>
		{/if}
	{/if}

	<section class="grid grid-cols-2 gap-3">
		{#each [{ title: 'Follows from', items: data.followsFrom }, { title: 'Leads to', items: data.leadsTo }] as list (list.title)}
			<div>
				<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">
					{list.title}
				</h2>
				{#if list.items.length === 0}
					<p class="text-[13px] text-muted">Nothing yet.</p>
				{:else}
					<ul class="space-y-1">
						{#each list.items as item (item.id)}
							<li><a class="text-[15px] text-accent" href={figureHref(item.id)}>{item.name}</a></li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</section>

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Recordings</h2>
		<ul class="space-y-3">
			{#each variation.recordings as rec (rec.id)}
				<li class="overflow-hidden rounded-xl border border-line bg-raised">
					{#if broken[rec.id] === 'missing'}
						<p class="p-4 text-[13px] text-muted">The file for this recording is missing.</p>
					{:else if broken[rec.id] === 'unplayable'}
						<p class="p-4 text-[13px] text-muted">
							This browser can't play this file.
							<a
								href={resolve('/recordings/[file]', { file: rec.file })}
								download
								class="font-medium text-accent">Download it</a
							>
							or open it on your phone.
						</p>
					{:else}
						<VideoFrame
							src="/recordings/{rec.file}"
							sourceUrl={rec.sourceUrl}
							kind={rec.kind}
							owner={{ recordingId: rec.id }}
							title="{figure.name} · {variation.name}"
							onproblem={(p) => (broken = { ...broken, [rec.id]: p })}
						/>
					{/if}
					<div class="flex items-center justify-between px-3 py-2 text-[12px] text-muted">
						<span
							>{dateLabel(localDay(rec.createdAt, timezone))} · {Math.max(
								1,
								Math.round(rec.sizeBytes / 1024 / 1024)
							)} MB</span
						>
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
								<button type="submit" class="h-9 px-2 text-danger">Delete</button>
							</form>
						{/if}
					</div>
					{#if form?.action === 'deleteRecording' && 'recordingId' in form && form.recordingId === rec.id}
						<p class="px-3 pb-2 text-[13px] text-danger" role="alert">{form.message}</p>
					{/if}
					<!-- Linking is done from the figure or drill a section shows; here a link
					     can be undone, archived target or not, so the recording can go. -->
					{#if (variation.recordingSections[rec.id] ?? []).length > 0}
						<VideoSections
							sections={variation.recordingSections[rec.id]}
							src="/recordings/{rec.file}"
							owner={{ recordingId: rec.id }}
						/>
					{/if}
				</li>
			{/each}
		</ul>
		<div class="mt-3">
			<!-- Keyed: the button holds upload state, and a step to another variation must not carry it over. -->
			{#key variation.id}
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
						label="+ Add video"
					/>
					<div class="mt-2">
						<UploadButton
							url="/api/figures/{variation.id}/recordings"
							accept="audio/*"
							label="+ Add audio"
						/>
					</div>
				{:else}
					<UploadButton
						url="/api/figures/{variation.id}/recordings"
						accept="video/*,audio/*"
						label="+ Add video or audio"
					/>
				{/if}
			{/key}
		</div>
	</section>

	<section>
		<div class="flex items-center justify-between">
			<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Sections</h2>
			<button
				type="button"
				class="mb-2 text-[13px] font-medium text-accent"
				onclick={() => (linkingSection = true)}>+ Link a section</button
			>
		</div>
		{#if variation.sections.length === 0}
			<p class="text-[13px] text-muted">Point at the part of a lesson video that shows this.</p>
		{:else}
			<ul class="space-y-2">
				{#each variation.sections as s (s.linkId)}
					<li>
						<SectionCard section={s}>
							{#snippet unlink()}
								<!-- Unlinking is an edit, like deleting a recording. -->
								{#if editing}
									<form method="POST" action="?/unlinkSection" use:enhance>
										<input type="hidden" name="linkId" value={s.linkId} />
										<button type="submit" class="h-9 px-2 text-[13px] text-muted">Unlink</button>
									</form>
								{/if}
							{/snippet}
						</SectionCard>
					</li>
				{/each}
			</ul>
		{/if}
		{#if failed('unlinkSection')}
			<p class="mt-2 text-[13px] text-danger" role="alert">{failed('unlinkSection')}</p>
		{/if}
	</section>

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Links</h2>
		<LinksEditor links={data.links} canSave message={linkFailure} entered={linkEntered} />
	</section>

	{#if data.taughtIn.length > 0}
		<section>
			<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Taught in</h2>
			<ul class="space-y-1">
				{#each data.taughtIn as lesson (lesson.id)}
					<li>
						<a
							class="text-[15px] text-accent"
							href={resolve('/[dance]/lessons/[id]', { dance: slug, id: String(lesson.id) })}
							>{lesson.title}</a
						>
						<span class="text-[12px] text-muted">· {dateLabel(lesson.lessonDay)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- What changes where the variation lives, kept at the end, out of the way. -->
	<section class="space-y-2 border-t border-line pt-5">
		<button
			type="button"
			aria-haspopup="dialog"
			onclick={() => (moving = true)}
			class="flex min-h-15 w-full items-center gap-3 rounded-xl border border-rule bg-raised px-3.5 py-2.5 text-left"
		>
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="shrink-0 text-ink-2"
				aria-hidden="true"><path d="M4 12h12M12 6l6 6-6 6" /><path d="M20 5v14" /></svg
			>
			<span class="flex min-w-0 flex-1 flex-col gap-0.5">
				<span class="text-[15px] font-semibold text-ink">Move {variation.name} to…</span>
				<span class="text-[12px] text-muted">A new figure of its own, or another figure</span>
			</span>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.4"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="shrink-0 text-muted"
				aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg
			>
		</button>
		<button
			type="button"
			aria-haspopup="dialog"
			onclick={() => (archiving = true)}
			class="h-11 w-full rounded-xl text-[14px] text-danger">Archive {variation.name}</button
		>
	</section>
</main>

<VariationBar
	figureName={figure.name}
	siblings={data.siblings}
	currentId={variation.id}
	{slug}
	failed={failed('createVariation')}
/>

<MoveSheet
	variation={variation.name}
	figure={figure.name}
	targets={data.moveTargets}
	{last}
	failed={failed('move')}
	typedName={form && 'action' in form && form.action === 'move' && 'name' in form
		? String(form.name)
		: null}
	open={moving}
	onclose={() => (moving = false)}
/>

<Sheet title="Archive {variation.name}?" open={archiving} onclose={() => (archiving = false)}>
	<form method="POST" action="?/archive" class="space-y-3" use:enhance={closeOnArchive}>
		{#if last}
			<RemoveWarning figure={figure.name} variation={variation.name} />
		{:else}
			<p class="text-[14px] text-ink-2">
				{variation.name} leaves {figure.name}. Its recordings and practice history are kept.
			</p>
		{/if}
		<div class="flex gap-2">
			<button
				type="button"
				onclick={() => (archiving = false)}
				class="h-12 flex-1 rounded-xl border border-rule text-[15px] font-semibold text-ink-2"
				>Cancel</button
			>
			<button
				type="submit"
				class="h-12 flex-[2] rounded-xl bg-danger text-[15px] font-semibold text-white"
				>{last ? 'Archive and remove figure' : `Archive ${variation.name}`}</button
			>
		</div>
	</form>
</Sheet>

<LinkSectionSheet
	open={linkingSection}
	onclose={() => (linkingSection = false)}
	groups={data.linkable}
	hidden={{}}
	message={failed('linkSection')}
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
