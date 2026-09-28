<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { setSummary } from '$lib/format';
	import { timeOfDay } from '$lib/day/day';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { DaySet, ExerciseItem } from '$lib/types';

	interface Props {
		/** The dance whose Today this is: every link out of the sheet stays in it. */
		dance: DanceSlug;
		exercise: ExerciseItem;
		/** This exercise's sets on the day being viewed. */
		sets: DaySet[];
		/** A past day to back-fill onto, or null for "now". */
		backfillDay: string | null;
		timezone: string;
		/** A failure message from the last action, if it was ours. */
		message: string | null;
		onclose: () => void;
	}

	let { dance, exercise, sets, backfillDay, timezone, message, onclose }: Props = $props();

	let rating = $state<number | null>(null);
	let busy = $state(false);

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
</script>

<Sheet title={exercise.name} open={true} {onclose}>
	<form
		method="POST"
		action="?/log"
		use:enhance={() => {
			busy = true;
			return async ({ update, result }) => {
				await update();
				busy = false;
				if (result.type === 'success') rating = null;
			};
		}}
	>
		<input type="hidden" name="exerciseId" value={exercise.id} />
		{#if backfillDay}<input type="hidden" name="day" value={backfillDay} />{/if}

		<div class="grid grid-cols-2 gap-3">
			<label>
				<span class={label}>Minutes</span>
				<input
					name="durationMin"
					type="number"
					inputmode="numeric"
					min="0"
					max="600"
					class={field}
				/>
			</label>
			<label>
				<span class={label}>Reps</span>
				<input name="reps" type="number" inputmode="numeric" min="0" max="10000" class={field} />
			</label>
		</div>

		<fieldset class="mt-3">
			<legend class={label}>How did it go?</legend>
			<input type="hidden" name="rating" value={rating ?? ''} />
			<div class="flex gap-2">
				{#each [1, 2, 3, 4, 5] as n (n)}
					<button
						type="button"
						aria-pressed={rating === n}
						onclick={() => (rating = rating === n ? null : n)}
						class="h-11 flex-1 rounded-lg border text-[15px] {rating !== null && n <= rating
							? 'border-accent bg-accent text-accent-ink'
							: 'border-rule bg-raised text-ink-2'}">{n}</button
					>
				{/each}
			</div>
		</fieldset>

		<label class="mt-3 block">
			<span class={label}>Note</span>
			<textarea name="note" rows="2" maxlength="2000" class={field}></textarea>
		</label>

		{#if message}
			<p class="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{message}
			</p>
		{/if}

		<button
			type="submit"
			disabled={busy}
			class="mt-3 h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-60"
		>
			{backfillDay ? 'Add set to this day' : 'Log set'}
		</button>
	</form>

	{#if sets.length > 0}
		<h3 class="mt-6 mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">
			{backfillDay ? 'Sets that day' : 'Sets today'}
		</h3>
		<ul class="divide-y divide-line rounded-xl border border-line">
			{#each sets as s (s.id)}
				<li class="flex items-center gap-3 px-3 py-2">
					<span class="text-[13px] text-muted tabular-nums">{timeOfDay(s.doneAt, timezone)}</span>
					<span class="min-w-0 flex-1 text-[14px]">
						{setSummary(s) || 'Set'}
						{#if s.note}<span class="block truncate text-[12px] text-muted">{s.note}</span>{/if}
					</span>
					<form method="POST" action="?/deleteSet" use:enhance>
						<input type="hidden" name="setId" value={s.id} />
						<button
							type="submit"
							class="h-9 rounded-lg px-3 text-[13px] text-danger"
							aria-label="Delete set logged at {timeOfDay(s.doneAt, timezone)}">Delete</button
						>
					</form>
				</li>
			{/each}
		</ul>
	{/if}

	<a
		href={resolve('/[dance]/exercises/[id]', { dance, id: String(exercise.id) })}
		class="mt-6 block text-[14px] font-medium text-accent">Details and settings →</a
	>
</Sheet>
