<script lang="ts">
	import { resolve } from '$app/paths';
	import { afterNavigate, invalidate, onNavigate, replaceState } from '$app/navigation';
	import { actAt } from '$lib/act';
	import { focusAfterRemoval } from '$lib/focus';
	import { desk } from '$lib/nav/desk.svelte';
	import { saved } from '$lib/exercises/saved.svelte';
	import { landedRow, shouldReplay } from '$lib/motion/landing';
	import { pinned } from '$lib/nav/chrome.svelte';
	import { page } from '$app/state';
	import { levelShown, simple } from '$lib/levels/levels';
	import { listOf } from '$lib/nav/pane';
	import ListPane from '$lib/components/shell/ListPane.svelte';
	import PaneHeading from '$lib/components/shell/PaneHeading.svelte';
	import PastDay from '$lib/components/today/PastDay.svelte';
	import TodayPaneSkeleton from '$lib/components/today/TodayPaneSkeleton.svelte';
	import TodayList from '$lib/components/today/TodayList.svelte';
	import ComingUpList from '$lib/components/today/ComingUpList.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import { besideToday } from '$lib/nav/today-pane';
	import NewExerciseSheet from '$lib/components/today/NewExerciseSheet.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import TodayBar from '$lib/components/today/TodayBar.svelte';
	import { offlineRefusal, refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
	import type { ExerciseItem } from '$lib/types';
	import { notTodayMessage, onTodayMessage, todayHero } from '$lib/exercises/today';
	import { t } from '$lib/i18n/catalog';
	import { undoAddSteps, type PickReply } from '$lib/schedule/picks';
	import { dayTotals, defaultOpen } from '$lib/exercises/today-pane';
	import { setTodayPane, type RunControls } from '$lib/components/today/today-context';
	import { dropOpener, listOpener } from '$lib/nav/trail.svelte';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { longDayLabel } from '$lib/format';
	import { nextInSession, sessionWalk } from '$lib/exercises/session';
	import { playerFrom, runHref, runOf, runStep } from '$lib/exercises/run';

	/*
	 * Today: the list and the exercise beside it (desktop spec, "Today: the list
	 * and the open exercise (Option A)"). The band, the hero and the list render
	 * here once, so opening an exercise keeps the list's scroll. On the desktop
	 * the list route opens one by itself (below); with nothing to open the pane
	 * holds the day so far. With no exercise at all (the first run) the list is a
	 * page of its own. A past day (`?day=`) is no list: its page is one column.
	 *
	 * On the phone the list route is the list, and a row opens the exercise's page.
	 */
	let { data, children } = $props();

	const l = $derived(listOf(page.route.id));
	const isList = $derived(l?.open === false);
	// Valid by now: the page's load sends any other `day` back to Today.
	// Coming up is a list route of its own (`besideToday`); a `day` in its URL means nothing.
	const onComing = $derived(page.route.id === '/[dance]/(today)/coming-up');
	// The list column shows Coming up: its page, or an exercise opened from it.
	const comingColumn = $derived(
		besideToday(page.route.id, page.url.pathname, listOpener(page.url.pathname)) === 'coming'
	);
	const past = $derived(isList && !onComing && page.url.searchParams.has('day'));
	const dance = $derived(data.dance.slug);
	/** The two lower levels: New exercise without Comes back. */
	const simpleLog = $derived(simple(levelShown(page.data.user?.level)));
	/** The exercise open: the URL's (the page beside the list on the desktop, the page itself on the phone). */
	// None on a route without an id (Done for today).
	const currentId = $derived(isList || !page.params.id ? null : Number(page.params.id));
	// The list column is in sight: always on the desktop; on the phone only on the list route (an exercise page covers it).
	const listShown = $derived(isList || desk.current);

	let creating = $state(false);
	/** Naredi vajo on a song page (`?new=hearing&song=<id>`): the sheet opens on Sluh with that song. */
	let preset = $state<{ songId: number } | null>(null);
	afterNavigate(() => {
		const q = page.url.searchParams;
		if (q.get('new') !== 'hearing') return;
		const songId = Number(q.get('song'));
		preset = Number.isInteger(songId) && songId > 0 ? { songId } : null;
		creating = true;
		// The link said it once: Back or a reload does not open the sheet again.
		const url = new URL(page.url);
		url.searchParams.delete('new');
		url.searchParams.delete('song');
		replaceState(url, page.state);
	});
	// The layout's toast: Not today, Coming up's +, a refused Next.
	let toast = $state<ToastState | null>(null);
	let toastSeq = 0;
	// The Done landing: right after a save (or Not today) Today plays what changed while it was
	// hidden, the saved row lifted (spec 2026-11-10-motion-round-1).
	const savedId = $derived(
		saved.current?.dance === data.dance.slug ? (saved.current.exerciseId ?? null) : null
	);
	const landing = $derived(shouldReplay({ savedId, layoutToast: toast !== null }));
	const landedId = $derived(
		landedRow(
			savedId,
			data.list.day.rows.map((r) => ({ id: r.exercise.id, done: r.kind === 'done' }))
		)
	);

	const day = $derived(data.list.day);
	// No live exercise at all: the first run's page.
	const empty = $derived(data.list.exercises.length === 0);

	const at = (id: number) => resolve('/[dance]/(today)/exercises/[id]', { dance, id: String(id) });

	/*
	 * The run: Start walks the day's exercises, one exercise page after another,
	 * carried in the URL (`?run=1&skip=…`, `src/lib/exercises/run.ts`). Nothing is
	 * stored: after a save the reloaded rows say what is next. The run is one
	 * history entry: Start pushes from the list, and every step after it replaces.
	 */
	// A past day (`?day=`) is a list route: `!isList` already leaves it out.
	const run = $derived(!isList && currentId !== null ? runOf(page.url.searchParams) : null);
	const step = $derived(run && currentId !== null ? runStep(dance, day, run, currentId) : null);

	/** Start: the walk's first (the warm-ups first); with nothing to walk, nothing. */
	function start() {
		// A run is never one Today opened by itself: its time counts at once.
		autoOpened = null;
		const first = nextInSession(sessionWalk(day.rows), new Set(), null);
		if (!first) return;
		const href = runHref(dance, first.exercise.id, { skip: [] });
		if (page.url.pathname + page.url.search === href) return;
		// From a run, or from Done for today beside the list (desktop): the run's one entry.
		const replaceState = run !== null || page.route.id === '/[dance]/(today)/done';
		void gotoWhenSettled(href, { replaceState });
	}

	/*
	 * One always open (desktop): the list route opens an exercise by itself, the
	 * first to-do row, else the first picked (`defaultOpen`), never as a run. It
	 * goes to the exercise's own URL with a replace (no history entry), so every
	 * form in the pane posts to its own route, and a Back from it goes where
	 * /{dance} would have. With nothing to open, the pane holds the day so far.
	 * The phone never swaps: /{dance} is its list page. Not while New exercise is
	 * open: its entry is on top of history, and the replace would take its place.
	 */
	const swapTo = $derived.by(() => {
		if (past || creating || onComing || !isList) return null;
		const id = defaultOpen(day);
		return id === null ? null : at(id);
	});

	/*
	 * The swap waits for the router to settle: a `goto` while SvelteKit is still
	 * finishing a navigation (the first mount, its afterNavigate callbacks) aborts
	 * that navigation, and the trail never hears of the arrival. It also waits for
	 * a closing sheet's Back to land (`gotoWhenSettled`), so the replace takes
	 * /{dance}'s entry, not the sheet's. `swapping` keeps the effect from going
	 * twice while its own navigation loads, and clears however that ends.
	 */
	let settled = $state(false);
	let swapping = false;
	/*
	 * The exercise the swap opened, until someone is there: a tap or key in its
	 * pane (`wake`), Start, or a row or link opening it. Its page's clock waits
	 * at 0:00 until then (the page asks; the phone never sets it). A detour
	 * elsewhere (a row opening another, saved: history steps back here) leaves
	 * it waiting: only a navigation TO it that is not a history step says
	 * someone opened it.
	 */
	let autoOpened = $state<string | null>(null);
	onNavigate((nav) => {
		settled = false;
		if (autoOpened === null || nav.type === 'popstate') return;
		if (nav.to?.url.pathname !== autoOpened) return;
		const own = swapping && nav.type === 'goto';
		if (!own) autoOpened = null;
	});
	afterNavigate(() => {
		settled = true;
	});
	$effect(() => {
		const href = swapTo;
		if (!settled || !desk.current || href === null || swapping) return;
		swapping = true;
		const done = () => (swapping = false);
		autoOpened = href.split('?')[0];
		// The list is beside it: no ‹, whatever opened it before.
		gotoWhenSettled(href, { replaceState: true, keepFocus: true }, () =>
			dropOpener(href.split('?')[0])
		).then(done, done);
	});

	/*
	 * On the phone, back at the list from one of Today's own exercises the list
	 * loads again, as the list page's own load did: a save there, or a new day,
	 * shows (from elsewhere the layout's load has just run).
	 */
	afterNavigate(({ from, to }) => {
		if (!from || !to || from.url?.pathname === to.url.pathname) return;
		if (listOf(to.route.id)?.open !== false) return;
		if (desk.current) return;
		if (listOf(from.route.id)?.list === 'today') void invalidate('today:list');
	});

	/**
	 * The run as the exercise page sees it. Skip and after replace this page with
	 * the next (or Done for today), once a closing sheet's Back has landed.
	 */
	const runControls = $derived<RunControls | null>(
		run && step
			? {
					place: step.place,
					next: step.next,
					playerFrom: playerFrom(run),
					skip: () => void gotoWhenSettled(step.skipHref, { replaceState: true }),
					after: () => void gotoWhenSettled(step.afterHref, { replaceState: true })
				}
			: null
	);

	const say = (message: string) => (toast = { id: ++toastSeq, message });

	/**
	 * "Not today": the exercise leaves Today until tomorrow (a skip pick). The toast
	 * and its Undo come only once the server has said yes; a refusal says why and
	 * leaves the row where it was. True when it was skipped.
	 */
	async function notToday(exerciseId: number): Promise<boolean> {
		const row = day.rows.find((r) => r.exercise.id === exerciseId);
		if (!row || row.kind === 'done') return false;
		const keys = day.rows.map((r) => `today-row-${r.exercise.id}`);
		const result = await actAt(`/${dance}`, 'pick', { exerciseId, kind: 'skip' });
		const refused = refusalMessage(result, t().today.refused.skip);
		if (refused) {
			if (!offlineRefusal(result)) say(refused);
			return false;
		}
		const pickId = (result as { data?: { pickIds?: number[] } }).data?.pickIds?.[0];
		toast =
			pickId === undefined
				? { id: ++toastSeq, message: notTodayMessage(row.exercise.name) }
				: undoToast(
						++toastSeq,
						notTodayMessage(row.exercise.name),
						() => (toast = null),
						async () => {
							const undone = await actAt(`/${dance}`, 'unpick', { pickId });
							const m = refusalMessage(undone, t().today.refused.putBack);
							if (m && !offlineRefusal(undone)) say(m);
						}
					);
		// Else Next N, else the list's add control (New exercise, the phone's or the band's).
		void focusAfterRemoval(keys, `today-row-${exerciseId}`, ['today-next', 'today-custom']);
		return true;
	}

	setTodayPane({
		get run() {
			return runControls;
		},
		say,
		canSkip: (id) => day.rows.some((r) => r.exercise.id === id && r.kind !== 'done'),
		notToday,
		get autoOpened() {
			return autoOpened;
		},
		// Only a tap in that exercise's own pane: one in another's leaves it waiting.
		wake: () => {
			if (page.url.pathname === autoOpened) autoOpened = null;
		}
	});

	// The bar card: how many are left, done of all, about how long; its play starts the run.
	const hero = $derived(todayHero(day, data.list.estimateS));

	/** Each exercise's type and partner, for the day so far's tiles; archived ones are absent. */
	const kinds = $derived(
		Object.fromEntries(
			data.list.exercises.map((e) => [e.id, { source: e.source, partner: e.partner }])
		)
	);

	/**
	 * Coming up's + worked: "<name> is on Today · Undo". Undo puts back what the +
	 * changed (`undoAddSteps`: skips again a row it un-skipped, removes the pick it
	 * made); when it changed nothing, the toast has no Undo.
	 */
	function added(exercise: ExerciseItem, reply: PickReply) {
		const steps = undoAddSteps(exercise.id, reply);
		const message = onTodayMessage(exercise.name);
		if (steps.length === 0) {
			toast = { id: ++toastSeq, message };
			return;
		}
		toast = undoToast(
			++toastSeq,
			message,
			() => (toast = null),
			async () => {
				for (const step of steps) {
					const result = await actAt(`/${dance}`, step.action, step.fields);
					const refused = refusalMessage(result, t().today.refused.undo);
					if (refused) {
						toast = offlineRefusal(result) ? null : { id: ++toastSeq, message: refused };
						return;
					}
				}
			}
		);
	}

	const failure = (action: string) => {
		const form = page.form;
		return form && 'action' in form && form.action === action && 'message' in form
			? ((form.message as string | null | undefined) ?? null)
			: null;
	};
</script>

<svelte:head>
	{#if onComing}<title>{t().shell.lists.comingUp} · {data.dance.label}</title
		>{:else if isList && !past}<title>{t().shell.tabs.today} · {data.dance.label}</title>{/if}
</svelte:head>

{#snippet heroCard()}
	<TodayBar {hero} playLabel={t().today.hero.start} onplay={start} shown={listShown} />
{/snippet}

{#snippet bandRight()}
	{#if !comingColumn}
		<BandButton
			icon="chevron-left"
			label={t().today.list.previousDay}
			href={resolve(`/${dance}?day=${data.list.yesterday}`)}
		/>
		<BandButton
			icon="calendar"
			label={t().shell.lists.comingUp}
			href={resolve('/[dance]/(today)/coming-up', { dance })}
		/>
		<!-- New exercise is the + at every width. Settings is the phone's You tab and the desktop's side. -->
		<BandButton
			icon="plus"
			label={t().today.newExercise.title}
			focusKey="today-custom"
			onclick={() => (creating = true)}
		/>
	{/if}
{/snippet}

{#snippet comingBack()}
	<!-- The phone's ‹ (the desktop has Today's column to go back to). -->
	<span class="contents desk:hidden"
		><BackButton
			fallback={{ href: resolve('/[dance]/(today)', { dance }), label: t().shell.tabs.today }}
		/></span
	>
{/snippet}

{#snippet comingPane()}
	<p class="px-10 pt-10 text-[15px] text-muted">{t().today.list.pickToOpen}</p>
{/snippet}

{#snippet list()}
	{#if comingColumn}
		<ComingUpList
			groups={data.list.coming}
			{dance}
			today={data.list.today}
			{currentId}
			onadded={added}
			onrefused={(message) => (toast = { id: ++toastSeq, message })}
		/>
	{:else}
		<TodayList
			{day}
			{empty}
			daily={data.list.daily}
			{dance}
			lessonDays={data.list.lessonDays}
			{currentId}
			appUpdate={data.appUpdate}
			oncreate={() => (creating = true)}
			onrefused={say}
			onskip={(id) => void notToday(id)}
			shown={listShown}
			{landing}
			{landedId}
		/>
	{/if}
{/snippet}

<!--
	The pane with nothing open (desktop): what was logged today. A heading, not a
	Screen: the list's band row holds the page's one banner, main and h1.
-->
{#snippet daySoFar()}
	<PaneHeading title={t().today.list.soFar} subtitle={dayTotals(data.list.todaySets)} />
	<div class="max-w-[800px] px-10 pt-[18px] pb-10">
		<PastDay today daySets={data.list.todaySets} {kinds} tz={data.list.tz} />
	</div>
{/snippet}

<!-- The pane while the exercise Today opens by itself is on the way (desktop). -->
{#snippet paneSkeleton()}
	<TodayPaneSkeleton />
{/snippet}

{#if past}
	{@render children()}
{:else}
	<ListPane
		{list}
		hero={empty || comingColumn ? undefined : heroCard}
		{isList}
		width={400}
		solo={isList && empty && !comingColumn}
		title={comingColumn ? t().shell.lists.comingUp : t().shell.tabs.today}
		subtitle={comingColumn ? undefined : longDayLabel(data.list.today)}
		left={onComing ? comingBack : undefined}
		right={bandRight}
		empty={onComing ? comingPane : swapTo === null ? daySoFar : paneSkeleton}
		emptyBare
	>
		{@render children()}
	</ListPane>

	<!-- Above a pinned bar (a run's Skip | Done), as SavedToast sits: its Undo never on the next Done. -->
	<Toast
		{toast}
		bottom={pinned.bar
			? 'calc(5.75rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)))'
			: undefined}
		onaction={() => toast?.undo?.()}
		ondismiss={() => (toast = null)}
	/>
{/if}

{#if creating}
	<NewExerciseSheet
		{dance}
		message={failure('createExercise')}
		daily={data.list.daily}
		simple={simpleLog}
		songs={data.list.songs}
		{preset}
		values={page.form?.action === 'createExercise' && 'name' in page.form
			? { name: page.form.name as string, notes: page.form.notes as string }
			: null}
		onclose={() => {
			creating = false;
			preset = null;
		}}
	/>
{/if}
