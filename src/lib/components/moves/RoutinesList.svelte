<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { keepFilter, keptFilter } from '$lib/nav/trail.svelte';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import SyncCard from './SyncCard.svelte';
	import { SYNC_EMPTY, differLabel, outOfSyncCount } from '$lib/moves/sync';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { FIELD, GROUP, LABEL, SECTION_LABEL, TEXTAREA, button } from '$lib/components/ui/styles';
	import GroupMark from '$lib/components/moves/GroupMark.svelte';
	import { mixGroups, newestFirst } from '$lib/moves/mix';
	import {
		fromClass,
		routineBadges,
		routinesView,
		type RoutineBadge,
		type RoutinesLists
	} from '$lib/moves/routines';
	import { twinsChip } from '$lib/clones/twins';
	import { anyHidden, hiddenFromMembers, membersNote } from '$lib/moves/members';
	import { t } from '$lib/i18n/catalog';
	import type { Dance } from '$lib/dances/dances';
	import type { RoutineItem, TeamRef } from '$lib/types';
	import type { OpenRow } from '$lib/nav/moves-pane';

	/**
	 * The Routines list: the space's routines, newest first, the groups' mixed in,
	 * each marked with its group. The (moves) layout renders it once (`ListPane`):
	 * the phone's list page, and on the desktop the column beside an open routine
	 * (or a figure opened from one).
	 * New routine posts to the list route's action by name, and its refusal is
	 * read from the submit's result, never from `form`.
	 */
	let {
		lists,
		dance,
		open,
		isList,
		creating = $bindable(false)
	}: {
		lists: RoutinesLists;
		dance: Dance;
		/** What is open beside the list: its row is lit. */
		open: OpenRow;
		/** The list route; otherwise an item is open. */
		isList: boolean;
		/** The New routine sheet; the band's + and the empty pane open it too. */
		creating?: boolean;
	} = $props();

	/** A row: the person's own carry what the graph says of them; a group's do not. */
	type RoutineRow = RoutineItem & { loops?: boolean; breaks?: number };
	type Refusal = { field?: 'name' | 'notes'; message?: string; name?: string; notes?: string };

	// `?new=1` opens the sheet on arrival, as it does on Figures.
	afterNavigate(() => {
		if (isList && page.url.searchParams.get('new') === '1') creating = true;
	});
	let busy = $state(false);
	// The last create's refusal, shown in the sheet until it closes.
	let refusal = $state<Refusal | null>(null);
	let formEl = $state<HTMLFormElement>();
	// The routines that stand for their twins (board C7): a "Twins" chip.
	const twinned = $derived(new Set(lists.twinned));

	// `?sync=1` filters the list route; beside an open routine the column keeps it (`held`), as Figures does.
	let held = $state('');
	let seeded = false;
	const sync = $derived(
		new URLSearchParams(isList ? page.url.searchParams : held).get('sync') === '1'
	);
	const view = $derived(routinesView(lists, sync));
	// The groups' routines among the person's, as Lessons mixes a group's lessons in.
	const rows = $derived(
		mixGroups<RoutineRow>(
			view.routines,
			view.groups.map((g) => ({ team: g.team, rows: g.routines })),
			newestFirst
		)
	);
	const syncN = $derived(
		outOfSyncCount([...lists.routines, ...lists.groups.flatMap((g) => g.routines)])
	);
	const listPath = $derived(resolve('/[dance]/(moves)/routines', { dance: dance.slug }));
	const syncHref = $derived(sync ? listPath : `${listPath}?sync=1`);
	afterNavigate(() => {
		if (isList) {
			held = sync ? 'sync=1' : '';
			keepFilter(listPath, held, held);
		} else if (!seeded) {
			held = keptFilter(listPath);
		}
		seeded = true;
	});
	const nameError = $derived(refusal?.field === 'name' ? refusal.message : null);
	const notesError = $derived(refusal?.field === 'notes' ? refusal.message : null);
	// A refusal that is about no one field goes at the top of the sheet.
	const otherError = $derived(refusal?.message && !refusal.field ? refusal.message : null);

	function close() {
		creating = false;
		refusal = null;
	}
</script>

{#snippet routineRow(routine: RoutineRow & { team: TeamRef | null }, badges: RoutineBadge[])}
	{@const lit = open?.kind === 'routine' && open.id === routine.id}
	<a
		class="flex min-h-[68px] items-center gap-2.5 py-[9px] pr-3.5 pl-4 active:bg-step"
		class:bg-accent-soft={lit}
		aria-current={lit ? 'page' : undefined}
		href={resolve('/[dance]/(moves)/routines/[id]', {
			dance: dance.slug,
			id: String(routine.id)
		})}
	>
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="truncate text-[16px] leading-[1.3] font-bold text-ink">{routine.name}</span>
			<!-- A group's routine: its group, as a group's lesson shows it on the Lessons list. -->
			{#if routine.team}<GroupMark name={routine.team.name} />{/if}
			<span
				class="flex flex-wrap items-center gap-1.5 pt-0.5 text-[13px] leading-[1.35] text-muted"
			>
				<span>{t().nouns.slots(routine.slots)}</span>
				{#if routine.classDay}
					<!-- Spec A5 (A2): the latest class it is from. Not a link: the row is the one link. -->
					<span aria-hidden="true" class="-mx-0.5">·</span>
					<span class="flex items-center gap-1 font-bold whitespace-nowrap text-accent-text"
						><Icon name="lessons" size={15} /><span class="sr-only"
							>{fromClass(routine.classDay)}</span
						><span aria-hidden="true">{routine.classDay}</span></span
					>
				{/if}
				<!-- The twin icon is the kit's `link`: the kit has none of its own. -->
				{#if twinned.has(routine.id)}<Badge><Icon name="link" size={14} />{twinsChip()}</Badge>{/if}
				{#each badges as b (b.text)}
					<Badge tone={b.tone}>{b.text}</Badge>
				{/each}
				{#if differLabel(routine.differ)}
					<span class="font-bold whitespace-nowrap text-warn">{differLabel(routine.differ)}</span>
				{/if}
				{#if routine.membersSee === false}
					<span class="flex items-center gap-1 whitespace-nowrap"
						><Icon name="eye-off" size={16} />{hiddenFromMembers()}</span
					>
				{/if}
			</span>
		</span>
		<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
	</a>
{/snippet}

{#if lists.routines.length === 0 && lists.groups.length === 0}
	<div class="h-10 flex-none"></div>
	<EmptyState icon="routine" title={t().moves.routines.empty} body={t().moves.routines.emptyBody}>
		{#snippet action()}
			<button type="button" class={button('primary')} onclick={() => (creating = true)}>
				<Icon name="plus" size={20} />
				{t().moves.newRoutine}
			</button>
		{/snippet}
	</EmptyState>
{:else}
	<SyncCard
		kind="routine"
		n={syncN}
		on={sync}
		href={syncHref}
		onclick={(e) => {
			if (isList) return;
			e.preventDefault();
			held = sync ? '' : 'sync=1';
			keepFilter(listPath, held, held);
		}}
	/>
	{#if sync && rows.length === 0}
		<EmptyState icon="check-circle" title={SYNC_EMPTY.title} body={SYNC_EMPTY.body} />
	{/if}
	{#if rows.length > 0}
		{#if anyHidden(view.routines)}
			<p class="rounded-2xl bg-surface px-4 py-3 text-[13px] leading-[1.4] text-muted">
				{membersNote()}
			</p>
		{/if}
		<h2 class="{SECTION_LABEL} pt-1">{t().nouns.routines(rows.length)}</h2>
		<div class={GROUP}>
			{#each rows as routine (routine.id)}
				<!-- A group's routine is opened, not edited: no badges about its loop. -->
				{@render routineRow(
					routine,
					routine.team ? [] : routineBadges({ loops: false, breaks: 0, ...routine })
				)}
			{/each}
		</div>
	{/if}
{/if}

<Sheet title={t().moves.newRoutine} open={creating} onclose={close}>
	<form
		id="new-routine"
		method="POST"
		action={`/${dance.slug}/routines?/create`}
		class="flex flex-col gap-3.5"
		bind:this={formEl}
		use:guarded={{
			label: t().moves.newRoutine,
			submit: ({ cancel }) => {
				// One routine per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				return async ({ result, update }) => {
					try {
						if (result.type === 'failure') {
							refusal = (result.data ?? {}) as Refusal;
						} else if (result.type === 'redirect') {
							// The list stays (the layout's): the sheet closes, then the new
							// routine opens once its Back has landed, with every load fresh.
							close();
							await gotoWhenSettled(result.location, { invalidateAll: true });
							// The sheet is kept, closed: the next New routine starts empty.
							formEl?.reset();
						} else {
							await update();
						}
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		{#if otherError}<Banner kind="error">{otherError}</Banner>{/if}

		<div>
			<label class={LABEL} for="routine-name">{t().moves.routines.name}</label>
			<!-- The sheet exists to type this one thing. -->
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="routine-name"
				name="name"
				required
				autofocus
				maxlength="200"
				value={refusal?.name ?? ''}
				placeholder={t().moves.routines.namePlaceholder}
				class={FIELD}
				aria-invalid={nameError ? 'true' : undefined}
				aria-describedby={nameError ? 'routine-name-error' : undefined}
			/>
			{#if nameError}<FieldError id="routine-name-error" message={nameError} />{/if}
		</div>

		<div>
			<label class={LABEL} for="routine-notes">{t().moves.routines.notes}</label>
			<textarea
				id="routine-notes"
				name="notes"
				rows="4"
				maxlength="2000"
				placeholder={t().moves.routines.notesPlaceholder}
				class={TEXTAREA}
				aria-invalid={notesError ? 'true' : undefined}
				aria-describedby={notesError ? 'routine-notes-error' : undefined}
				>{refusal?.notes ?? ''}</textarea
			>
			{#if notesError}<FieldError id="routine-notes-error" message={notesError} />{/if}
		</div>
	</form>

	{#snippet footer()}
		<button
			type="submit"
			form="new-routine"
			class={button('primary', 'md', true)}
			aria-busy={busy}
			aria-label={busy ? t().moves.routines.creating : undefined}
		>
			{#if busy}<Spinner />{:else}{t().moves.routines.create}{/if}
		</button>
	{/snippet}
</Sheet>
