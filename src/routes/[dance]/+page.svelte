<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ExerciseRow from '$lib/components/today/ExerciseRow.svelte';
	import { logFor } from '$lib/components/exercises/kinds';
	import type { SessionControls } from '$lib/components/exercises/LogShell.svelte';
	import PastDay from '$lib/components/today/PastDay.svelte';
	import NewExerciseSheet from '$lib/components/today/NewExerciseSheet.svelte';
	import AppUpdateBar from '$lib/components/system/AppUpdateBar.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import HeroCard from '$lib/components/ui/HeroCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button, GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import { heroFor, shownRows, teamOfRow, todayBands, type BandKey } from '$lib/exercises/today';
	import { classDayLabel, dayLabel, lastDoneLabel, longDayLabel } from '$lib/format';
	import { daysBetween } from '$lib/day/day';
	import { typeOf } from '$lib/exercises/kinds';
	import { nextInSession, sessionSummary } from '$lib/exercises/session';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let openId = $state<number | null>(null);
	let creating = $state(false);
	let showInactive = $state(false);

	// A session walks Today's due/upcoming bands one popup at a time. It lives
	// entirely in the URL flag plus this page's own state — nothing is stored,
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
	const bands = $derived(todayBands(data.plan, teamOfRow));
	const walkDue = $derived(shownRows(bands, 'due'));
	const walkUpcoming = $derived(shownRows(bands, 'upcoming'));
	const firstUp = $derived(nextInSession(walkDue, walkUpcoming, skipped, null));
	const nextUp = $derived(nextInSession(walkDue, walkUpcoming, skipped, openId));

	function startSession() {
		skipped = new Set();
		tally = { count: 0, seconds: 0 };
		sessionEnded = false;
		void goto(resolve(`/${data.dance.slug}?session=1`), { keepFocus: true, noScroll: true });
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
		void goto(resolve('/[dance]', { dance: data.dance.slug }), { keepFocus: true, noScroll: true });
	}

	// A reload keeps the flag; pick up at the current first row.
	onMount(() => {
		if (sessionOn && openId === null) openId = firstUp?.exercise.id ?? null;
	});

	const session = $derived<SessionControls | null>(
		sessionOn && data.isToday
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
		heroFor(data.plan, {
			on: sessionOn,
			next: firstUp?.exercise.name ?? null,
			logged: tally.count
		})
	);
	// Only a Resume names a next row, so only then is one tinted "Up next".
	const upNextId = $derived(hero?.kind === 'resume' ? (firstUp?.exercise.id ?? null) : null);

	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	/** "Wed 28 Oct" for a lesson's row, null for any other type. */
	const lessonDayOf = (e: { lessonId: number | null }) => {
		const day = e.lessonId === null ? undefined : data.lessonDays[e.lessonId];
		return day ? classDayLabel(day, data.today) : null;
	};
	// Every band, so opening a row by id works wherever it sits.
	const rows = $derived([
		...data.plan.doneToday,
		...data.plan.due,
		...data.plan.upcoming,
		...data.plan.inactive
	]);
	const open = $derived(rows.find((r) => r.exercise.id === openId)?.exercise ?? null);
	const openSets = $derived(data.daySets.filter((s) => s.exerciseId === openId));
	const Log = $derived(open ? logFor(typeOf(open.source)) : null);

	/** Each exercise's type and partner, for a past day's tiles; archived ones are absent. */
	const kinds = $derived(
		Object.fromEntries(
			rows.map((r) => [r.exercise.id, { source: r.exercise.source, partner: r.exercise.partner }])
		)
	);

	const failure = (action: string) =>
		form && 'action' in form && form.action === action && 'message' in form
			? (form.message ?? null)
			: null;
</script>

<svelte:head
	><title>{data.isToday ? 'Today' : dayLabel(data.day)} · {data.dance.label}</title></svelte:head
>

{#snippet bandRows(b: (typeof bands)[number])}
	{#if b.own.length > 0}
		<ul class={GROUP}>
			{@render rowsOf(b.key, b.own)}
		</ul>
	{/if}
	{#each b.teams as part (part.team.id)}
		<!-- A group's rows under its name: what the group's lessons put on Today. -->
		<h3 class="flex items-center gap-1.5 {SECTION_LABEL}" class:pt-1.5={b.own.length > 0}>
			<Icon name="people" size={16} />{part.label}
		</h3>
		<ul class={GROUP} aria-label={part.team.name}>
			{@render rowsOf(b.key, part.rows)}
		</ul>
	{/each}
{/snippet}

{#snippet rowsOf(key: BandKey, list: typeof data.plan.due)}
	{#each list as row (row.exercise.id)}
		<ExerciseRow
			{row}
			band={key}
			dance={data.dance.slug}
			lastRating={data.lastRatings[row.exercise.id] ?? null}
			lessonDay={lessonDayOf(row.exercise)}
			upNext={row.exercise.id === upNextId}
			onlog={() => (openId = row.exercise.id)}
		/>
	{/each}
{/snippet}

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

{#if data.isToday}
	<Screen title="Today" subtitle={longDayLabel(data.today)} hero={hero ? heroCard : undefined}>
		{#snippet right()}
			<BandButton
				icon="chevron-left"
				label="Previous day"
				href={resolve(`/${data.dance.slug}?day=${data.prevDay}`)}
			/>
			<BandButton icon="settings" label="Settings" href={resolve('/settings')} />
		{/snippet}

		{#if data.appUpdate?.state === 'available'}
			<div class="pt-3"><AppUpdateBar update={data.appUpdate} /></div>
		{/if}

		{#if bands.length === 0}
			<div class="pt-10">
				<EmptyState
					icon="calendar"
					title="Nothing to practise yet"
					body="Build a routine from your figures, or add a custom exercise."
				>
					{#snippet action()}
						<div class="flex w-[260px] flex-col gap-2">
							<a
								href={resolve('/[dance]/(moves)/routines', { dance: data.dance.slug })}
								class={button('primary', 'md', true)}
								><Icon name="route" size={20} />Build a routine</a
							>
							<button
								type="button"
								class={button('secondary', 'md', true)}
								onclick={() => (creating = true)}
								><Icon name="plus" size={20} />Custom exercise</button
							>
						</div>
					{/snippet}
				</EmptyState>
			</div>
		{:else}
			{#each bands as b, i (b.key)}
				{#if b.key === 'inactive'}
					<!-- Parked exercises fold away, closed by default. -->
					<button
						type="button"
						class="flex min-h-11 w-full cursor-pointer items-center justify-between pr-2 pl-4 text-muted"
						class:mt-1.5={i > 0}
						aria-expanded={showInactive}
						aria-controls="band-inactive"
						onclick={() => (showInactive = !showInactive)}
					>
						<span class="text-[13px] font-bold">{b.label}</span>
						<Icon name={showInactive ? 'chevron-up' : 'chevron-down'} size={20} />
					</button>
					<div id="band-inactive" class="flex flex-col gap-2" hidden={!showInactive}>
						{@render bandRows(b)}
					</div>
				{:else}
					<section aria-labelledby="band-{b.key}-h" class="flex flex-col gap-2">
						<h2 id="band-{b.key}-h" class={SECTION_LABEL} class:pt-3.5={i > 0}>{b.label}</h2>
						{@render bandRows(b)}
					</section>
				{/if}
			{/each}

			<button
				type="button"
				class="mt-1.5 {button('secondary', 'md', true)}"
				onclick={() => (creating = true)}><Icon name="plus" size={20} />Custom exercise</button
			>
		{/if}
	</Screen>
{:else}
	<Screen title={dayLabel(data.day)} subtitle={lastDoneLabel(daysBetween(data.day, data.today))}>
		{#snippet right()}
			<BandButton
				icon="chevron-left"
				label="Previous day"
				href={resolve(`/${data.dance.slug}?day=${data.prevDay}`)}
			/>
			{#if data.nextDay}
				<BandButton
					icon="chevron-right"
					label="Next day"
					href={data.nextDay === data.today
						? resolve('/[dance]', { dance: data.dance.slug })
						: resolve(`/${data.dance.slug}?day=${data.nextDay}`)}
				/>
			{/if}
		{/snippet}
		{#snippet extra()}
			<a
				href={resolve('/[dance]', { dance: data.dance.slug })}
				class="inline-flex h-11 items-center"
			>
				<span
					class="inline-flex h-8 items-center gap-1.5 rounded-2xl bg-band-track pr-3.5 pl-2.5 text-[14px] font-extrabold text-band-small"
					><Icon name="calendar" size={18} />Back to today</span
				>
			</a>
		{/snippet}

		<PastDay
			day={data.day}
			daySets={data.daySets}
			exercises={data.exercises}
			{kinds}
			{timezone}
			onlog={(id) => (openId = id)}
		/>
	</Screen>
{/if}

{#if open && Log}
	{#key `${open.id}:${bumpKey}`}
		<Log
			dance={data.dance}
			exercise={open}
			sets={openSets}
			songs={data.songs}
			takes={data.takes}
			backfillDay={data.isToday ? null : data.day}
			{timezone}
			message={failure('log')}
			{session}
			onlogged={(d) => {
				if (sessionOn) tally = { count: tally.count + 1, seconds: tally.seconds + (d ?? 0) };
			}}
			onclose={() => (openId = null)}
		/>
	{/key}
{/if}

{#if creating}
	<NewExerciseSheet
		message={failure('createExercise')}
		values={form && 'name' in form ? { name: form.name, notes: form.notes } : null}
		onclose={() => (creating = false)}
	/>
{/if}
