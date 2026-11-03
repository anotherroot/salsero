<script lang="ts">
	import { leaveRemoved } from '$lib/nav/trail.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import FrequencyField from '$lib/components/exercises/FrequencyField.svelte';
	import SetList from '$lib/components/exercises/SetList.svelte';
	import { restoreSet } from '$lib/components/exercises/restore-set';
	import { contentFor, logFor } from '$lib/components/exercises/kinds';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import AddSheet from '$lib/components/teams/AddSheet.svelte';
	import {
		FIELD_ERROR,
		FIELD_ON_CARD,
		GROUP,
		LABEL,
		SECTION_LABEL,
		TEXTAREA_ON_CARD,
		button
	} from '$lib/components/ui/styles';
	import { archiveBody, historyDays, ownerOf, summaryTiles } from '$lib/exercises/exercise-page';
	import { TYPES, typeOf } from '$lib/exercises/kinds';
	import { frequencyLabel } from '$lib/frequency';
	import type { AddOffer } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const exercise = $derived(data.exercise);
	const type = $derived(typeOf(exercise.source));
	const Content = $derived(contentFor(type));
	const Log = $derived(logFor(type));
	// `?log=1` (a lesson's linked-exercise +) opens the popup straight away.
	let logging = $state(page.url.searchParams.get('log') === '1');
	/**
	 * A drill is the only type this page may rename or archive: the others
	 * belong to their owner. A person's entry on a group's drill (`'added'`) is
	 * not one either: its name is the drill's, and Remove from my lessons, on
	 * the lesson, is the way out. On a group drill's own page it is the drill
	 * that is edited, by its editors.
	 */
	const ownsItself = $derived(
		type === 'drill' && (data.drill !== null || exercise.source !== 'added')
	);
	/**
	 * A group's drill: its name and description are the group's, and how often
	 * and whether it is on Today are each person's own entry's, never the
	 * drill's. Shown with the person's entry when they have one.
	 */
	const drill = $derived(data.drill);
	const title = $derived(drill?.name ?? exercise.name);
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const failure = (action: string) =>
		form && 'action' in form && form.action === action && 'message' in form
			? String(form.message)
			: null;

	const owner = $derived(ownerOf(data.practice.content));
	const ownerHref = $derived.by(() => {
		if (!owner) return null;
		const params = { dance: data.dance.slug, id: String(owner.id) };
		if (owner.kind === 'figure') return resolve('/[dance]/figures/[id]', params);
		if (owner.kind === 'lesson') return resolve('/[dance]/lessons/[id]', params);
		return resolve('/[dance]/routines/[id]', params);
	});
	const tiles = $derived(summaryTiles(data.summary));
	const days = $derived(historyDays(data.history, timezone, data.today));

	// --- Edit mode: the settings behind the band's pencil, one Save pinned.
	let editing = $state(false);
	let saving = $state(false);
	let settingsForm: HTMLFormElement | undefined = $state();
	let everyDays = $state(0);
	let active = $state(true);
	/** The last `update` refusal, until the next save or the next time editing starts. */
	let updateError = $state<string | null>(null);

	function startEditing() {
		everyDays = exercise.everyDays;
		active = exercise.active;
		updateError = null;
		editing = true;
	}

	function stopEditing() {
		leaveOrAsk(settingsForm ?? null, () => (editing = false), 'Stop editing');
	}

	const messageOf = (data: unknown) => {
		const m = (data as { message?: unknown } | undefined)?.message;
		return typeof m === 'string' ? m : 'It did not save.';
	};

	// --- Add, on a group drill with no entry of this person's (R7).
	/** The Add sheet's offer, kept as opened: once the Add lands the page's is gone. */
	let adding = $state<{ lessonId: number; title: string; offer: AddOffer } | null>(null);
	let addBusy = $state(false);

	// --- Archive (a drill only), behind a question.
	let archiving = $state(false);
	let archiveBusy = $state(false);
	let archiveError = $state<string | null>(null);

	// --- Undo for a set deleted from the history.
	let notice = $state<{ id: number; message: string; action?: string } | null>(null);
	let noticeSeq = 0;
	/**
	 * The deleted set, for Undo. Taken (and cleared) by the first tap: a second
	 * tap, or a replay while the first is out, would insert the set twice.
	 */
	let undoSnapshot: string | null = null;

	function say(message: string, action?: string) {
		notice = { id: ++noticeSeq, message, action };
	}

	function deleted(snapshot: string) {
		undoSnapshot = snapshot || null;
		say('Set deleted', undoSnapshot ? 'Undo' : undefined);
	}

	function refused(message: string) {
		undoSnapshot = null;
		say(message);
	}

	async function undo() {
		const snapshot = undoSnapshot;
		undoSnapshot = null;
		// The toast goes at the tap, Undo with it, so it cannot be sent twice;
		// the row coming back is the answer.
		notice = null;
		if (!snapshot) return;
		if (!(await restoreSet(snapshot))) say('Could not put the set back.');
	}
</script>

<svelte:head><title>{title} · {data.dance.label}</title></svelte:head>

<Screen compact {title} subtitle={TYPES[type].label}>
	{#snippet left()}
		{#if editing}
			<BandButton icon="close" label="Stop editing" onclick={stopEditing} />
		{:else}
			<BackButton
				fallback={{ href: resolve('/[dance]', { dance: data.dance.slug }), label: 'Back to Today' }}
			/>
		{/if}
	{/snippet}
	{#snippet right()}
		{#if !editing && data.canEdit}
			<BandButton icon="pencil" label="Edit settings" onclick={startEditing} />
		{/if}
	{/snippet}

	<div class="flex flex-col gap-3.5 pb-28">
		{#if editing}
			<section class="flex flex-col gap-2">
				<h2 class={SECTION_LABEL}>Settings</h2>
				<div class="rounded-2xl bg-surface p-4">
					<form
						id="exercise-settings"
						method="POST"
						action="?/update"
						bind:this={settingsForm}
						use:guarded={{
							label: 'Exercise settings',
							submit: () => {
								saving = true;
								updateError = null;
								return async ({ update, result }) => {
									try {
										await update({ reset: false });
									} finally {
										saving = false;
									}
									if (result.type === 'success') editing = false;
									else if (result.type === 'failure') updateError = messageOf(result.data);
								};
							}
						}}
						class="flex flex-col gap-3.5"
					>
						{#if updateError}
							<Banner kind="error" title={updateError} />
						{/if}
						{#if ownsItself}
							<label class="block">
								<span class={LABEL}>Name</span>
								<input name="name" required maxlength="200" value={title} class={FIELD_ON_CARD} />
							</label>
						{/if}
						{#if !drill}
							<FrequencyField name="everyDays" bind:value={everyDays} tone="field" />
							<div class="flex min-h-[52px] items-center gap-3">
								<span class="flex min-w-0 flex-1 flex-col gap-px">
									<span class="text-[16px] font-bold text-ink">Active</span>
									<span class="text-[13px] text-muted">Show it in the to-do list</span>
								</span>
								<Switch name="active" label="Active" bind:checked={active} />
							</div>
						{/if}
						<label class="block">
							<span class={LABEL}>{ownsItself ? 'Description' : 'Practice notes'}</span>
							<textarea name="notes" rows="3" maxlength="2000" class={TEXTAREA_ON_CARD}
								>{(drill ? drill.notes : exercise.notes) ?? ''}</textarea
							>
						</label>
					</form>
				</div>
				{#if ownsItself}
					<div class="flex flex-col items-center pt-1">
						<button
							type="button"
							class={button('danger-text')}
							aria-haspopup="dialog"
							onclick={() => {
								archiveError = null;
								archiving = true;
							}}>Archive exercise</button
						>
						{#if archiveError}
							<p class={FIELD_ERROR} role="alert">
								<Icon name="warning" size={16} filled />{archiveError}
							</p>
						{/if}
					</div>
				{/if}
			</section>
		{:else}
			{#if owner && ownerHref}
				<ul class={GROUP}>
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built with resolve() above -->
						<a href={ownerHref} class="flex min-h-[60px] items-center gap-3 py-2 pr-3.5 pl-4">
							<span
								class="grid size-10 flex-none place-items-center rounded-xl bg-accent-soft text-accent-text"
							>
								<Icon name={owner.icon} size={20} />
							</span>
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-[16px] leading-tight font-bold text-ink">{owner.title}</span>
								<span class="text-[13px] text-muted">{owner.meta}</span>
							</span>
							<span class="text-chevron"><Icon name="chevron-right" size={20} /></span>
						</a>
					</li>
				</ul>
			{/if}

			<Content
				dance={data.dance}
				content={data.practice.content}
				{timezone}
				onPage
				canEdit={data.canEditContent}
				editLinks={data.canEditContent
					? {
							message: failure('addLink'),
							entered: form && 'urls' in form ? String(form.urls) : '',
							linkable: data.linkable,
							unlinkMessage: failure('unlinkSection')
						}
					: undefined}
			/>

			{#if data.add}
				<!-- A group's drill reaches Today through a lesson: one already added takes just this drill. -->
				<div class="flex items-center gap-3 rounded-2xl bg-surface py-2 pr-2 pl-4">
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-[16px] leading-tight font-bold text-ink">Not on your Today</span>
						<span class="text-[13px] text-muted">From {data.add.title}</span>
					</span>
					{#if data.add.added}
						<form
							method="POST"
							action="?/addDrill"
							use:enhance={() => {
								addBusy = true;
								return async ({ update }) => {
									try {
										await update();
									} finally {
										addBusy = false;
									}
								};
							}}
						>
							<button
								type="submit"
								class={button('secondary', 'sm')}
								aria-busy={addBusy}
								disabled={addBusy}>Add</button
							>
						</form>
					{:else if data.add.offer}
						<button
							type="button"
							class={button('secondary', 'sm')}
							aria-haspopup="dialog"
							onclick={() =>
								(adding = data.add?.offer
									? { lessonId: data.add.lessonId, title: data.add.title, offer: data.add.offer }
									: null)}>Add</button
						>
					{/if}
				</div>
			{/if}

			<!-- A group's drill without an entry of this person's has nothing of theirs to show. -->
			{#if data.canLog}
				<section class="flex flex-col gap-2">
					<h2 class={SECTION_LABEL}>History</h2>
					{#if data.summary.sets === 0}
						<div class="rounded-2xl bg-surface">
							<EmptyState
								icon="clock"
								title="Nothing logged yet"
								body="Log a set after you practise — it shows up here, grouped by day."
							/>
						</div>
					{:else}
						<div class="flex rounded-2xl bg-surface">
							{#each tiles as tile, i (tile.label)}
								{#if i > 0}<span aria-hidden="true" class="my-3 w-px flex-none bg-hairline"
									></span>{/if}
								<div class="flex min-w-0 flex-1 flex-col gap-0.5 px-3.5 py-3">
									<span
										class="flex items-center gap-1 font-display text-[24px] leading-[1.05] font-extrabold text-ink"
										>{tile.value}{#if tile.star}<Icon name="star" size={20} filled />{/if}</span
									>
									<span class="text-[12px] font-bold text-muted">{tile.label}</span>
								</div>
							{/each}
						</div>
						{#each days as g (g.day)}
							<h3 class="{SECTION_LABEL} pt-1">{g.label}</h3>
							<SetList sets={g.sets} {timezone} ondeleted={deleted} onfailed={refused} />
						{/each}
						{#if data.history.length < data.summary.sets}
							<p class="px-4 text-[12px] text-muted">Showing the latest {data.history.length}.</p>
						{/if}
					{/if}
				</section>

				<section class="flex flex-col gap-2">
					<h2 class={SECTION_LABEL}>Settings</h2>
					<dl class={GROUP}>
						<div class="flex min-h-14 items-center gap-3 px-4 py-2">
							<dt class="flex-1 text-[16px] font-bold text-ink">How often</dt>
							<dd class="text-right text-[15px] font-semibold text-muted">
								{frequencyLabel(exercise.everyDays)}
							</dd>
						</div>
						<div class="flex min-h-14 items-center gap-3 px-4 py-2">
							<dt class="flex-1 text-[16px] font-bold text-ink">Active</dt>
							<dd class="text-right text-[15px] font-semibold text-muted">
								{exercise.active ? 'Yes' : "No — not on Today's list"}
							</dd>
						</div>
						{#if exercise.notes && !ownsItself}
							<div class="flex min-h-14 flex-col justify-center gap-1 px-4 py-3">
								<dt class="text-[16px] font-bold text-ink">Practice notes</dt>
								<dd>
									<LinkedText
										text={exercise.notes}
										class="text-[15px] leading-[1.45] whitespace-pre-line text-ink-2"
									/>
								</dd>
							</div>
						{/if}
					</dl>
				</section>
			{/if}
		{/if}
	</div>
</Screen>

{#if editing || data.canLog}
	<BottomBar mode={editing}>
		{#if editing}
			<button
				type="submit"
				form="exercise-settings"
				class={button('primary', 'md', true)}
				aria-busy={saving}
				disabled={saving}
			>
				{#if saving}<Spinner /><span class="sr-only">Saving…</span>{:else}Save{/if}
			</button>
		{:else}
			<button
				type="button"
				data-focus="sets-add"
				class={button('primary', 'md', true)}
				onclick={() => (logging = true)}
			>
				<Icon name="plus" size={20} />Log a set
			</button>
		{/if}
	</BottomBar>
{/if}

<Toast
	toast={notice}
	bottom="calc(5.75rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)))"
	onaction={undo}
	ondismiss={() => {
		notice = null;
		undoSnapshot = null;
	}}
/>

{#if adding}
	<AddSheet
		open={true}
		onclose={() => (adding = null)}
		title={adding.title}
		lessonId={adding.lessonId}
		offer={adding.offer}
		action="?/add"
	/>
{/if}

{#if ownsItself}
	<Dialog
		open={archiving}
		title="Archive this drill?"
		body={archiveBody(exercise.name, data.summary.sets)}
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
							// Archived: the settings form goes first, so leaving for Today
							// is not asked about as unsaved changes.
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
							archiveError = messageOf(result.data);
						}
					};
				}}
			>
				<button
					type="submit"
					class={button('danger', 'sm')}
					aria-busy={archiveBusy}
					disabled={archiveBusy}>Archive</button
				>
			</form>
		{/snippet}
	</Dialog>
{/if}

{#if logging && data.canLog}
	<Log
		dance={data.dance}
		exercise={data.exercise}
		sets={data.sets}
		songs={data.songs}
		takes={data.takes}
		backfillDay={null}
		{timezone}
		message={failure('log')}
		initial={data.practice}
		from="exercise"
		onclose={() => (logging = false)}
	/>
{/if}
