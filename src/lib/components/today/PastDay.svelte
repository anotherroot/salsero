<script lang="ts">
	import Picker from '$lib/components/picker/Picker.svelte';
	import Face from '$lib/components/exercises/Face.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import TypeTile from '$lib/components/ui/TypeTile.svelte';
	import DayTiles from './DayTiles.svelte';
	import { GROUP, PRESS_ROW } from '$lib/components/ui/styles';
	import { pastGroups, pastLine, pastTiles } from '$lib/exercises/today';
	import { dayLabel } from '$lib/format';
	import { feelOf } from '$lib/schedule/feel';
	import { exerciseGroups } from '$lib/picker/build';
	import { t } from '$lib/i18n/catalog';
	import type { Partner, Source } from '$lib/labels';
	import type { DaySet, PickExercise } from '$lib/types';

	/*
	 * A day's entries, one row per exercise, like Done for today. A past day
	 * (`?day=`) shows its numbers on top; a row opens the Done sheet on its entry
	 * and the last row adds an exercise to the day. `today`: the day so far,
	 * beside Today's list on the desktop; the list logs, so its rows do nothing.
	 */
	let {
		day = '',
		daySets,
		exercises = [],
		kinds,
		tz,
		today = false,
		onlog
	}: {
		/** The past day; not read for `today`. */
		day?: string;
		daySets: DaySet[];
		exercises?: PickExercise[];
		/** By exercise id; an archived exercise is missing. */
		kinds: Record<number, { source: Source; partner: Partner | null }>;
		/** The person's zone: an entry's time of day. */
		tz: string;
		today?: boolean;
		onlog?: (exerciseId: number) => void;
	} = $props();

	let picking = $state(false);
	const groups = $derived(pastGroups(daySets));
	const adding = $derived(!today && !!onlog);
</script>

{#snippet content(g: (typeof groups)[number], live: boolean)}
	{@const feel = feelOf(g.entry.rating)}
	{#if live}<TypeTile tone="accent" exercise={kinds[g.exerciseId]} />
	{:else}<TypeTile tone="done" />{/if}
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="text-[16px] leading-[1.3] font-bold break-words text-ink">{g.name}</span>
		<span class="text-[13px] leading-[1.35] text-muted">{pastLine(g.at, g.entry, tz)}</span>
		{#if g.entry.note}<span class="line-clamp-2 text-[13px] leading-[1.4] text-ink-2"
				>{t().today.past.quote(g.entry.note)}</span
			>{/if}
	</span>
	{#if feel}<Face {feel} size={30} label />{/if}
{/snippet}

<div class="flex flex-col gap-3.5">
	{#if groups.length > 0 && !today}<DayTiles tiles={pastTiles(groups.map((g) => g.entry))} />{/if}

	<ul class={GROUP}>
		{#each groups as g (g.exerciseId)}
			{@const live = !!kinds[g.exerciseId]}
			<li>
				{#if live && adding}
					<button
						type="button"
						class="flex min-h-[66px] w-full cursor-pointer items-center gap-3 py-2.5 pr-3 pl-4 text-left {PRESS_ROW}"
						aria-describedby="past-edit-hint"
						onclick={() => onlog?.(g.exerciseId)}
					>
						{@render content(g, live)}
						<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
					</button>
				{:else}
					<!-- Archived (it can take no entry), or the day so far: the list beside it logs. -->
					<div class="flex min-h-[66px] items-center gap-3 px-4 py-2.5">
						{@render content(g, live)}
					</div>
				{/if}
			</li>
		{:else}
			<li class="flex flex-col items-center gap-1 px-5 pt-5 pb-4 text-center">
				<span class="text-[16px] font-bold text-ink"
					>{today ? t().today.past.nothingToday : t().today.past.nothingThatDay}</span
				>
				{#if adding}<span class="text-[14px] text-muted">{t().today.past.ifPractised}</span>{/if}
			</li>
		{/each}
		{#if adding}
			<li>
				<button
					type="button"
					class="flex min-h-14 w-full cursor-pointer items-center justify-center gap-1.5 px-4 text-[15px] font-extrabold text-accent-text"
					data-focus="past-add"
					onclick={() => (picking = true)}
					><Icon name="plus" size={20} />{t().today.past.add}</button
				>
			</li>
		{/if}
	</ul>
</div>

{#if adding}
	<span id="past-edit-hint" class="sr-only">{t().today.past.editHint}</span>
	<Picker
		open={picking}
		title={t().today.past.logOn(dayLabel(day))}
		placeholder={t().today.past.search}
		groups={exerciseGroups(exercises)}
		kind="act"
		nothingLeft={t().today.past.none}
		onpick={(row) => {
			picking = false;
			onlog?.(row.value);
		}}
		onclose={() => (picking = false)}
	/>
{/if}
