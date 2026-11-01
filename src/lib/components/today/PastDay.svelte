<script lang="ts">
	import Picker from '$lib/components/picker/Picker.svelte';
	import PickerOpener from '$lib/components/picker/PickerOpener.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import TypeTile from '$lib/components/ui/TypeTile.svelte';
	import { GROUP, LABEL, SECTION_LABEL, iconButton } from '$lib/components/ui/styles';
	import { timeOfDay } from '$lib/day/day';
	import { pastGroups } from '$lib/exercises/today';
	import { dayLabel, setSummary } from '$lib/format';
	import { exerciseGroups } from '$lib/picker/build';
	import type { Partner, Source } from '$lib/labels';
	import type { DaySet, PickExercise } from '$lib/types';

	let {
		day,
		daySets,
		exercises,
		kinds,
		timezone,
		onlog
	}: {
		day: string;
		daySets: DaySet[];
		exercises: PickExercise[];
		/** By exercise id; an archived exercise is missing. */
		kinds: Record<number, { source: Source; partner: Partner | null }>;
		timezone: string;
		onlog: (exerciseId: number) => void;
	} = $props();

	let picking = $state(false);
	const groups = $derived(pastGroups(daySets));
</script>

{#if groups.length > 0}
	<section class="flex flex-col gap-2" aria-labelledby="past-h">
		<h2 id="past-h" class={SECTION_LABEL}>Logged that day · {groups.length}</h2>
		{#each groups as g (g.exerciseId)}
			<div class={GROUP}>
				<div class="pl-4">
					<div class="flex min-h-[60px] items-center gap-3 py-2 pr-1.5">
						<TypeTile tone="done" exercise={kinds[g.exerciseId]} />
						<span class="min-w-0 flex-1 text-[16px] font-bold break-words text-ink">{g.name}</span>
						{#if kinds[g.exerciseId]}
							<!-- An archived exercise can't take a set, so it gets no "+". -->
							<button
								type="button"
								class={iconButton('bare', 'accent')}
								aria-label="Add a set of {g.name} to this day"
								onclick={() => onlog(g.exerciseId)}><Icon name="plus" size={24} /></button
							>
						{/if}
					</div>
				</div>
				{#each g.sets as s (s.id)}
					<div class="pl-[68px]">
						<div class="flex gap-3 py-[11px] pr-4">
							<span class="w-10 flex-none text-[14px] font-bold text-muted tabular-nums"
								>{timeOfDay(s.doneAt, timezone)}</span
							>
							<span class="min-w-0 flex-1 text-[14px] text-ink"
								>{setSummary(s) || 'Set'}{#if s.note}<span
										class="mt-0.5 block text-[13px] text-muted">“{s.note}”</span
									>{/if}</span
							>
						</div>
					</div>
				{/each}
			</div>
		{/each}
	</section>
{:else}
	<div class="flex flex-col items-center gap-1.5 px-6 pt-7 pb-2 text-center">
		<span class="flex h-14 w-14 items-center justify-center rounded-full bg-chip text-muted">
			<Icon name="calendar" size={26} />
		</span>
		<span class="mt-1.5 text-[16px] font-bold text-ink">Nothing logged on this day</span>
	</div>
{/if}

<div class="mt-3.5">
	<p id="past-forgot-label" class={LABEL}>Forgot to log something that day?</p>
	<PickerOpener
		id="past-forgot"
		label="Pick an exercise…"
		aria-describedby="past-forgot-label"
		onclick={() => (picking = true)}
	/>
</div>

<Picker
	open={picking}
	title="Log a set on {dayLabel(day)}"
	placeholder="Search exercises"
	groups={exerciseGroups(exercises)}
	kind="act"
	nothingLeft="No exercises yet."
	onpick={(row) => {
		picking = false;
		onlog(row.value);
	}}
	onclose={() => (picking = false)}
/>
