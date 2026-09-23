<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { FREQUENCIES } from '$lib/frequency';
	import { setSummary } from '$lib/format';
	import { timeOfDay } from '$lib/day/day';
	import { PRACTICE_LABEL, PRACTICE_MODES, type PracticeMode } from '$lib/labels';
	import type { DaySet, ExerciseItem } from '$lib/types';

	interface Props {
		exercise: ExerciseItem;
		/** This exercise's sets on the day being viewed. */
		sets: DaySet[];
		/** Ready songs, for the practice-mode song picker. */
		songs: { id: number; title: string }[];
		/** A past day to back-fill onto, or null for "now". */
		backfillDay: string | null;
		timezone: string;
		/** A failure message from the last action, if it was ours. */
		message: string | null;
		/** What was typed on the settings form, handed back by a failed action. */
		values: {
			practiceMode?: string;
			songId?: string;
			countBpm?: string;
		} | null;
		onclose: () => void;
	}

	let { exercise, sets, songs, backfillDay, timezone, message, values, onclose }: Props = $props();

	let rating = $state<number | null>(null);
	let busy = $state(false);

	const initialMode = (): PracticeMode =>
		(values?.practiceMode as PracticeMode) ?? exercise.practiceMode;
	let practiceMode = $state<PracticeMode>(initialMode());
	let songId = $state(values?.songId ?? String(exercise.songId ?? ''));
	let countBpm = $state(values?.countBpm ?? String(exercise.countBpm ?? ''));

	/**
	 * A song set here can stop being playable afterwards — archived, or the
	 * analysis re-run and failed. `songs` is the list that IS ready, so checking
	 * against it means a dead link becomes a sentence the user can act on instead
	 * of an error page they cannot.
	 */
	const songGone = $derived(
		exercise.practiceMode === 'song' && !songs.some((s) => s.id === exercise.songId)
	);

	const practiceHref = $derived(
		exercise.practiceMode === 'song'
			? songGone
				? null
				: resolve(`/player?song=${exercise.songId}&exercise=${exercise.id}`)
			: exercise.practiceMode === 'count'
				? resolve(`/player?bpm=${exercise.countBpm}&exercise=${exercise.id}`)
				: null
	);

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
	const chip =
		'flex h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border text-[14px] has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink border-rule bg-raised text-ink-2 has-focus-visible:outline-2 has-focus-visible:outline-accent';
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

		{#if practiceHref && !backfillDay}
			<a
				href={practiceHref}
				class="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-accent text-[15px] font-semibold text-accent"
				>Practice</a
			>
		{:else if songGone && !backfillDay}
			<p class="mt-4 rounded-lg bg-raised px-3 py-2 text-[13px] text-muted">
				Its song is not ready to play — pick another below.
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

	<details class="mt-6 rounded-xl border border-line">
		<summary class="cursor-pointer px-3 py-3 text-[14px] font-medium">Exercise settings</summary>
		<form method="POST" action="?/updateExercise" use:enhance class="space-y-3 px-3 pb-3">
			<input type="hidden" name="id" value={exercise.id} />
			{#if exercise.source === 'custom'}
				<label class="block">
					<span class={label}>Name</span>
					<input name="name" required maxlength="200" value={exercise.name} class={field} />
				</label>
			{/if}
			<label class="block">
				<span class={label}>How often</span>
				<select name="everyDays" class={field} value={exercise.everyDays}>
					{#each FREQUENCIES as f (f.days)}
						<option value={f.days}>{f.label}</option>
					{/each}
				</select>
			</label>
			<label class="flex items-center gap-3 text-[14px]">
				<input type="checkbox" name="active" checked={exercise.active} class="size-5" />
				Active — show it in the to-do list
			</label>
			<fieldset>
				<legend class={label}>Practice</legend>
				<div class="flex gap-2">
					{#each PRACTICE_MODES as m (m)}
						<label class={chip}>
							<input
								type="radio"
								name="practiceMode"
								value={m}
								checked={practiceMode === m}
								onchange={() => (practiceMode = m)}
								class="sr-only"
							/>
							{PRACTICE_LABEL[m]}
						</label>
					{/each}
				</div>
			</fieldset>
			{#if practiceMode === 'song'}
				<label class="block">
					<span class={label}>Song</span>
					<select name="songId" bind:value={songId} class={field}>
						<option value="">Pick a song…</option>
						{#each songs as s (s.id)}
							<option value={String(s.id)}>{s.title}</option>
						{/each}
					</select>
				</label>
			{:else if practiceMode === 'count'}
				<label class="block">
					<span class={label}>Tempo (BPM)</span>
					<input
						name="countBpm"
						type="number"
						inputmode="numeric"
						min="60"
						max="300"
						bind:value={countBpm}
						class={field}
					/>
				</label>
			{/if}
			<label class="block">
				<span class={label}>Notes</span>
				<textarea name="notes" rows="2" maxlength="2000" class={field}
					>{exercise.notes ?? ''}</textarea
				>
			</label>
			<button
				type="submit"
				class="h-11 w-full rounded-xl border border-rule text-[14px] font-medium"
				>Save settings</button
			>
		</form>
		<div class="flex items-center justify-between gap-3 border-t border-line px-3 py-3">
			<!--
				Branch on `source`, not on `figureId`: a lesson's review exercise also
				has a null figure, and `archiveExercise` refuses anything but a custom
				one — so keying off the figure offers it an Archive button that cannot
				work.
			-->
			{#if exercise.source === 'figure' && exercise.figureId !== null}
				<a
					href={resolve('/figures/[id]', { id: String(exercise.figureId) })}
					class="text-[14px] font-medium text-accent">Open figure →</a
				>
			{:else if exercise.source === 'lesson' && exercise.lessonId !== null}
				<a
					href={resolve('/lessons/[id]', { id: String(exercise.lessonId) })}
					class="text-[14px] font-medium text-accent">Open lesson →</a
				>
			{:else if exercise.source === 'custom'}
				<form
					method="POST"
					action="?/archiveExercise"
					use:enhance={() => {
						return async ({ update, result }) => {
							await update();
							if (result.type === 'success') onclose();
						};
					}}
				>
					<input type="hidden" name="id" value={exercise.id} />
					<button type="submit" class="h-10 text-[14px] text-danger">Archive exercise</button>
				</form>
			{/if}
		</div>
	</details>
</Sheet>
