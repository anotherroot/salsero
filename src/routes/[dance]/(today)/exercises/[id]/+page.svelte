<script lang="ts">
	import MusicSection from '$lib/components/songs/MusicSection.svelte';
	import { practiseHref } from '$lib/songs/music';
	import { backWhenSettled, leaveRemoved } from '$lib/nav/trail.svelte';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { tick, untrack } from 'svelte';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import { isClash } from '$lib/clash/clash';
	import { act } from '$lib/act';
	import { refusalMessage } from '$lib/act-toast';
	import { focusAfterRemoval } from '$lib/focus';
	import { contentFor, practiceFor } from '$lib/components/exercises/kinds';
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
	import WarmupRow from '$lib/components/exercises/WarmupRow.svelte';
	import ComesBackCard from '$lib/components/exercises/ComesBackCard.svelte';
	import DoneBar from '$lib/components/exercises/DoneBar.svelte';
	import DoneSheet from '$lib/components/exercises/DoneSheet.svelte';
	import DrillRecordings from '$lib/components/exercises/DrillRecordings.svelte';
	import Face from '$lib/components/exercises/Face.svelte';
	import HistoryDaySheet from '$lib/components/exercises/HistoryDaySheet.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import PaneColumns from '$lib/components/ui/PaneColumns.svelte';
	import LastTime from '$lib/components/exercises/LastTime.svelte';
	import { todayBack } from '$lib/nav/today-pane';
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
		historyRows,
		ownerOf,
		pageParts,
		historyTiles,
		type HistoryDay
	} from '$lib/exercises/exercise-page';
	import { bandSubtitle, doneSubtitle, savedMessage } from '$lib/exercises/done-view';
	import { announceSaved } from '$lib/exercises/saved.svelte';
	import { pageClock } from '$lib/exercises/page-clock.svelte';
	import { levelShown, simple as simpleOf } from '$lib/levels/levels';
	import { TYPES, typeOf } from '$lib/exercises/kinds';
	import { comesBackWords } from '$lib/exercises/comes-back-view';
	import MakeMineSheet from '$lib/components/clones/MakeMineSheet.svelte';
	import Versions from '$lib/components/clones/Versions.svelte';
	import ItemMenu from '$lib/components/clones/ItemMenu.svelte';
	import { hasMenu, type CloneOffers } from '$lib/clones/menu';
	import { menuLabel } from '$lib/menu';
	import CommentsCard from '$lib/components/comments/CommentsCard.svelte';
	import { cloneSubtitle } from '$lib/clones/view';
	import { t } from '$lib/i18n/catalog';
	import type { AddOffer, DoneResult } from '$lib/types';
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
	const Practice = $derived(practiceFor(type));
	/**
	 * The exercise in the URL. A group drill's page shows the person's entry
	 * (`data.exercise`, another id), which an Add can swap in place: what belongs
	 * to the page goes by the URL's id. Done posts to this page's own `?/done`,
	 * with the entry's id in the form, never to the entry's URL.
	 */
	const pageId = $derived(page.params.id);
	/** Today's layout around the page: its session (`?session=1`), and Not today. */
	const today = todayPane();

	// --- The time and Done (spec "The exercise page (one page)").
	/** Counted while the page is visible, from when it opened; Done saves it. */
	const clock = pageClock();
	/** The Practise with card's last run: Done saves its player_json. */
	let run = $state<{ durationS: number; playerJson: string } | null>(null);
	/** A count or a song plays in Practise with: Done waits. */
	let playing = $state(false);
	/** Remounts Practise with after a save: its run is spent. */
	let practiceKey = $state(0);
	let doneOpen = $state(false);
	/** The fixed rhythm's save, out (no sheet holds a spinner for it). */
	let saving = $state(false);
	/** A fixed-rhythm drill: Done saves at once, no faces (plan 3 branches on it too). */
	const fixed = $derived(data.scheduleAtStart?.every != null);

	/** The fixed rhythm's Done: saves at once, the page's time and run, no face. */
	async function saveNow(): Promise<void> {
		if (saving) return;
		saving = true;
		/** The exercise this save is for: an answer landing after another one opened acts on nothing. */
		const at = pageId;
		try {
			// `act` reloads the page's data itself.
			const result = await act('done', {
				exerciseId: data.exercise.id,
				durationS: clock.seconds,
				run: run?.playerJson ?? '',
				rating: ''
			});
			if (pageId !== at) return;
			const refused = refusalMessage(result, t().exercise.log.didNotSave);
			if (refused !== null) say(refused);
			else if (result.type === 'success') saved(result.data as unknown as DoneResult);
		} finally {
			if (pageId === at) saving = false;
		}
	}

	/**
	 * After any save: the toast with Undo on the next screen, the sheet closed, then
	 * on through the session or back where the page was opened from.
	 */
	function saved(r: DoneResult): void {
		announceSaved({
			dance: data.dance.slug,
			message: savedMessage(r.backDays ?? 1),
			undo: { setId: r.setId, before: r.before }
		});
		doneOpen = false;
		run = null;
		practiceKey++;
		// A session opens its next page. Else back; with no opener to step back to (the
		// desktop's pane, a cold open) Today takes this page's entry, not one on top of it.
		if (today?.session) today.session.onnext();
		else void backWhenSettled(todayBack(data.dance.slug), { replace: true });
		clock.restart();
	}

	function done() {
		if (fixed) void saveNow();
		else doneOpen = true;
	}

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

	/** A drill's Recordings' + Add. Null for a reader and the simple page. */
	const recordings = $derived(
		data.canEditContent && !simple
			? {
					label: title,
					linkable: data.linkable,
					// Add a link's own; a section's link refuses in its picker.
					message: failure('addLink'),
					entered: form && 'urls' in form ? String(form.urls) : ''
				}
			: null
	);
	/** A drill's own sections and links, for Edit's Recordings card (unlink, remove). */
	const drillRows = $derived(
		data.practice.content.type === 'drill' && data.canEditContent && !simple
			? data.practice.content
			: null
	);

	/** "Drill · learning · 3:20" while it can be done; the type alone while editing or with nothing to log. */
	const subtitle = $derived.by(() => {
		const label = TYPES[type].label;
		if (editing) return label;
		const clone = simple ? null : cloneSubtitle(data.cloneLine);
		if (clone) return clone;
		if (!data.canLog) return label;
		return bandSubtitle({
			label,
			warmup: exercise.warmup,
			learning: !!data.scheduleAtStart?.learning,
			seconds: clock.seconds
		});
	});

	const owner = $derived(ownerOf(data.practice.content));
	const ownerHref = $derived.by(() => {
		if (!owner) return null;
		const params = { dance: data.dance.slug, id: String(owner.id) };
		if (owner.kind === 'figure') return resolve('/[dance]/(moves)/figures/[id]', params);
		if (owner.kind === 'lesson') return resolve('/[dance]/lessons/[id]', params);
		return resolve('/[dance]/(moves)/routines/[id]', params);
	});
	const tiles = $derived(historyTiles(data.summary));
	const days = $derived(historyRows(data.history, timezone, data.today));
	/** The history row whose sheet is open (kept while the sheet closes). */
	let openDay = $state<HistoryDay | null>(null);
	/** The history's rows as focus keys, taken when a day's sheet opens: its delete refreshes them away. */
	let dayKeys: string[] = [];
	let dayOpen = $state(false);

	// --- Edit mode: the settings behind the band's pencil, one Save pinned.
	let editing = $state(false);
	/** A reader's Edit on a group drill: the Make it mine sheet (ruling 1). */
	let makingMine = $state(false);
	let savingSettings = $state(false);
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

	// --- The page's toast: a refused Done, and a deleted day with its Undo.
	let notice = $state<{ id: number; message: string; action?: string } | null>(null);
	let noticeSeq = 0;
	/**
	 * The deleted day's rows, for Undo. Taken (and cleared) by the first tap: a
	 * second tap, or a replay while the first is out, would put the day back twice.
	 */
	let undoSnapshots: string | null = null;

	function say(message: string, action?: string) {
		notice = { id: ++noticeSeq, message, action };
	}

	/** Delete this day landed: the sheet closes, the toast offers Undo, focus goes to the next day. */
	function dayDeleted(snapshots: string, label: string) {
		const gone = openDay ? `history-${openDay.day}` : null;
		dayOpen = false;
		undoSnapshots = snapshots || null;
		say(t().exercise.page.dayDeleted(label), undoSnapshots ? t().common.undo : undefined);
		if (gone) void focusAfterRemoval(dayKeys, gone, 'exercise-done');
	}

	async function undo() {
		const snapshots = undoSnapshots;
		undoSnapshots = null;
		// The toast goes at the tap, Undo with it, so it cannot be sent twice;
		// the day coming back is the answer.
		notice = null;
		if (!snapshots) return;
		const result = await act('restoreDay', { snapshots });
		const refused = refusalMessage(result, t().exercise.refused.dayPutBack);
		if (refused !== null) say(refused);
	}

	/*
	 * Another exercise opened in this page (a row beside it, on the desktop):
	 * SvelteKit keeps the page, so what was the last one's goes with it. An edit
	 * left open would otherwise show the new exercise with the old one's
	 * settings, and save it there; the time starts again.
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
			undoSnapshots = null;
			doneOpen = false;
			dayOpen = false;
			run = null;
			playing = false;
			saving = false;
			clock.restart();
		});
	});
	/** An entry on its class drill's setting: the page says whose it is, at every level. */
	const followsTeacher = $derived(
		exercise.comesBackOwn === null && exercise.comesBackTeacher !== null
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

{#snippet practice()}
	{#if Practice && data.canLog}
		<!-- Another exercise opened in the page (desktop) or a save: a fresh panel, nothing of the last one carried over. -->
		{#key `${pageId}:${practiceKey}`}
			<Practice
				dance={data.dance}
				exercise={data.exercise}
				content={data.practice.content}
				songs={data.songs}
				takes={data.takes}
				playerFrom="from=exercise"
				onrun={(r) => (run = r)}
				onactive={(on) => (playing = on)}
			/>
		{/key}
	{/if}
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

<!--
	The exercise: the left column on the desktop, the top of the phone's page. Owner
	row, the type's content (Practise with, a drill's Recordings), from class, the
	class's comments, Add. While editing, the settings in its place.
-->
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
			<h2 class={SECTION_LABEL} data-focus="exercise-settings" tabindex="-1">
				{t().exercise.page.settings}
			</h2>
			<form
				id="exercise-settings"
				method="POST"
				action="?/update"
				bind:this={settingsForm}
				use:guarded={{
					label: t().exercise.page.settingsLabel,
					submit: () => {
						savingSettings = true;
						updateError = null;
						return async ({ update, result }) => {
							try {
								await update({ reset: false });
							} finally {
								savingSettings = false;
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
							aria-busy={savingSettings}
							disabled={savingSettings}
						>
							{#if savingSettings}<Spinner /><span class="sr-only">{t().exercise.log.saving}</span
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
			<!-- A drill's own Recordings, to unlink and remove (board drill-editing). -->
			{#if drillRows && drillRows.sections.length + drillRows.links.length > 0}
				<DrillRecordings
					sections={drillRows.sections}
					links={drillRows.links}
					canEdit={data.canEditContent}
					editing
					recordings={null}
					after={['exercise-archive', 'exercise-settings']}
				/>
			{/if}
			{#if ownsItself}
				<div class="flex flex-col items-center pt-1">
					<button
						type="button"
						data-focus="exercise-archive"
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
		<Content
			dance={data.dance}
			content={data.practice.content}
			{timezone}
			onPage
			canEdit={data.canEditContent && !simple}
			{simple}
			{recordings}
			{practice}
		/>
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
{/snippet}

<!-- The right column on the desktop, the rest of the phone's page: Music, History, Settings, Not today. -->
{#snippet aside()}
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
				{#if data.summary.times === 0}
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
							<div class="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3">
								<span class="font-display text-[28px] leading-[1.05] font-extrabold text-ink"
									>{tile.value}</span
								>
								<span class="text-[13px] font-bold text-muted">{tile.label}</span>
							</div>
						{/each}
					</div>
					<ul class={GROUP}>
						{#each days as d (d.day)}
							<li>
								<button
									type="button"
									data-focus="history-{d.day}"
									aria-haspopup="dialog"
									class="flex min-h-14 w-full cursor-pointer flex-col justify-center gap-0.5 px-4 py-2.5 text-left"
									onclick={() => {
										openDay = d;
										dayKeys = days.map((x) => `history-${x.day}`);
										dayOpen = true;
									}}
								>
									<span class="flex w-full items-center gap-3">
										<span class="min-w-0 flex-1 text-[16px] leading-tight font-bold text-ink"
											>{d.label}</span
										>
										{#if d.amount}<span class="text-[15px] text-muted">{d.amount}</span>{/if}
										{#if d.feel}<Face feel={d.feel} size={22} label />{/if}
									</span>
									{#if d.note}<span class="text-[14px] leading-snug text-muted">{d.note}</span>{/if}
								</button>
							</li>
						{/each}
					</ul>
					{#if data.historyCut}
						<p class="px-4 text-[12px] text-muted">
							{t().exercise.page.showingLatest(days.length)}
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
			<!-- Not today: quiet text at the very end, with what it does under it. -->
			{#if canSkip}
				<div class="flex flex-col items-center gap-0.5 pt-1">
					<button
						type="button"
						class={button('tertiary', 'md')}
						aria-busy={skipping}
						disabled={skipping}
						onclick={notToday}>{t().today.row.notToday}</button
					>
					<p class="text-[13px] text-muted">{t().exercise.page.comesBack}</p>
				</div>
			{/if}
		{/if}
	{/if}
{/snippet}

{#snippet whole()}
	{@render about()}
	{@render aside()}
{/snippet}

{#snippet back()}
	<BackButton fallback={todayBack(data.dance.slug)} />
{/snippet}

{#snippet lastTime()}
	<LastTime last={data.practice.last} />
{/snippet}

<Screen
	compact
	width={data.canLog ? 'two' : 'one'}
	{title}
	{subtitle}
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
		from a 780 px pane two columns, 1 : 1, the exercise on the left and Music,
		History and Settings on the right; one column below that, in the phone's order.
		Versions (its toast is `fixed`) sits above the columns: nothing pinned lives in
		their container. Done is pinned at both widths, so the foot leaves it room.
	-->
	<div class="flex flex-col gap-3.5 {editing ? 'pb-28 desk:pb-0' : 'pb-28'}">
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
			top={data.canLog ? undefined : whole}
			left={data.canLog ? about : nothing}
			right={data.canLog ? aside : nothing}
		/>
	</div>
</Screen>

{#if editing}
	<!-- The phone's Save: the desktop saves in place. -->
	<BottomBar mode class="desk:hidden">
		<button
			type="submit"
			form="exercise-settings"
			class={button('primary', 'md', true)}
			aria-busy={savingSettings}
			disabled={savingSettings}
		>
			{#if savingSettings}<Spinner /><span class="sr-only">{t().exercise.log.saving}</span
				>{:else}{t().common.save}{/if}
		</button>
	</BottomBar>
{:else if data.canLog}
	<DoneBar
		doneToday={data.entryToday !== null}
		{playing}
		busy={saving}
		sheet={!fixed}
		onclick={done}
	/>
{/if}

<Toast
	toast={notice}
	bottom="calc(5.75rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)))"
	onaction={undo}
	ondismiss={() => {
		notice = null;
		undoSnapshots = null;
	}}
/>

{#if data.canLog}
	<DoneSheet
		open={doneOpen}
		onclose={() => (doneOpen = false)}
		action="?/done"
		exerciseId={data.exercise.id}
		subtitle={doneSubtitle({
			seconds: clock.seconds,
			learning: data.scheduleAtStart?.learning ?? null,
			day: null,
			name: title
		})}
		faces={data.faces}
		seconds={clock.seconds}
		run={run?.playerJson ?? null}
		day={null}
		{simple}
		current={data.entryToday}
		onsaved={saved}
	/>
{/if}

{#if openDay}
	<HistoryDaySheet
		open={dayOpen}
		onclose={() => (dayOpen = false)}
		day={openDay}
		exerciseId={data.exercise.id}
		ondeleted={dayDeleted}
	/>
{/if}

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
		body={archiveBody(exercise.name, data.summary.times)}
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
