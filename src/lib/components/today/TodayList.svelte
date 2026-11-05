<script lang="ts">
	import { resolve } from '$app/paths';
	import ExerciseRow from '$lib/components/today/ExerciseRow.svelte';
	import AppUpdateBar from '$lib/components/system/AppUpdateBar.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button, GROUP, SECTION_LABEL } from '$lib/components/ui/styles';
	import type { Band, BandKey } from '$lib/exercises/today';
	import { classDayLabel } from '$lib/format';
	import type { AppUpdate } from '$lib/app-update/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { ExerciseItem } from '$lib/types';
	import type { PlanRow } from '$lib/urgency/urgency';

	/**
	 * Today's list: the bands (Due, Not yet due, Done today, Inactive folded), each
	 * with the person's own rows, then each group's; Custom exercise; or, with
	 * nothing at all, the first run's empty state. The (today) layout renders it
	 * once (`ListPane`): the phone's Today and, on the desktop, the column beside
	 * the open exercise, whose row is lit (`currentId`). The desktop logs from the
	 * pane, so a row has no + there, and Custom exercise is the band's +.
	 */
	let {
		bands,
		dance,
		lastRatings,
		lessonDays,
		today,
		upNextId,
		currentId,
		rowSearch,
		appUpdate,
		showInactive = $bindable(false),
		onlog,
		oncreate
	}: {
		bands: Band<PlanRow<ExerciseItem>>[];
		dance: DanceSlug;
		/** The latest set's rating per exercise. */
		lastRatings: Record<number, number | null>;
		/** Each lesson's class day. */
		lessonDays: Record<number, string>;
		today: string;
		/** The session's next row (Resume names it). */
		upNextId: number | null;
		/** The exercise open beside the list. */
		currentId: number | null;
		/** Appended to each row's link. */
		rowSearch: string;
		appUpdate: AppUpdate | null;
		/** Inactive unfolded; the layout's, which folds it again on a fresh visit. */
		showInactive?: boolean;
		/** A row's +: its log popup (the phone). */
		onlog: (exerciseId: number) => void;
		/** Custom exercise: the New exercise sheet. */
		oncreate: () => void;
	} = $props();

	/** "Wed 28 Oct" for a lesson's row, null for any other type. */
	const lessonDayOf = (e: { lessonId: number | null }) => {
		const day = e.lessonId === null ? undefined : lessonDays[e.lessonId];
		return day ? classDayLabel(day, today) : null;
	};
</script>

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

{#snippet rowsOf(key: BandKey, list: PlanRow<ExerciseItem>[])}
	{#each list as row (row.exercise.id)}
		<ExerciseRow
			{row}
			band={key}
			{dance}
			lastRating={lastRatings[row.exercise.id] ?? null}
			lessonDay={lessonDayOf(row.exercise)}
			upNext={row.exercise.id === upNextId}
			current={row.exercise.id === currentId}
			search={rowSearch}
			onlog={() => onlog(row.exercise.id)}
		/>
	{/each}
{/snippet}

{#if appUpdate?.state === 'available'}
	<div class="pt-3"><AppUpdateBar update={appUpdate} /></div>
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

	<!-- The desktop's Custom exercise is the band's +. -->
	<button
		type="button"
		class="mt-1.5 {button('secondary', 'md', true)} desk:hidden"
		onclick={oncreate}><Icon name="plus" size={20} />Custom exercise</button
	>
{/if}
