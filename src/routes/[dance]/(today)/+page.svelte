<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { levelShown, simple } from '$lib/levels/levels';
	import DoneSheet from '$lib/components/exercises/DoneSheet.svelte';
	import PastDay from '$lib/components/today/PastDay.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import CalendarSheet from '$lib/components/today/CalendarSheet.svelte';
	import DayStrip from '$lib/components/today/DayStrip.svelte';
	import { calendarMonths } from '$lib/exercises/calendar';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import { dayLabel, lastDoneLabel } from '$lib/format';
	import { daysBetween } from '$lib/day/day';
	import { mergeDay } from '$lib/exercises/day-entry';
	import { addedMessage, changedMessage, doneSubtitle } from '$lib/exercises/done-view';
	import { announceSaved } from '$lib/exercises/saved.svelte';
	import { actAt } from '$lib/act';
	import { offlineRefusal, refusalMessage } from '$lib/act-toast';
	import { t } from '$lib/i18n/catalog';
	import type { DoneResult } from '$lib/types';
	import type { PageData } from './$types';

	/*
	 * A past day (`?day=`): what was logged, and Done added after the fact (a row,
	 * or Add an exercise to this day); the day strip and its calendar go to another
	 * day. Today itself is the (today) layout's list;
	 * this page draws nothing then (on the desktop the list's pane is the day so
	 * far, the layout's too).
	 */
	let { data }: { data: PageData } = $props();

	/** The exercise the Done sheet is for; kept while the sheet closes, so it closes as it was. */
	let pickedId = $state<number | null>(null);
	let doneOpen = $state(false);
	/** The calendar sheet, from the day strip's middle. */
	let calendarOpen = $state(false);

	// Every live exercise, paused ones too: a forgotten day can go on any of them.
	const picked = $derived(data.list.exercises.find((e) => e.id === pickedId) ?? null);
	/** That exercise's entry on the day, its rows read as one: the sheet starts from it. */
	const entry = $derived.by(() => {
		const rows = data.past?.daySets.filter((s) => s.exerciseId === pickedId) ?? [];
		return rows.length === 0 ? null : mergeDay(rows);
	});

	/** A fixed-rhythm drill stores no face: its past day saves at once, like its page's Done. */
	const fixedRhythm = (id: number) =>
		data.list.exercises.find((e) => e.id === id)?.comesBack.kind === 'every';

	/** The picked exercise had an entry that day: its save is a change, not an add. */
	let changing = false;

	function pick(id: number) {
		pickedId = id;
		changing = !!data.past?.daySets.some((s) => s.exerciseId === id);
		// A fixed rhythm with no entry yet saves at once; one with an entry opens the sheet.
		if (fixedRhythm(id) && data.past && !changing) void saveFixed(id, data.past.day);
		else doneOpen = true;
	}

	/** No sheet, no face, no note field (the day keeps its note): the day's row is added to. */
	async function saveFixed(id: number, day: string) {
		const result = await actAt(`/${data.dance.slug}`, 'done', { exerciseId: id, day, rating: '' });
		const refused = refusalMessage(result, t().exercise.log.didNotSave);
		if (refused !== null) {
			if (!offlineRefusal(result))
				announceSaved({ dance: data.dance.slug, message: refused, undo: null });
		} else if (result.type === 'success') saved(result.data as unknown as DoneResult, day);
	}

	/** Added: the sheet closes, and "Added to Thu 5 Nov · Undo" shows over the day. */
	function saved(r: DoneResult, day: string) {
		doneOpen = false;
		announceSaved({
			dance: data.dance.slug,
			message: changing ? changedMessage(day) : addedMessage(day),
			undo: { setId: r.setId, before: r.before }
		});
	}

	/** Each exercise's type and partner, for a past day's tiles; archived ones are absent. */
	const kinds = $derived(
		Object.fromEntries(
			data.list.exercises.map((e) => [e.id, { source: e.source, partner: e.partner }])
		)
	);
</script>

<svelte:head>
	{#if data.past}<title>{dayLabel(data.past.day)} · {data.dance.label}</title>{/if}
</svelte:head>

{#if data.past}
	{@const past = data.past}
	{@const todayHref = resolve('/[dance]/(today)', { dance: data.dance.slug })}
	{@const prevHref = resolve(`/${data.dance.slug}?day=${past.prevDay}`)}
	{@const nextHref =
		past.nextDay === data.list.today
			? todayHref
			: resolve(`/${data.dance.slug}?day=${past.nextDay}`)}
	<Screen title={dayLabel(past.day)}>
		{#snippet extra()}
			<DayStrip
				{prevHref}
				{nextHref}
				{todayHref}
				label={lastDoneLabel(daysBetween(past.day, data.list.today))}
				onpick={() => (calendarOpen = true)}
			/>
		{/snippet}
		{#snippet slimRight()}
			<BandButton icon="chevron-left" label={t().today.list.previousDay} href={prevHref} />
			<BandButton icon="chevron-right" label={t().today.list.nextDay} href={nextHref} />
			<a
				href={todayHref}
				aria-label={t().today.list.backToToday}
				class="ml-1 inline-flex h-8 flex-none items-center rounded-full bg-band-ink px-3 text-[14px] font-extrabold text-band active:opacity-80"
				>{t().shell.tabs.today}</a
			>
		{/snippet}

		<PastDay
			day={past.day}
			daySets={past.daySets}
			exercises={past.exercises}
			{kinds}
			tz={data.list.tz}
			onlog={pick}
		/>
	</Screen>

	<CalendarSheet
		open={calendarOpen}
		onclose={() => (calendarOpen = false)}
		months={calendarMonths(past.counts, past.day, data.list.today)}
		today={data.list.today}
		onpick={(day) => {
			calendarOpen = false;
			// The shown day: only the sheet closes, no second step in history.
			if (day === past.day) return;
			void gotoWhenSettled(
				day >= data.list.today ? todayHref : resolve(`/${data.dance.slug}?day=${day}`)
			);
		}}
	/>

	{#if picked}
		<DoneSheet
			open={doneOpen}
			onclose={() => (doneOpen = false)}
			action="/{data.dance.slug}?/done"
			exerciseId={picked.id}
			subtitle={doneSubtitle({ seconds: null, learning: null, day: past.day, name: picked.name })}
			faces={null}
			seconds={null}
			day={past.day}
			simple={simple(levelShown(page.data.user?.level))}
			current={entry}
			onsaved={(r) => saved(r, past.day)}
		/>
	{/if}
{/if}
