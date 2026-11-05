<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { afterNavigate, goto, onNavigate } from '$app/navigation';
	import { desk } from '$lib/nav/desk.svelte';
	import { page } from '$app/state';
	import { listOf } from '$lib/nav/pane';
	import { logFor } from '$lib/components/exercises/kinds';
	import type { SessionControls } from '$lib/components/exercises/LogShell.svelte';
	import ListPane from '$lib/components/shell/ListPane.svelte';
	import PaneHeading from '$lib/components/shell/PaneHeading.svelte';
	import PastDay from '$lib/components/today/PastDay.svelte';
	import TodayList from '$lib/components/today/TodayList.svelte';
	import NewExerciseSheet from '$lib/components/today/NewExerciseSheet.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import HeroCard from '$lib/components/ui/HeroCard.svelte';
	import { heroFor, shownRows, teamOfRow, todayBands } from '$lib/exercises/today';
	import { dayTotals } from '$lib/exercises/today-pane';
	import { longDayLabel } from '$lib/format';
	import { typeOf } from '$lib/exercises/kinds';
	import { nextInSession, sessionSummary } from '$lib/exercises/session';

	/*
	 * Today: the list and the exercise beside it (desktop spec, "Today: the list
	 * and the open exercise (Option A)"). The band, the hero and the list render
	 * here once, so opening an exercise keeps the list's scroll and the session's
	 * state; with nothing open the pane holds the day so far. With no exercise at
	 * all (the first run) the list is a page of its own. A past day (`?day=`) is
	 * no list: its page is one column.
	 *
	 * On the phone the list route looks as it always has (the hero over the band,
	 * a row's + opens its log popup) and an exercise's page is the exercise alone.
	 */
	let { data, children } = $props();

	const l = $derived(listOf(page.route.id));
	const isList = $derived(l?.open === false);
	// Valid by now: the page's load sends any other `day` back to Today.
	const past = $derived(isList && page.url.searchParams.has('day'));
	const dance = $derived(data.dance.slug);
	const currentId = $derived(isList ? null : Number(page.params.id));

	let openId = $state<number | null>(null);
	let creating = $state(false);
	// The list's Inactive fold: the layout's, so a fresh visit closes it (`afterNavigate`).
	let showInactive = $state(false);

	// A session walks Today's due/upcoming bands one popup at a time. It lives
	// entirely in the URL flag plus this layout's own state — nothing is stored,
	// so a reload recomputes "next" from the (now-refreshed) bands.
	const sessionOn = $derived(page.url.searchParams.get('session') === '1');
	let skipped = $state(new Set<number>());
	let tally = $state({ count: 0, seconds: 0 });
	// Skip ran out the list, not a log: the popup shows the summary in place
	// rather than closing itself (finding 3) — Finish is still what ends it.
	let sessionEnded = $state(false);
	// Skipping the last exercise while it has unsaved practice time must still
	// discard that run — normally a `{#key open.id}` change does it by
	// remounting, but here `openId` does not change, so this bumps the key by
	// itself: same exercise, fresh popup, old panel torn down by its onDestroy.
	let bumpKey = $state(0);
	// Each band holds the person's own rows, then each group's: the session
	// walks them in that order, as they are shown.
	const bands = $derived(todayBands(data.list.plan, teamOfRow));
	const walkDue = $derived(shownRows(bands, 'due'));
	const walkUpcoming = $derived(shownRows(bands, 'upcoming'));
	const firstUp = $derived(nextInSession(walkDue, walkUpcoming, skipped, null));
	const nextUp = $derived(nextInSession(walkDue, walkUpcoming, skipped, openId));

	function startSession() {
		skipped = new Set();
		tally = { count: 0, seconds: 0 };
		sessionEnded = false;
		void goto(resolve(`/${dance}?session=1`), { keepFocus: true, noScroll: true });
		openId = firstUp?.exercise.id ?? null;
	}

	function endSession() {
		openId = null;
		// Clear skipped/tally here too, not just on start: otherwise a stale
		// `skipped` starves `firstUp` after the session ends, hiding "Start
		// session" for a row that is still due.
		skipped = new Set();
		tally = { count: 0, seconds: 0 };
		sessionEnded = false;
		void goto(resolve('/[dance]/(today)', { dance }), { keepFocus: true, noScroll: true });
	}

	// A reload keeps the flag; pick up at the current first row.
	onMount(() => {
		if (sessionOn && openId === null) openId = firstUp?.exercise.id ?? null;
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
	 * the page's own mount was: the tally, the skips and Inactive start over and a
	 * session picks up at its current first row (after the move, so the URL's
	 * session flag is the new one). The desktop keeps them across exercises (the
	 * session walks the pane: Task 6).
	 */
	afterNavigate(({ from, to }) => {
		if (!from || !to || from.url.pathname === to.url.pathname) return;
		if (listOf(to.route.id)?.open !== false) return;
		if (desk.current) return;
		skipped = new Set();
		tally = { count: 0, seconds: 0 };
		sessionEnded = false;
		showInactive = false;
		if (sessionOn && openId === null) openId = firstUp?.exercise.id ?? null;
	});

	const session = $derived<SessionControls | null>(
		sessionOn && !past
			? {
					next: nextUp ? { name: nextUp.exercise.name } : null,
					summary: sessionSummary(tally.count, tally.seconds),
					ended: sessionEnded,
					onnext: () => (openId = nextUp?.exercise.id ?? null),
					onskip: () => {
						if (openId !== null) skipped = new Set([...skipped, openId]);
						// Nothing left: stay on this popup and show the summary + Finish
						// instead of closing behind the user's back (finding 3).
						if (nextUp) openId = nextUp.exercise.id;
						else {
							sessionEnded = true;
							bumpKey += 1;
						}
					},
					onfinish: endSession
				}
			: null
	);

	// The hero drives the session: Start, Resume (with the next name), a disabled
	// Start when everything is parked, or a quiet All done card.
	const hero = $derived(
		heroFor(data.list.plan, {
			on: sessionOn,
			next: firstUp?.exercise.name ?? null,
			logged: tally.count
		})
	);
	// Only a Resume names a next row, so only then is one tinted "Up next".
	const upNextId = $derived(hero?.kind === 'resume' ? (firstUp?.exercise.id ?? null) : null);

	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	// Every band, so opening a row by id works wherever it sits.
	const rows = $derived([
		...data.list.plan.doneToday,
		...data.list.plan.due,
		...data.list.plan.upcoming,
		...data.list.plan.inactive
	]);
	const open = $derived(rows.find((r) => r.exercise.id === openId)?.exercise ?? null);
	const openSets = $derived(data.list.todaySets.filter((s) => s.exerciseId === openId));
	const Log = $derived(open ? logFor(typeOf(open.source)) : null);

	/** Each exercise's type and partner, for the day so far's tiles; archived ones are absent. */
	const kinds = $derived(
		Object.fromEntries(
			rows.map((r) => [r.exercise.id, { source: r.exercise.source, partner: r.exercise.partner }])
		)
	);

	const failure = (action: string) => {
		const form = page.form;
		return form && 'action' in form && form.action === action && 'message' in form
			? ((form.message as string | null | undefined) ?? null)
			: null;
	};
</script>

<svelte:head>
	{#if isList && !past}<title>Today · {data.dance.label}</title>{/if}
</svelte:head>

{#snippet heroCard()}
	{#if hero}
		<HeroCard
			title={hero.title}
			meta={hero.meta}
			state={hero.kind === 'idle' ? 'disabled' : hero.kind === 'done' ? 'done' : 'default'}
			onclick={hero.kind === 'start'
				? startSession
				: hero.kind === 'resume'
					? () => (openId = firstUp?.exercise.id ?? null)
					: undefined}
		/>
	{/if}
{/snippet}

{#snippet bandRight()}
	<BandButton
		icon="chevron-left"
		label="Previous day"
		href={resolve(`/${dance}?day=${data.list.yesterday}`)}
	/>
	<!-- The phone's Settings; the desktop has it in the side, and Custom exercise here. -->
	<span class="contents desk:hidden"
		><BandButton icon="settings" label="Settings" href={resolve('/settings')} /></span
	>
	<span class="hidden desk:contents"
		><BandButton icon="plus" label="Custom exercise" onclick={() => (creating = true)} /></span
	>
{/snippet}

{#snippet list()}
	<TodayList
		{bands}
		{dance}
		lastRatings={data.list.lastRatings}
		lessonDays={data.list.lessonDays}
		today={data.list.today}
		{upNextId}
		{currentId}
		rowSearch=""
		bind:showInactive
		appUpdate={data.appUpdate}
		onlog={(id) => (openId = id)}
		oncreate={() => (creating = true)}
	/>
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

{#if past}
	{@render children()}
{:else}
	<ListPane
		{list}
		hero={hero ? heroCard : undefined}
		{isList}
		width={400}
		solo={isList && bands.length === 0}
		title="Today"
		subtitle={longDayLabel(data.list.today)}
		right={bandRight}
		empty={daySoFar}
		emptyBare
	>
		{@render children()}
	</ListPane>

	{#if open && Log}
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
				{session}
				onlogged={(d) => {
					if (sessionOn) tally = { count: tally.count + 1, seconds: tally.seconds + (d ?? 0) };
				}}
				onclose={() => (openId = null)}
			/>
		{/key}
	{/if}
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
