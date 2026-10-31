<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PlanRow } from '$lib/urgency/urgency';
	import type { ExerciseItem } from '$lib/types';
	import type { DanceSlug } from '$lib/dances/dances';
	import { rowMeta, tileTone, type BandKey } from '$lib/exercises/today';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import TypeTile from '$lib/components/ui/TypeTile.svelte';
	import { iconButton } from '$lib/components/ui/styles';

	interface Props {
		row: PlanRow<ExerciseItem>;
		band: BandKey;
		dance: DanceSlug;
		/** The latest set's rating, or null when it was unrated or there is none. */
		lastRating: number | null;
		/** A lesson's class day as shown ("Wed 28 Oct"); null for every other type. */
		lessonDay: string | null;
		/** The session's next row: tinted, with an "Up next" badge and an accent tile. */
		upNext: boolean;
		/** Open this exercise's log popup. */
		onlog: () => void;
	}

	let { row, band, dance, lastRating, lessonDay, upNext, onlog }: Props = $props();

	const ex = $derived(row.exercise);
	const meta = $derived(rowMeta(row, band, lessonDay));
	const TONE = { status: 'font-bold text-status', done: 'font-bold text-done' } as const;
	// The "+" is an icon, so bare accent is allowed; swap the bare button's ink for it.
	const plus = $derived(
		iconButton('bare').replace('text-ink', band === 'doneToday' ? 'text-done' : 'text-accent')
	);
</script>

<li class="flex min-h-[66px] items-center pr-1.5 pl-4" class:bg-accent-soft={upNext}>
	<!-- The row opens the exercise; the + logs. Logging is the thing done most, so it gets its own target. -->
	<a
		href={resolve('/[dance]/exercises/[id]', { dance, id: String(ex.id) })}
		class="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1"
	>
		<TypeTile exercise={ex} tone={tileTone(band, upNext)} />
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span
				class="text-[16px] leading-[1.3] font-bold break-words {band === 'inactive'
					? 'text-muted'
					: 'text-ink'}"
				>{ex.name}{#if upNext}<span class="ml-1 inline-block align-[2px]"
						><Badge tone="accent" solid>Up next</Badge></span
					>{/if}</span
			>
			<span class="text-[13px] leading-[1.35] text-muted">
				{#each meta as part, i (i)}{i > 0 ? ' · ' : ''}<span
						class={part.tone ? TONE[part.tone] : ''}>{part.text}</span
					>{/each}{#if lastRating !== null}<span
						class="relative -top-px ml-1.5 inline-flex gap-[3px] align-middle"
						role="img"
						aria-label="Last rated {lastRating} of 5"
					>
						{#each [1, 2, 3, 4, 5] as n (n)}
							<span class="size-1.5 rounded-full {n <= lastRating ? 'bg-accent' : 'bg-field-line'}"
							></span>
						{/each}
					</span>{/if}
			</span>
		</span>
	</a>

	<button type="button" onclick={onlog} aria-label="Log a set of {ex.name}" class={plus}>
		<Icon name="plus" />
	</button>
</li>
