<script lang="ts">
	import MusicSection from '$lib/components/songs/MusicSection.svelte';
	import { practiseHref } from '$lib/songs/music';
	import { leaveRemoved } from '$lib/nav/trail.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { tick, untrack } from 'svelte';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { isClash } from '$lib/clash/clash';
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
	import Face from '$lib/components/exercises/Face.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import WarmupRow from '$lib/components/exercises/WarmupRow.svelte';
	import ComesBackCard from '$lib/components/exercises/ComesBackCard.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import PaneColumns from '$lib/components/ui/PaneColumns.svelte';
	import LastTime from '$lib/components/exercises/LastTime.svelte';
	import { desk } from '$lib/nav/desk.svelte';
	import { todayPane } from '$lib/components/today/today-context';
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
	import {
		archiveBody,
		fromClassLabel,
		historyDays,
		ownerOf,
		pageParts,
		summaryTiles
	} from '$lib/exercises/exercise-page';
	import { levelShown, simple as simpleOf } from '$lib/levels/levels';
	import { TYPES, typeInfo, typeOf } from '$lib/exercises/kinds';
	import { comesBackWords } from '$lib/exercises/comes-back-view';
	import MakeMineSheet from '$lib/components/clones/MakeMineSheet.svelte';
	import Versions from '$lib/components/clones/Versions.svelte';
	import ItemMenu from '$lib/components/clones/ItemMenu.svelte';
	import { hasMenu, type CloneOffers } from '$lib/clones/menu';
	import { menuLabel } from '$lib/menu';
	import CommentsCard from '$lib/components/comments/CommentsCard.svelte';
	import { cloneSubtitle } from '$lib/clones/view';
	import { t } from '$lib/i18n/catalog';
	import type { AddOffer } from '$lib/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const exercise = $derived(data.exercise);
	/**
	 * Follow my class and Practise and keep my own: the "I practised this" page.
	 * A person who never chose (null) is Everything: unchanged.
	 */
	const simple = $derived(simpleOf(levelShown(data.user?.level)));
	const parts = $derived(pageParts(simple, data.fromClass !== null));
	const type = $derived(typeOf(exercise.source));
	/** Opened from the person's copy (`?vs=`): the place this page is, for the note under the tabs. */
	const sourcePlace = $derived(
		data.vs !== null && data.cloneLine.self.kind === 'team' ? data.cloneLine.self.name : null
	);
	const Content = $derived(contentFor(type));
	const Log = $derived(logFor(type));
	/**
	 * Desktop: the type's content sits by the log form, in the left column (a drill's
	 * links and sections, a figure's reference), rather than beside the history.
	 */
	const contentLeft = $derived(data.canLog && typeInfo(exercise.source).paneContent === 'left');
	/**
	 * The exercise in the URL. A group drill's page shows the person's entry
	 * (`data.exercise`, another id), which an Add can swap in place: what belongs
	 * to the page goes by the URL's id. The log form, popup or pane, posts to this
	 * page's own `?/log` (LogShell's default), never to the entry's URL.
	 */
	const pageId = $derived(page.params.id);
	/** Today's list beside the pane (desktop): its session, Next after a log, the session's line. */
	const today = todayPane();
	// `?log=1` (a lesson's linked-exercise +) opens the popup straight away.
	let logging = $state(page.url.searchParams.get('log') === '1');
	// Told to the layout: narrowing in a session must not open its popup over this one.
	$effect(() => {
		today?.pagePopup(logging && data.canLog);
		return () => today?.pagePopup(false);
	});
	/** Not today applies while the exercise is a to-do or picked row on Today (not done today). */
	const canSkip = $derived(data.canLog && !!today?.canSkip(data.exercise.id));
	let skipping = $state(false);
	async function notToday() {
		if (skipping || !today) return;
		skipping = true;
		try {
			// The row is gone from Today now: back to the list (on the desktop it opens the next).
			if (await today.notToday(data.exercise.id))
				await goto(resolve('/[dance]/(today)', { dance: data.dance.slug }));
		} finally {
			skipping = false;
		}
	}
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

	/** The drill's links editor: the page's content, and the pane's log column (desktop). */
	const editLinks = $derived(
		data.canEditContent && !simple
			? {
					message: failure('addLink'),
					entered: form && 'urls' in form ? String(form.urls) : '',
					linkable: data.linkable,
					unlinkMessage: failure('unlinkSection')
				}
			: undefined
	);

	const owner = $derived(ownerOf(data.practice.content));
	const ownerHref = $derived.by(() => {
		if (!owner) return null;
		const params = { dance: data.dance.slug, id: String(owner.id) };
		if (owner.kind === 'figure') return resolve('/[dance]/(moves)/figures/[id]', params);
		if (owner.kind === 'lesson') return resolve('/[dance]/lessons/[id]', params);
		return resolve('/[dance]/(moves)/routines/[id]', params);
	});
	const tiles = $derived(summaryTiles(data.summary));
	const days = $derived(historyDays(data.history, timezone, data.today));

	// --- Edit mode: the settings behind the band's pencil, one Save pinned.
	let editing = $state(false);
	/** A reader's Edit on a group drill: the Make it mine sheet (ruling 1). */
	let makingMine = $state(false);
	let saving = $state(false);
	let settingsForm: HTMLFormElement | undefined = $state();
	let active = $state(true);
	let warmup = $state(false);
	/** The last `update` refusal, until the next save or the next time editing starts. */
	let updateError = $state<string | null>(null);

	function startEditing() {
		active = exercise.active;
		warmup = data.warmupSwitch === true;
		updateError = null;
		editing = true;
	}

	function stopEditing() {
		leaveOrAsk(settingsForm ?? null, () => (editing = false), t().exercise.page.stopEditing);
	}

	const messageOf = (data: unknown) => {
		const m = (data as { message?: unknown } | undefined)?.message;
		return typeof m === 'string' ? m : t().exercise.log.didNotSave;
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
		say(t().exercise.log.setDeleted, undoSnapshot ? t().common.undo : undefined);
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
		if (!(await restoreSet(snapshot))) say(t().exercise.log.couldNotPutBack);
	}

	/*
	 * Another exercise opened in this page (a row beside it, on the desktop):
	 * SvelteKit keeps the page, so what was the last one's goes with it. An edit
	 * left open would otherwise show the new exercise with the old one's
	 * settings, and save it there.
	 */
	let shownId = untrack(() => page.params.id);
	$effect.pre(() => {
		const id = pageId;
		if (id === shownId) return;
		shownId = id;
		untrack(() => {
			editing = false;
			makingMine = false;
			updateError = null;
			adding = null;
			archiving = false;
			archiveError = null;
			notice = null;
			undoSnapshot = null;
			logging = page.url.searchParams.get('log') === '1';
		});
	});
	/** An entry on its class drill's setting: the page says whose it is (hidden at Follow my class). */
	const followsTeacher = $derived(
		!simple && exercise.comesBackOwn === null && exercise.comesBackTeacher !== null
	);
	/** The band's ⋯ is open. */
	let menuOpen = $state(false);
	/** What the ⋯ offers of the copy actions (ItemMenu, mounted once below the page). */
	const offers = $derived<CloneOffers>({
		sync: data.keep?.mode ? data.keep : null,
		drop: data.drop,
		detach: data.detach,
		copy: data.copyTo
	});
</script>

<svelte:head><title>{title} · {data.dance.label}</title></svelte:head>

{#snippet nothing()}{/snippet}

<!--
	The left column, on the desktop only: the type's log form in its pane frame. Mounted
	by width, so a popup and a pane are never both on the page; the server's render
	holds its place with a placeholder the phone never draws.
-->
{#snippet logColumn()}
	{#if desk.current}
		{#key today?.key ?? pageId}
			<Log
				frame="pane"
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
				schedule={data.scheduleAtStart ?? undefined}
				today={data.today}
				{simple}
				contentProps={{ onPage: true, canEdit: data.canEditContent && !simple, editLinks }}
				session={today?.session ?? null}
				follow={today?.follow ?? null}
				onlogged={(d, setId) => {
					today?.logged(d);
					today?.undoable(data.exercise.id, setId);
				}}
				belowLog={notTodayPane}
				onclose={() => {}}
			/>
		{/key}
	{:else}
		<div aria-hidden="true" class="hidden flex-col gap-3 desk:flex">
			<span class="block h-[70px] rounded-2xl bg-skeleton"></span>
			<span class="block h-[56px] rounded-[14px] bg-skeleton"></span>
			<span class="block h-[52px] rounded-[14px] bg-skeleton"></span>
		</div>
	{/if}
{/snippet}

{#snippet pageContent()}
	<Content
		dance={data.dance}
		content={data.practice.content}
		{timezone}
		onPage
		canEdit={data.canEditContent && !simple}
		{simple}
		{editLinks}
	/>
{/snippet}

<!-- The class's comments, after the type's content on the simple page and on the full one alike. -->
{#snippet classCard()}
	{#if data.comments}<CommentsCard
			comments={data.comments}
			title={t().exercise.page.comments}
		/>{/if}
{/snippet}

<!-- "From class Tue 3 Nov ›": the simple page's way to the lesson. -->
{#snippet fromClass()}
	{#if parts.fromClass && data.fromClass}
		<a
			href={resolve('/[dance]/lessons/[id]', {
				dance: data.dance.slug,
				id: String(data.fromClass.lessonId)
			})}
			class="flex min-h-11 items-center self-start px-1 text-[15px] font-extrabold text-accent-text desk:min-w-0"
			>{fromClassLabel(data.fromClass.day, data.today)}</a
		>
	{/if}
{/snippet}

<!-- The exercise: the right column on the desktop, the whole page on the phone. -->
{#snippet about()}
	{#if parts.ownerRow && owner && ownerHref}
		<!-- While editing the phone shows the settings alone; the desktop keeps the row. -->
		<ul class="{GROUP} desk:min-w-0{editing ? ' hidden desk:block' : ''}">
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
	{#if editing}
		<section class="flex flex-col gap-2 desk:min-w-0">
			<h2 class={SECTION_LABEL}>{t().exercise.page.settings}</h2>
			<form
				id="exercise-settings"
				method="POST"
				action="?/update"
				bind:this={settingsForm}
				use:guarded={{
					label: t().exercise.page.settingsLabel,
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
							// A clash or gone belongs to the clash sheet, which holds what was typed.
							else if (result.type === 'failure' && !isClash(result.data))
								updateError = messageOf(result.data);
						};
					}
				}}
				class="flex flex-col gap-6"
			>
				<div class="flex flex-col gap-3.5 rounded-2xl bg-surface p-4">
					<!-- What this form saw: a save that saw another version is refused (the clash check). -->
					<input type="hidden" name="seen" value={JSON.stringify(data.seen)} />
					{#if updateError}
						<Banner kind="error" title={updateError} />
					{/if}
					{#if ownsItself}
						<label class="block">
							<span class={LABEL}>{t().exercise.page.name}</span>
							<input name="name" required maxlength="200" value={title} class={FIELD_ON_CARD} />
						</label>
					{/if}
					{#if !drill}
						<div class="flex min-h-[52px] items-center gap-3">
							<span class="flex min-w-0 flex-1 flex-col gap-px">
								<span class="text-[16px] font-bold text-ink">{t().exercise.page.active}</span>
								<span class="text-[13px] text-muted">{t().exercise.page.activeHint}</span>
							</span>
							<Switch name="active" label={t().exercise.page.active} bind:checked={active} />
						</div>
					{/if}
					{#if data.warmupSwitch !== null}
						<WarmupRow bind:checked={warmup} daily={data.list.daily} />
					{/if}
					<label class="block">
						<span class={LABEL}
							>{ownsItself ? t().exercise.page.description : t().exercise.page.practiceNotes}</span
						>
						<textarea name="notes" rows="3" maxlength="2000" class={TEXTAREA_ON_CARD}
							>{(drill ? drill.notes : exercise.notes) ?? ''}</textarea
						>
					</label>
					<!-- The desktop's Save and Cancel, in place (the phone's Save is pinned at the bottom). -->
					<div class="hidden gap-2.5 desk:flex">
						<button
							type="submit"
							class={button('primary', 'md')}
							aria-busy={saving}
							disabled={saving}
						>
							{#if saving}<Spinner /><span class="sr-only">{t().exercise.log.saving}</span
								>{:else}{t().common.save}{/if}
						</button>
						<button type="button" class={button('secondary', 'md')} onclick={stopEditing}
							>{t().common.cancel}</button
						>
					</div>
				</div>
				{#if data.comes && !simple}
					<ComesBackCard {...data.comes} />
				{/if}
			</form>
			{#if ownsItself}
				<div class="flex flex-col items-center pt-1">
					<button
						type="button"
						class={button('danger-text')}
						aria-haspopup="dialog"
						onclick={() => {
							archiveError = null;
							archiving = true;
						}}>{t().exercise.page.archive}</button
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
		{#if followsTeacher}
			<div class="flex flex-col gap-1.5 rounded-2xl bg-surface px-4 py-3.5 desk:min-w-0">
				<span class="text-[13px] font-bold text-muted">{t().exercise.comesBack.title}</span>
				<span class="text-[17px] leading-snug font-extrabold text-ink"
					>{comesBackWords(exercise.comesBack)}</span
				>
				<span
					data-dance={data.dance.slug}
					data-group=""
					class="inline-flex h-[30px] items-center gap-1.5 self-start rounded-full bg-accent-soft pr-3 pl-2 text-[14px] font-bold text-accent-text"
					><Icon name="people" size={16} />{t().exercise.comesBack.setByTeacher}</span
				>
			</div>
		{/if}
		{#if !contentLeft}
			{@render pageContent()}
		{:else if !desk.current}
			<!-- On the desktop this content is the log column's (`paneContent`). -->
			<div class="contents desk:hidden">{@render pageContent()}</div>
		{/if}
		{@render fromClass()}
		{@render classCard()}

		{#if parts.addBlock && data.add}
			<!-- A group's drill reaches Today through a lesson: one already added takes just this drill. -->
			<div class="flex items-center gap-3 rounded-2xl bg-surface py-2 pr-2 pl-4 desk:min-w-0">
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="text-[16px] leading-tight font-bold text-ink"
						>{t().exercise.page.notOnToday}</span
					>
					<span class="text-[13px] text-muted">{t().exercise.page.fromLesson(data.add.title)}</span>
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
							disabled={addBusy}>{t().common.add}</button
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
								: null)}>{t().common.add}</button
					>
				{/if}
			</div>
		{/if}
	{/if}

	<!-- Music (spec B): a drill's suggested songs; an entry reads its group drill's. -->
	{#if data.musicShown && !editing}
		<MusicSection
			rows={data.music}
			canEdit={data.musicEdit}
			choices={data.musicChoices}
			practise={(songId) =>
				practiseHref(
					data.dance.slug,
					data.musicEntryId !== null ? { drillEntryId: data.musicEntryId } : { lesson: true },
					songId
				)}
		/>
	{/if}

	<!-- A group's drill without an entry of this person's has nothing of theirs to show. -->
	{#if data.canLog}
		<!-- While editing: on the desktop only (the phone shows the settings alone). -->
		{#if parts.historyTiles}
			<section class="{editing ? 'hidden desk:flex' : 'flex'} flex-col gap-2 desk:min-w-0">
				<h2 class={SECTION_LABEL}>{t().exercise.page.history}</h2>
				{#if data.summary.sets === 0}
					<div class="rounded-2xl bg-surface">
						<EmptyState
							icon="clock"
							title={t().exercise.page.nothingYet}
							body={t().exercise.page.nothingYetBody}
						/>
					</div>
				{:else}
					<div class="flex rounded-2xl bg-surface">
						{#each tiles as tile, i (tile.label)}
							{#if i > 0}<span aria-hidden="true" class="my-3 w-px flex-none bg-hairline"
								></span>{/if}
							<div class="flex min-w-0 flex-1 flex-col gap-0.5 px-3.5 py-3">
								<span
									class="flex items-center gap-1.5 font-display leading-[1.05] font-extrabold text-ink {tile.feel
										? 'text-[17px]'
										: 'text-[24px]'}"
									>{#if tile.feel}<Face feel={tile.feel} size={22} />{/if}{tile.value}</span
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
						<p class="px-4 text-[12px] text-muted">
							{t().exercise.page.showingLatest(data.history.length)}
						</p>
					{/if}
				{/if}
			</section>
		{/if}

		{#if !editing}
			{#if parts.settingsBlock}
				<section class="flex flex-col gap-2 desk:min-w-0">
					<h2 class={SECTION_LABEL}>{t().exercise.page.settings}</h2>
					<dl class={GROUP}>
						<div class="flex min-h-14 items-center gap-3 px-4 py-2">
							<dt class="flex-1 text-[16px] font-bold text-ink">{t().exercise.page.active}</dt>
							<dd class="text-right text-[15px] font-semibold text-muted">
								{exercise.active ? t().common.yes : t().exercise.page.activeNo}
							</dd>
						</div>
						{#if exercise.notes && !ownsItself}
							<div class="flex min-h-14 flex-col justify-center gap-1 px-4 py-3">
								<dt class="text-[16px] font-bold text-ink">{t().exercise.page.practiceNotes}</dt>
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
			<!-- The very end of the phone's page (the desktop has it under Log set). -->
			{#if canSkip}
				<div class="flex flex-col items-center gap-0.5 pt-1 desk:hidden">
					{@render notTodayButton()}
				</div>
			{/if}
		{/if}
	{/if}
{/snippet}

<!-- Not today: quiet text, with what it does under it. -->
{#snippet notTodayButton()}
	<button
		type="button"
		class={button('tertiary', 'md')}
		aria-busy={skipping}
		disabled={skipping}
		onclick={notToday}>{t().today.row.notToday}</button
	>
	<p class="text-[13px] text-muted">{t().exercise.page.comesBack}</p>
{/snippet}

{#snippet notTodayPane()}
	{#if canSkip}
		<div class="flex flex-col items-center gap-0.5">{@render notTodayButton()}</div>
	{/if}
{/snippet}

{#snippet back()}
	<BackButton
		fallback={{
			href: resolve('/[dance]/(today)', { dance: data.dance.slug }),
			label: t().shell.backTo(t().shell.tabs.today)
		}}
	/>
{/snippet}

{#snippet lastTime()}
	<!-- A session's place, above Last time (desktop: the pane's header). -->
	{#if today?.line}<p class="text-[13px] font-extrabold text-accent-text">{today.line}</p>{/if}
	<LastTime last={data.practice.last} />
{/snippet}

<Screen
	compact
	width={data.canLog ? 'two' : 'one'}
	{title}
	subtitle={editing || simple
		? TYPES[type].label
		: (cloneSubtitle(data.cloneLine) ?? TYPES[type].label)}
	below={data.canLog ? lastTime : undefined}
>
	<!--
		Editing: the phone's × is on the left, in place of ‹; the desktop's is on the
		right, in place of the pencil, and its ‹ stays (BackButton gates itself there).
	-->
	{#snippet left()}
		{#if editing}
			<span class="contents desk:hidden"
				><BandButton
					icon="close"
					label={t().exercise.page.stopEditing}
					onclick={stopEditing}
				/></span
			>
			<span class="hidden desk:contents">{@render back()}</span>
		{:else}
			{@render back()}
		{/if}
	{/snippet}
	{#snippet right()}
		{#if editing}
			<span class="hidden desk:contents"
				><BandButton
					icon="close"
					label={t().exercise.page.stopEditing}
					onclick={stopEditing}
				/></span
			>
		{/if}
		{#if !editing && parts.historyLink && data.historyHref}
			<BandButton icon="clock" label={t().exercise.page.history} href={data.historyHref} />
		{/if}
		{#if !editing && parts.editSettings && data.canEdit}
			<BandButton icon="pencil" label={t().exercise.page.editSettings} onclick={startEditing} />
		{:else if !editing && parts.editSettings && data.makeMine}
			<BandButton
				icon="pencil"
				label={t().exercise.page.editDrill}
				onclick={() => (makingMine = true)}
			/>
		{/if}
		{#if !editing && parts.sourceTabs}
			{#if hasMenu([], offers)}
				<BandButton
					icon="more"
					label={menuLabel('drill')}
					focusKey="item-menu"
					onclick={() => (menuOpen = true)}
				/>
			{/if}
		{/if}
	{/snippet}

	<!--
		The exercise in its pane (desktop spec, "Today: the list and the open exercise"):
		from a 780 px pane two columns, 1 : 1, the log form on the left (Log set pinned
		under it) and the exercise on the right; one column below that, the form first.
		The phone's page is the right column alone, in its own order. Versions (its
		toast is `fixed`) sits above the columns: nothing pinned lives in their container.
	-->
	<div class="flex flex-col gap-3.5 pb-28 desk:pb-0">
		{#if !editing && parts.sourceTabs}
			<Versions
				sources={data.sources}
				kind="drill"
				dance={data.dance.slug}
				current={data.drill?.id ?? exercise.id}
				mineId={data.mineId}
				self={data.cloneLine.self}
				{title}
				family={data.family}
				step={data.step}
				keep={data.keep}
				taking={sourcePlace}
			/>
		{/if}
		<PaneColumns
			ratio="1:1"
			class="gap-3.5"
			top={data.canLog ? undefined : about}
			left={data.canLog ? logColumn : nothing}
			right={data.canLog ? about : nothing}
		/>
	</div>
</Screen>

{#if editing || data.canLog}
	<!-- The phone's: the desktop logs in the pane's left column and saves in place. -->
	<BottomBar mode={editing} class="desk:hidden">
		{#if editing}
			<button
				type="submit"
				form="exercise-settings"
				class={button('primary', 'md', true)}
				aria-busy={saving}
				disabled={saving}
			>
				{#if saving}<Spinner /><span class="sr-only">{t().exercise.log.saving}</span>{:else}{t()
						.common.save}{/if}
			</button>
		{:else}
			<button
				type="button"
				data-focus="sets-add"
				class={button('primary', 'md', true)}
				onclick={() => (logging = true)}
			>
				<Icon name={simple ? 'check' : 'plus'} size={20} />{parts.logButton}
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
		title={t().exercise.page.archiveTitle}
		body={archiveBody(exercise.name, data.summary.sets)}
		onclose={() => (archiving = false)}
	>
		{#snippet actions()}
			<button type="button" class={button('tertiary', 'sm')} onclick={() => (archiving = false)}
				>{t().common.cancel}</button
			>
			<form
				method="POST"
				action="?/archive"
				use:enhance={() => {
					archiveBusy = true;
					return async ({ update, result }) => {
						if (result.type === 'redirect') {
							// Archived: the settings form goes first, so leaving for Today
							// is not asked about as unsaved changes. Then the dialog, with
							// the move already under way: `leaveRemoved` drops the refresh
							// its close would owe for the form sent in it, which would
							// reload this exercise, gone now, as a 404 in place of Today.
							editing = false;
							await tick();
							archiving = false;
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
					disabled={archiveBusy}>{t().exercise.page.archiveButton}</button
				>
			</form>
		{/snippet}
	</Dialog>
{/if}

<!-- The phone's popup; on the desktop the log form is the pane's (never both). -->
{#if logging && data.canLog && !desk.current}
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
		schedule={data.scheduleAtStart ?? undefined}
		today={data.today}
		{simple}
		onlogged={(_, setId) => today?.undoable(data.exercise.id, setId)}
		outer={today ? { toast: today.toast, ondismiss: today.dismissToast } : null}
		onclose={() => (logging = false)}
	/>
{/if}

{#if data.makeMine}
	<MakeMineSheet open={makingMine} onclose={() => (makingMine = false)} offer={data.makeMine} />
{/if}

<!-- The ⋯ menu and its sheets, once: the band (drawn twice) only holds its button. -->
<ItemMenu
	bind:open={menuOpen}
	{title}
	kind="drill"
	current={data.drill?.id ?? exercise.id}
	own={[]}
	{offers}
/>
