<script lang="ts">
	import { resolve } from '$app/paths';
	import { logFor } from '$lib/components/exercises/kinds';
	import PastDay from '$lib/components/today/PastDay.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { dayLabel, lastDoneLabel } from '$lib/format';
	import { daysBetween } from '$lib/day/day';
	import { typeOf } from '$lib/exercises/kinds';
	import type { ActionData, PageData } from './$types';

	/*
	 * A past day (`?day=`): what was logged, and a set added after the fact. Today
	 * itself is the (today) layout's list; this page draws nothing then (on the
	 * desktop the list's pane is the day so far, the layout's too).
	 */
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let openId = $state<number | null>(null);

	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const rows = $derived([
		...data.list.plan.doneToday,
		...data.list.plan.due,
		...data.list.plan.upcoming,
		...data.list.plan.inactive
	]);
	const open = $derived(rows.find((r) => r.exercise.id === openId)?.exercise ?? null);
	const openSets = $derived(data.past?.daySets.filter((s) => s.exerciseId === openId) ?? []);
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

<svelte:head>
	{#if data.past}<title>{dayLabel(data.past.day)} · {data.dance.label}</title>{/if}
</svelte:head>

{#if data.past}
	{@const past = data.past}
	<Screen
		title={dayLabel(past.day)}
		subtitle={lastDoneLabel(daysBetween(past.day, data.list.today))}
	>
		{#snippet right()}
			<BandButton
				icon="chevron-left"
				label="Previous day"
				href={resolve(`/${data.dance.slug}?day=${past.prevDay}`)}
			/>
			<BandButton
				icon="chevron-right"
				label="Next day"
				href={past.nextDay === data.list.today
					? resolve('/[dance]/(today)', { dance: data.dance.slug })
					: resolve(`/${data.dance.slug}?day=${past.nextDay}`)}
			/>
		{/snippet}
		{#snippet extra()}
			<a
				href={resolve('/[dance]/(today)', { dance: data.dance.slug })}
				class="inline-flex h-11 items-center"
			>
				<span
					class="inline-flex h-8 items-center gap-1.5 rounded-2xl bg-band-track pr-3.5 pl-2.5 text-[14px] font-extrabold text-band-small"
					><Icon name="calendar" size={18} />Back to today</span
				>
			</a>
		{/snippet}

		<PastDay
			day={past.day}
			daySets={past.daySets}
			exercises={past.exercises}
			{kinds}
			{timezone}
			onlog={(id) => (openId = id)}
		/>
	</Screen>

	{#if open && Log}
		{#key open.id}
			<Log
				dance={data.dance}
				exercise={open}
				sets={openSets}
				songs={data.list.songs}
				takes={data.list.takes}
				backfillDay={past.day}
				{timezone}
				message={failure('log')}
				onclose={() => (openId = null)}
			/>
		{/key}
	{/if}
{/if}
