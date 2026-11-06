<script lang="ts">
	import { resolve } from '$app/paths';
	import ExerciseRow from '$lib/components/today/ExerciseRow.svelte';
	import NextRow from '$lib/components/today/NextRow.svelte';
	import NothingLeft from '$lib/components/today/NothingLeft.svelte';
	import AppUpdateBar from '$lib/components/system/AppUpdateBar.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button, GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import type { DayList } from '$lib/schedule/today-list';
	import { listLabel } from '$lib/exercises/today';
	import { classDayLabel } from '$lib/format';
	import type { AppUpdate } from '$lib/app-update/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { ExerciseItem } from '$lib/types';
	import type { Side } from '$lib/gestures/swipe';

	/**
	 * Today's list: one "Today · N" card (done, to do, picked: `dayList`'s order),
	 * "+ Next 5" as its last row when one or none is left; once nothing is left
	 * to pull, what comes next; Custom exercise; or, with no exercise at all, the
	 * first run's empty state. The (today) layout renders it once (`ListPane`):
	 * the phone's Today and, on the desktop, the column beside the open exercise,
	 * whose row is lit (`currentId`). The desktop logs from the pane, so a row has
	 * no + there, and Custom exercise is the band's +.
	 */
	let {
		day,
		empty,
		daily,
		dance,
		lessonDays,
		upNextId,
		currentId,
		rowSearch,
		appUpdate,
		onlog,
		oncreate,
		onrefused,
		onskip
	}: {
		day: DayList<ExerciseItem>;
		/** No live exercise at all: the first run. */
		empty: boolean;
		/** The daily number, for "+ Next 5". */
		daily: number;
		dance: DanceSlug;
		/** Each lesson's class day. */
		lessonDays: Record<number, string>;
		/** The session's next row (while a session is on). */
		upNextId: number | null;
		/** The exercise open beside the list. */
		currentId: number | null;
		/** Appended to each row's link. */
		rowSearch: string;
		appUpdate: AppUpdate | null;
		/** A row's +: its log popup (the phone). */
		onlog: (exerciseId: number) => void;
		/** Custom exercise: the New exercise sheet. */
		oncreate: () => void;
		/** Next was refused: the layout's toast says why. */
		onrefused: (message: string) => void;
		/** Not today, from a row's swipe: the layout posts it and shows the toast. */
		onskip: (exerciseId: number) => void;
	} = $props();

	/** The row whose "Not today" is showing (one at a time); a tap anywhere else closes it. */
	let swiped = $state<{ key: string; side: Side } | null>(null);

	/** "Wed 28 Oct" for a lesson's row, null for any other type. */
	const lessonDayOf = (e: { lessonId: number | null }) => {
		const d = e.lessonId === null ? undefined : lessonDays[e.lessonId];
		return d ? classDayLabel(d, day.today) : null;
	};
</script>

<svelte:window
	onpointerdown={(e) => {
		if (swiped && !(e.target as Element).closest?.(`[data-swipe="${swiped.key}"]`)) swiped = null;
	}}
/>

{#if appUpdate?.state === 'available'}
	<AppUpdateBar update={appUpdate} />
{/if}

{#if empty}
	<div class="pt-10">
		<EmptyState
			icon="calendar"
			title="Nothing to practise yet"
			body="Build a routine from your figures, or add a custom exercise."
		>
			{#snippet action()}
				<div class="flex w-[260px] flex-col gap-2">
					<a
						href={resolve('/[dance]/(moves)/routines', { dance })}
						class={button('primary', 'md', true)}><Icon name="route" size={20} />Build a routine</a
					>
					<button type="button" class={button('secondary', 'md', true)} onclick={oncreate}
						><Icon name="plus" size={20} />Custom exercise</button
					>
				</div>
			{/snippet}
		</EmptyState>
	</div>
{:else}
	{#if day.nothingLeft}
		<div class="pb-3.5"><NothingLeft next={day.nothingLeft} {dance} today={day.today} /></div>
	{/if}

	{#if day.rows.length > 0 || day.showNext}
		<section aria-labelledby="today-list-h" class="flex flex-col gap-2">
			<h2 id="today-list-h" class={SECTION_LABEL}>
				{listLabel(day)}
			</h2>
			<ul class={GROUP}>
				{#each day.rows as row (row.exercise.id)}
					<ExerciseRow
						{row}
						{dance}
						today={day.today}
						lessonDay={lessonDayOf(row.exercise)}
						upNext={row.exercise.id === upNextId}
						current={row.exercise.id === currentId}
						search={rowSearch}
						onlog={() => onlog(row.exercise.id)}
						onskip={row.kind === 'done' ? undefined : () => onskip(row.exercise.id)}
						swiped={swiped?.key === `today:${row.exercise.id}` ? swiped.side : null}
						onswipe={(side) => (swiped = side ? { key: `today:${row.exercise.id}`, side } : null)}
					/>
				{/each}
				{#if day.showNext}<NextRow {dance} {daily} {onrefused} />{/if}
			</ul>
		</section>
	{/if}

	<!-- The desktop's Custom exercise is the band's +. -->
	<button
		type="button"
		data-focus="today-custom"
		class="mt-3.5 {button('secondary', 'md', true)} desk:hidden"
		onclick={oncreate}><Icon name="plus" size={20} />Custom exercise</button
	>
{/if}
