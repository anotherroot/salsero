<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PlanRow } from '$lib/urgency/urgency';
	import type { ExerciseItem } from '$lib/types';
	import type { DanceSlug } from '$lib/dances/dances';
	import { lastDoneLabel } from '$lib/format';
	import { frequencyLabel } from '$lib/frequency';

	interface Props {
		row: PlanRow<ExerciseItem>;
		variant: 'done' | 'due' | 'upcoming' | 'inactive';
		dance: DanceSlug;
		/** The latest set's rating, or null when it was unrated or there is none. */
		lastRating: number | null;
		/** Open this exercise's log popup. */
		onlog: () => void;
	}

	let { row, variant, dance, lastRating, onlog }: Props = $props();

	const ex = $derived(row.exercise);
	const BADGE: Record<Exclude<ExerciseItem['source'], 'figure'>, string> = {
		routine: 'Routine',
		lesson: 'Lesson',
		custom: 'Drill'
	};
	const badge = $derived(
		ex.source === 'figure'
			? ex.partner === 'solo'
				? 'Figure · solo'
				: 'Figure · partner'
			: BADGE[ex.source]
	);
</script>

<li
	class="flex items-stretch overflow-hidden rounded-xl border {variant === 'done'
		? 'border-done/30 bg-done-bg'
		: 'border-line bg-raised'} {variant === 'inactive'
		? 'opacity-60'
		: variant === 'upcoming'
			? 'opacity-75'
			: ''}"
>
	<!-- The row opens the exercise; the + logs. Logging is the thing done most, so it gets its own target. -->
	<a
		href={resolve('/[dance]/exercises/[id]', { dance, id: String(ex.id) })}
		class="min-w-0 flex-1 px-4 py-3 text-left"
	>
		<span class="block truncate text-[15px] font-medium">{ex.name}</span>
		<span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
			<span>{badge}</span>
			<span aria-hidden="true">·</span>
			{#if variant === 'done'}
				<span class="font-medium text-done"
					>{row.setsToday} {row.setsToday === 1 ? 'set' : 'sets'} today</span
				>
			{:else}
				<!-- In the due band `overdue` is true by construction. -->
				<span class={variant === 'due' ? 'font-medium text-overdue' : ''}
					>{lastDoneLabel(row.lastDoneDaysAgo)}</span
				>
				<span aria-hidden="true">·</span>
				<span>{frequencyLabel(ex.everyDays)}</span>
			{/if}
			{#if lastRating !== null}
				<span
					class="flex items-center gap-0.5"
					role="img"
					aria-label="Last rated {lastRating} of 5"
				>
					{#each [1, 2, 3, 4, 5] as n (n)}
						<span class="size-1.5 rounded-full {n <= lastRating ? 'bg-accent' : 'bg-rule'}"></span>
					{/each}
				</span>
			{/if}
		</span>
	</a>

	<button
		type="button"
		onclick={onlog}
		aria-label="Log a set of {ex.name}"
		class="grid w-14 place-items-center border-l text-[22px] font-light {variant === 'done'
			? 'border-done/30 text-done'
			: 'border-line text-accent'}">+</button
	>
</li>
