<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import StartPositions from '$lib/components/figures/StartPositions.svelte';
	import FigureTiming from '$lib/components/figures/FigureTiming.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import UploadButton from '$lib/components/ui/UploadButton.svelte';
	import VideoFrame from '$lib/components/ui/VideoFrame.svelte';
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
	let logging = $state(false);
	let addingVariation = $state(false);
	const FigureLog = logFor('figure');
	/**
	 * Recordings whose player failed, and why. "missing" means the server has no
	 * file; "unplayable" means the file is there but this browser cannot decode
	 * it — typically an iPhone HEVC .mov opened in desktop Chrome — so it is
	 * offered as a download instead of being reported as lost.
	 */
	let broken = $state<Record<number, MediaProblem>>({});

	const figure = $derived(data.figure);
	const version = $derived(data.version);
	const slug = $derived(data.dance.slug);
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const failed = (action: string) =>
		form && 'action' in form && form.action === action && 'message' in form
			? String(form.message)
			: null;
	// The figure's real style tag, not the vestigial `figure.style` column.
	const styleLabel = $derived(figure.styleTag ? data.dance.styleLabel[figure.styleTag] : undefined);
	const neutralName = $derived(data.positions.find((p) => p.neutral)?.name ?? 'the neutral hold');
	const positionName = (id: number) =>
		data.positions.find((p) => p.id === id)?.name ?? 'an untagged position';

	/** On a variation, what it leaves to Basic — marked "(as Basic)" in view mode. */
	const asBasic = $derived({
		starts: version.isVariation && data.tags.startIds.length === 0,
		end: version.isVariation && data.tags.endId === null,
		startCount: version.isVariation && data.own.startCount === null,
		lengthCounts: version.isVariation && data.own.lengthCounts === null
	});
	const mark = (inherited: boolean) => (inherited ? ' (as Basic)' : '');

	/** "Open two hands / Cross-hand → Hammerlock", neutral already resolved by the graph. */
	const handholds = $derived(
		`${data.effective.starts.map(positionName).join(' / ') || neutralName}${mark(asBasic.starts)} → ${
			data.effective.end === null ? neutralName : positionName(data.effective.end)
		}${mark(asBasic.end)}`
	);
	const notes = $derived(version.isVariation ? version.notes : figure.notes);

	const tabHref = (id: number) =>
		id === figure.id
			? resolve('/[dance]/figures/[id]', { dance: slug, id: String(figure.id) })
			: resolve(`/${slug}/figures/${figure.id}?v=${id}`);
	const itemHref = (item: { id: number; parentId: number | null }) =>
		item.parentId === null
			? resolve('/[dance]/figures/[id]', { dance: slug, id: String(item.id) })
			: resolve(`/${slug}/figures/${item.parentId}?v=${item.id}`);

	const linkFailure = $derived(failed('addLink'));
	const linkEntered = $derived(form && 'urls' in form ? String(form.urls) : '');

	$effect(() => {
		if (failed('createVariation')) addingVariation = true;
	});

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
	const errorBox = 'rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger';
	const closeOnSuccess: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update({ reset: false });
			if (result.type === 'success') editing = false;
		};
	/**
	 * The new-variation sheet. Success is a redirect to the SAME route with a new
	 * `?v=`, so SvelteKit keeps this component: without closing it here the sheet
	 * would stay open over the new tab with the name still typed, and a second tap
	 * would be refused as a duplicate.
	 */
	const closeSheet: SubmitFunction =
		({ formElement }) =>
		async ({ update, result }) => {
			await update();
			if (result.type === 'redirect') {
				addingVariation = false;
				formElement.reset();
			}
		};
</script>

<svelte:head><title>{figure.name} · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/[dance]/figures', { dance: slug })}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to figures">‹</a
	>
	<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">{figure.name}</h1>
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

<!--
	Version tabs: Basic is the figure itself, then each variation, then + to add
	one. A tab is a link (?v=), so a reload or a shared link lands on it.
-->
<nav
	class="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2"
	aria-label="Versions of {figure.name}"
>
	{#each data.versions as v (v.id)}
		<a
			href={tabHref(v.id)}
			aria-current={v.id === version.id ? 'page' : undefined}
			class="h-9 shrink-0 rounded-full px-3.5 text-[14px] leading-9 font-medium {v.id === version.id
				? 'bg-accent text-accent-ink'
				: 'border border-line text-ink-2'}">{v.name}</a
		>
	{/each}
	<button
		type="button"
		onclick={() => (addingVariation = true)}
		class="grid size-9 shrink-0 place-items-center rounded-full border border-line text-[18px] text-accent"
		aria-label="New variation">+</button
	>
</nav>

<main class="space-y-6 px-4 pt-4 pb-4">
	{#if editing}
		<!--
			Keyed on the version: `editing` survives a tab change, and without the key
			one variation's form would be reused for the next — its unsaved directions
			and end position carried over and saved onto the wrong variation.
		-->
		{#key version.id}
			{#if version.isVariation}
				<form
					id="edit-form"
					method="POST"
					action="?/updateVariation"
					class="space-y-3"
					use:enhance={closeOnSuccess}
				>
					<input type="hidden" name="versionId" value={version.id} />
					<label class="block">
						<span class={label}>Name</span>
						<input name="name" required maxlength="200" value={version.name} class={field} />
					</label>
					<label class="block">
						<span class={label}>Directions</span>
						<textarea name="notes" rows="4" maxlength="2000" class={field}
							>{version.notes ?? ''}</textarea
						>
					</label>
					{#key version.id}
						<StartPositions
							positions={data.positions}
							initial={data.tags.startIds}
							neutralName="Same as Basic"
						/>
					{/key}
					<label class="block">
						<span class="text-[13px] font-medium">Ends at</span>
						<select
							name="endId"
							class="mt-1 h-11 w-full rounded-xl border border-line bg-raised px-3 text-[15px]"
						>
							<option value="" selected={data.tags.endId === null}>Same as Basic</option>
							{#each data.positions as position (position.id)}
								<option value={position.id} selected={data.tags.endId === position.id}>
									{position.name}{position.archived ? ' (archived)' : ''}
								</option>
							{/each}
						</select>
					</label>
					{#key version.id}
						<FigureTiming
							startCount={data.own.startCount}
							lengthCounts={data.own.lengthCounts}
							inherited={data.basic}
						/>
					{/key}
					{#if failed('updateVariation')}
						<p class={errorBox} role="alert">{failed('updateVariation')}</p>
					{/if}
					<button
						type="submit"
						class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
						>Save</button
					>
				</form>
				<form
					method="POST"
					action="?/archiveVariation"
					onsubmit={(e) => {
						if (!confirm(`Archive the variation “${version.name}”? Its recordings are kept.`)) {
							e.preventDefault();
						}
					}}
				>
					<input type="hidden" name="versionId" value={version.id} />
					<button type="submit" class="h-11 w-full rounded-xl text-[14px] text-danger"
						>Archive variation</button
					>
				</form>
			{:else}
				<form
					id="edit-form"
					method="POST"
					action="?/update"
					class="space-y-3"
					use:enhance={closeOnSuccess}
				>
					<FigureFields
						dance={data.dance}
						name={figure.name}
						partner={figure.partner}
						style={figure.styleTag ?? undefined}
						notes={figure.notes}
					/>
					<!--
					Keyed on the version: both pickers seed their own state once, and
					SvelteKit reuses them across a same-route navigation — a tab change
					included — so without the key the next version would open showing the
					previous one's values.
				-->
					{#key version.id}
						<StartPositions positions={data.positions} initial={data.tags.startIds} {neutralName} />
					{/key}
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
					{#key version.id}
						<FigureTiming
							startCount={data.basic.startCount}
							lengthCounts={data.basic.lengthCounts}
						/>
					{/key}
					{#if failed('update')}
						<p class={errorBox} role="alert">{failed('update')}</p>
					{/if}
					<button
						type="submit"
						class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
						>Save</button
					>
				</form>
				<form
					method="POST"
					action="?/archive"
					onsubmit={(e) => {
						if (
							!confirm(
								`Archive “${figure.name}” and its variations? Practice history and recordings are kept.`
							)
						) {
							e.preventDefault();
						}
					}}
				>
					<button type="submit" class="h-11 w-full rounded-xl text-[14px] text-danger"
						>Archive figure</button
					>
				</form>
			{/if}
		{/key}
	{:else}
		<section>
			<p class="text-[13px] text-muted">
				{#if styleLabel}{styleLabel} ·
				{/if}{PARTNER_LABEL[figure.partner]}
			</p>
			<p class="text-[13px] text-muted">
				Starts on {data.effective.startCount}{mark(asBasic.startCount)} · {data.effective
					.lengthCounts} counts{mark(asBasic.lengthCounts)}
			</p>
			<p class="text-[13px] text-muted">{handholds}</p>
			{#if notes}
				<LinkedText text={notes} class="mt-2 text-[15px] whitespace-pre-line" />
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
							<li><a class="text-[15px] text-accent" href={itemHref(item)}>{item.name}</a></li>
						{/each}
					</ul>
				{/if}
			</div>
		{/each}
	</section>

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Recordings</h2>
		<ul class="space-y-3">
			{#each version.recordings as rec (rec.id)}
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
							kind={rec.kind}
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
								<input type="hidden" name="versionId" value={version.id} />
								<input type="hidden" name="recordingId" value={rec.id} />
								<button type="submit" class="h-9 px-2 text-danger">Delete</button>
							</form>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
		<div class="mt-3">
			<!-- Keyed: the button holds upload state, and a tab change must not carry it over. -->
			{#key version.id}
				<UploadButton
					url="/api/figures/{version.id}/recordings"
					accept="video/*,audio/*"
					label="+ Add video or audio"
				/>
			{/key}
		</div>
	</section>

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Links</h2>
		<LinksEditor links={data.links} message={linkFailure} entered={linkEntered} />
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
</main>

<Sheet
	title="New variation of {figure.name}"
	open={addingVariation}
	onclose={() => (addingVariation = false)}
>
	<!-- A success redirects to the new variation's tab. Its positions and timing
	     start as Basic's; Edit there to change them. -->
	<form method="POST" action="?/createVariation" class="space-y-3" use:enhance={closeSheet}>
		{#if failed('createVariation')}
			<p class={errorBox} role="alert">{failed('createVariation')}</p>
		{/if}
		<label class="block">
			<span class={label}>Name</span>
			<input
				name="name"
				required
				maxlength="200"
				placeholder="e.g. Doble, From cross"
				class={field}
			/>
		</label>
		<label class="block">
			<span class={label}>Directions</span>
			<textarea name="notes" rows="3" maxlength="2000" class={field}></textarea>
		</label>
		<button
			type="submit"
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
			>Add variation</button
		>
	</form>
</Sheet>

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
