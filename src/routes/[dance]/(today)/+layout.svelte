<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { afterNavigate, goto, invalidate, onNavigate } from '$app/navigation';
	import { desk } from '$lib/nav/desk.svelte';
	import { page } from '$app/state';
	import { listOf } from '$lib/nav/pane';
	import { logFor } from '$lib/components/exercises/kinds';
	import type { SessionControls } from '$lib/components/exercises/LogShell.svelte';
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
	import { actAt } from '$lib/act';
	import { refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
	import type { ExerciseItem } from '$lib/types';
	import { todayHero } from '$lib/exercises/today';
	import { dayTotals, defaultOpen, sessionLine } from '$lib/exercises/today-pane';
	import { setTodayPane } from '$lib/components/today/today-context';
	import { dropOpener, listOpener } from '$lib/nav/trail.svelte';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { passNext } from '$lib/unsaved/guard.svelte';
	import type { Unsaved } from '$lib/unsaved/pending';
	import { longDayLabel } from '$lib/format';
	import { typeOf } from '$lib/exercises/kinds';
	import { nextInSession, sessionSummary, sessionWalk } from '$lib/exercises/session';

	/*
	 * Today: the list and the exercise beside it (desktop spec, "Today: the list
	 * and the open exercise (Option A)"). The band, the hero and the list render
	 * here once, so opening an exercise keeps the list's scroll and the session's
	 * state. On the desktop the list route opens one by itself (below); with
	 * nothing to open the pane holds the day so far. With no exercise at all (the
	 * first run) the list is a page of its own. A past day (`?day=`) is no list:
	 * its page is one column.
	 *
	 * On the phone the list route looks as it always has (the hero over the band,
	 * a row's + opens its log popup) and an exercise's page is the exercise alone.
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
	const currentId = $derived(isList ? null : Number(page.params.id));

	let openId = $state<number | null>(null);
	let creating = $state(false);
	// The layout's toast: a refused Next, and what later tasks add (Undo).
	let toast = $state<ToastState | null>(null);
	let toastSeq = 0;

	// A session walks Today's to-do rows, then the picked ones, one popup at a
	// time. It lives entirely in the URL flag plus this layout's own state —
	// nothing is stored, so a reload recomputes "next" from the refreshed rows.
	const sessionOn = $derived(page.url.searchParams.get('session') === '1');
	let skipped = $state(new Set<number>());
	let tally = $state({ count: 0, seconds: 0 });
	// The ids logged or skipped this session, in order: the pane's "Session · 2 of 5".
	let walked = $state<number[]>([]);
	// Skip ran out the list, not a log: the popup shows the summary in place
	// rather than closing itself (finding 3) — Finish is still what ends it.
	let sessionEnded = $state(false);
	// Skipping the last exercise while it has unsaved practice time must still
	// discard that run — normally a `{#key open.id}` change does it by
	// remounting, but here `openId` does not change, so this bumps the key by
	// itself: same exercise, fresh popup, old panel torn down by its onDestroy.
	let bumpKey = $state(0);
	const day = $derived(data.list.day);
	// No live exercise at all: the first run's page.
	const empty = $derived(data.list.exercises.length === 0);
	// What the session walks: the to-do rows, then the picked ones, as shown.
	const walkRows = $derived(sessionWalk(day.rows));
	/**
	 * The exercise the session and Next are about: the phone's popup, the
	 * desktop's pane (the URL's). The phone popup never shows on the desktop.
	 */
	const current = $derived(desk.current ? currentId : openId);
	const firstUp = $derived(nextInSession(walkRows, skipped, null));
	const nextUp = $derived(nextInSession(walkRows, skipped, current));

	const at = (id: number, search = '') =>
		resolve('/[dance]/(today)/exercises/[id]', { dance, id: String(id) }) + search;

	/**
	 * The session opens a row: the phone's popup, or on the desktop the row's own
	 * URL with the session's flag, beside the list. Start pushes (Back leaves the
	 * session); Next, Skip and a Resume inside the session replace, so the session
	 * holds one entry, as the phone's popup walk holds none of its own. `answered`:
	 * what the user has just agreed to lose at the pane's Skip question (LogShell's
	 * `skipPane`), so the navigation that follows does not ask about it again
	 * (`passNext`, set as the navigation starts, never before the wait).
	 */
	function openRow(id: number, how: 'push' | 'replace', answered: Unsaved[] = []) {
		if (!desk.current) {
			openId = id;
			return;
		}
		const href = at(id, '?session=1');
		if (page.url.pathname + page.url.search === href) return;
		void gotoWhenSettled(href, { replaceState: how === 'replace' }, () => passNext(href, answered));
	}

	/** The session's own state, gone when it ends or starts over. */
	function clearSession() {
		skipped = new Set();
		tally = { count: 0, seconds: 0 };
		walked = [];
		sessionEnded = false;
	}

	/** Logged or skipped in the session: walked, once. */
	function walk(id: number) {
		if (!walked.includes(id)) walked = [...walked, id];
	}

	function startSession() {
		clearSession();
		if (desk.current) {
			if (firstUp) openRow(firstUp.exercise.id, 'push');
			return;
		}
		void goto(resolve(`/${dance}?session=1`), { keepFocus: true, noScroll: true });
		openId = firstUp?.exercise.id ?? null;
	}

	function endSession() {
		openId = null;
		// Clear skipped/tally here too, not just on start: otherwise a stale
		// `skipped` starves `firstUp` after the session ends, hiding "Start
		// session" for a row that is still due. The desktop's goes once the URL
		// has lost its flag (the effect below): an unsaved form's Stay keeps the
		// session, and its Session done card keeps its count.
		if (!desk.current) clearSession();
		// The desktop's session is one history entry: Finish takes its place, so
		// Back from Today goes where it went before the session.
		void goto(resolve('/[dance]/(today)', { dance }), {
			keepFocus: true,
			noScroll: true,
			replaceState: desk.current
		});
	}

	// A reload keeps the flag; pick up at the current first row, or the open
	// exercise beside it (the phone's popup; the desktop opens it in the pane).
	onMount(() => {
		if (!desk.current && sessionOn && openId === null)
			openId = isList ? (firstUp?.exercise.id ?? null) : currentId;
	});

	/*
	 * The desktop's session ends however its URL goes (Back, a tab): its state
	 * goes with it, as Finish clears it. The phone's is cleared by its own ways
	 * (Finish, a fresh visit).
	 */
	let wasOn = untrack(() => sessionOn);
	$effect(() => {
		const on = sessionOn;
		if (on === wasOn) return;
		wasOn = on;
		if (!on && untrack(() => desk.current)) untrack(clearSession);
	});

	/*
	 * The window narrows in a desktop session: the phone's popup takes the open
	 * exercise, Skip and Next with it (the pane's form goes with the width). The
	 * other way, the popup goes and the pane takes its exercise (`swapTo`).
	 */
	let wasDesk = untrack(() => desk.current);
	// The exercise page's own popup is open (its Log a set): narrowing leaves it the one.
	let pageLogging = false;
	$effect(() => {
		const d = desk.current;
		if (d === wasDesk) return;
		wasDesk = d;
		if (!d)
			untrack(() => {
				if (sessionOn && !isList && openId === null && currentId !== null && !pageLogging)
					openId = currentId;
			});
	});

	/*
	 * One always open (desktop): the list route opens an exercise by itself, the
	 * first to-do row, else the first picked (`defaultOpen`); in a session, the
	 * session's first. It goes to the exercise's own URL with a replace (no
	 * history entry), so every form in the pane posts to its own route, and a
	 * Back from it goes where /{dance} would have. With nothing to open, the pane
	 * holds the day so far. The phone never swaps: /{dance} is its list page.
	 * Not while New exercise is open: its entry is on top of history, and the
	 * replace would take its place. The phone's popup is never drawn here: one
	 * left open as the window widened is the exercise the pane takes, once its
	 * entry has gone (`gotoWhenSettled`).
	 */
	const swapTo = $derived.by(() => {
		if (past || creating || onComing) return null;
		if (openId !== null)
			return openId === currentId ? null : at(openId, sessionOn ? '?session=1' : '');
		if (!isList) return null;
		if (sessionOn) return firstUp ? at(firstUp.exercise.id, '?session=1') : null;
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
	onNavigate(() => {
		settled = false;
	});
	afterNavigate(() => {
		settled = true;
	});
	$effect(() => {
		const href = swapTo;
		if (!settled || !desk.current || href === null || swapping) return;
		swapping = true;
		const done = () => (swapping = false);
		// The list is beside it: no ‹, whatever opened it before.
		gotoWhenSettled(href, { replaceState: true, keepFocus: true }, () =>
			dropOpener(href.split('?')[0])
		).then(done, done);
	});

	/*
	 * The layout outlives a move between Today and an exercise, where the page it
	 * replaces used to unmount. So, by hand: leaving for another path (Details ›,
	 * a row) closes the phone popup, as its unmount did. It is closed here, before
	 * the new page renders: the root layout's `onNavigate` has already put the
	 * sheet's entry behind the new page (`navigated`), so it goes without a Back,
	 * and by the time `afterNavigate` re-anchors the stack the sheet is gone (closed
	 * any later, `anchor()` would push its entry again: a forward orphan). Going to
	 * the list keeps it: Start session from an exercise's page (desktop) opens it
	 * on the way.
	 */
	onNavigate(({ from, to }) => {
		if (!from || !to || from.url.pathname === to.url.pathname) return;
		if (listOf(to.route.id)?.open !== false) openId = null;
	});

	/*
	 * On the phone, arriving at the list from another path is a fresh visit, as
	 * the page's own mount was: the tally and the skips start over and a
	 * session picks up at its current first row (after the move, so the URL's
	 * session flag is the new one). The desktop keeps them across exercises (the
	 * session walks the pane: Task 6). Back from one of Today's own exercises the
	 * list loads again, as the page's own load did: a set logged there, or a new
	 * day, shows (from elsewhere the layout's load has just run).
	 */
	afterNavigate(({ from, to }) => {
		if (!from || !to || from.url.pathname === to.url.pathname) return;
		if (listOf(to.route.id)?.open !== false) return;
		if (desk.current) return;
		clearSession();
		if (sessionOn && openId === null) openId = firstUp?.exercise.id ?? null;
		if (listOf(from.route.id)?.list === 'today') void invalidate('today:list');
	});

	const session = $derived<SessionControls | null>(
		sessionOn && !past
			? {
					next: nextUp ? { name: nextUp.exercise.name } : null,
					summary: sessionSummary(tally.count, tally.seconds),
					ended: sessionEnded,
					onnext: () => {
						if (nextUp) openRow(nextUp.exercise.id, 'replace');
						else if (!desk.current) openId = null;
					},
					onskip: (answered = []) => {
						if (current !== null) {
							skipped = new Set([...skipped, current]);
							walk(current);
						}
						// Nothing left: stay on this popup and show the summary + Finish
						// instead of closing behind the user's back (finding 3).
						if (nextUp) openRow(nextUp.exercise.id, 'replace', answered);
						else {
							sessionEnded = true;
							bumpKey += 1;
						}
					},
					onfinish: endSession
				}
			: null
	);

	/** A set was logged, in the popup or the pane: the session's tally and walk. */
	function logged(durationS: number | null) {
		if (!sessionOn) return;
		tally = { count: tally.count + 1, seconds: tally.seconds + (durationS ?? 0) };
		if (current !== null) walk(current);
	}

	/*
	 * The pane (desktop): the session as above, its line, and outside a session
	 * Next after a log, to the first of the walk (a push, as a row's click).
	 */
	const follow = $derived.by(() => {
		if (sessionOn || past) return null;
		const n = nextInSession(walkRows, new Set(), current);
		if (!n) return null;
		const href = at(n.exercise.id);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- `at` resolves it
		return { name: n.exercise.name, onnext: () => void goto(href) };
	});
	const line = $derived(
		sessionOn && !past && current !== null
			? sessionLine(
					walked,
					walkRows.map((r) => r.exercise.id),
					current,
					tally.count
				)
			: null
	);
	setTodayPane({
		get session() {
			return session;
		},
		get follow() {
			return follow;
		},
		get line() {
			return line;
		},
		get key() {
			return `${current}:${bumpKey}`;
		},
		logged,
		pagePopup(on) {
			pageLogging = on;
		}
	});

	// The bar card: how many are left, done of all; its play starts the session,
	// or resumes it at its next row while one is on.
	const hero = $derived(todayHero(day));
	const resuming = $derived(sessionOn && firstUp !== null);
	function play() {
		if (resuming && firstUp) openRow(firstUp.exercise.id, 'replace');
		else startSession();
	}
	// A session on names its next row: tinted "Up next".
	const upNextId = $derived(resuming ? (firstUp?.exercise.id ?? null) : null);

	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	// Every live exercise, so opening one by id works wherever it sits.
	const open = $derived(data.list.exercises.find((e) => e.id === openId) ?? null);
	const openSets = $derived(data.list.todaySets.filter((s) => s.exerciseId === openId));
	const Log = $derived(open ? logFor(typeOf(open.source)) : null);

	/** Each exercise's type and partner, for the day so far's tiles; archived ones are absent. */
	const kinds = $derived(
		Object.fromEntries(
			data.list.exercises.map((e) => [e.id, { source: e.source, partner: e.partner }])
		)
	);

	/** Coming up's + worked: "<name> is on Today · Undo" (Undo removes that pick). */
	function added(exercise: ExerciseItem, pickId: number | undefined) {
		toast = undoToast(
			++toastSeq,
			`${exercise.name} is on Today`,
			() => (toast = null),
			async () => {
				if (pickId === undefined) return;
				const result = await actAt(`/${dance}`, 'unpick', { pickId });
				const message = refusalMessage(result, 'Could not undo that. Try again.');
				if (message) toast = { id: ++toastSeq, message };
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
	{#if onComing}<title>Coming up · {data.dance.label}</title>{:else if isList && !past}<title
			>Today · {data.dance.label}</title
		>{/if}
</svelte:head>

{#snippet heroCard()}
	<TodayBar {hero} playLabel={resuming ? 'Resume session' : 'Start session'} onplay={play} />
{/snippet}

{#snippet bandRight()}
	{#if !comingColumn}
		<BandButton
			icon="chevron-left"
			label="Previous day"
			href={resolve(`/${dance}?day=${data.list.yesterday}`)}
		/>
		<!-- Coming up: beside Settings on the phone, in the band row on the desktop. -->
		<BandButton
			icon="calendar"
			label="Coming up"
			href={resolve('/[dance]/(today)/coming-up', { dance })}
		/>
		<!-- The phone's Settings; the desktop has it in the side, and Custom exercise here. -->
		<span class="contents desk:hidden"
			><BandButton icon="settings" label="Settings" href={resolve('/settings')} /></span
		>
		<span class="hidden desk:contents"
			><BandButton icon="plus" label="Custom exercise" onclick={() => (creating = true)} /></span
		>
	{/if}
{/snippet}

{#snippet comingBack()}
	<!-- The phone's ‹ (the desktop has Today's column to go back to). -->
	<span class="contents desk:hidden"
		><BackButton
			fallback={{ href: resolve('/[dance]/(today)', { dance }), label: 'Today' }}
		/></span
	>
{/snippet}

{#snippet comingPane()}
	<p class="px-10 pt-10 text-[15px] text-muted">Pick an exercise to open it.</p>
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
			{upNextId}
			{currentId}
			rowSearch={sessionOn && desk.current ? '?session=1' : ''}
			appUpdate={data.appUpdate}
			onlog={(id) => (openId = id)}
			oncreate={() => (creating = true)}
			onrefused={(message) => (toast = { id: ++toastSeq, message })}
		/>
	{/if}
{/snippet}

<!--
	The pane with nothing open (desktop): what was logged today. A heading, not a
	Screen: the list's band row holds the page's one banner, main and h1.
-->
{#snippet daySoFar()}
	<PaneHeading title="Today so far" subtitle={dayTotals(data.list.todaySets)} />
	<div class="max-w-[800px] px-10 pt-[18px] pb-10">
		<PastDay today daySets={data.list.todaySets} {kinds} {timezone} />
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
		title={comingColumn ? 'Coming up' : 'Today'}
		subtitle={comingColumn ? undefined : longDayLabel(data.list.today)}
		left={onComing ? comingBack : undefined}
		right={bandRight}
		empty={onComing ? comingPane : swapTo === null ? daySoFar : paneSkeleton}
		emptyBare
	>
		{@render children()}
	</ListPane>

	<!-- The phone's popup; on the desktop the pane holds the log form (never both). -->
	{#if open && Log && !desk.current}
		{#key `${open.id}:${bumpKey}`}
			<Log
				dance={data.dance}
				exercise={open}
				sets={openSets}
				songs={data.list.songs}
				takes={data.list.takes}
				backfillDay={null}
				{timezone}
				message={failure('log')}
				action="/{dance}?/log"
				schedule={data.list.schedulesAtStart[open.id]}
				today={data.list.today}
				{session}
				onlogged={logged}
				onclose={() => (openId = null)}
			/>
		{/key}
	{/if}

	<Toast {toast} onaction={() => toast?.undo?.()} ondismiss={() => (toast = null)} />
{/if}

{#if creating}
	<NewExerciseSheet
		{dance}
		message={failure('createExercise')}
		values={page.form?.action === 'createExercise' && 'name' in page.form
			? { name: page.form.name as string, notes: page.form.notes as string }
			: null}
		onclose={() => (creating = false)}
	/>
{/if}
