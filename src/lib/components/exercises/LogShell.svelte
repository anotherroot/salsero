<script lang="ts" module>
	import type { Dance } from '$lib/dances/dances';
	import type { CountTakeRow, ExerciseItem, HistorySet, PracticePayload } from '$lib/types';

	/** A session walking Today's list, as the popup sees it. See `$lib/exercises/session`. */
	export interface SessionControls {
		next: { name: string } | null;
		summary: string;
		onnext: () => void;
		onskip: () => void;
		onfinish: () => void;
	}

	/** What every type's popup takes. */
	export interface LogProps {
		dance: Dance;
		exercise: ExerciseItem;
		/** This exercise's sets on the day being viewed. */
		sets: HistorySet[];
		songs: { id: number; title: string }[];
		takes: CountTakeRow[];
		/** A past day to back-fill onto, or null for "now". */
		backfillDay: string | null;
		timezone: string;
		/** A failure message from the last log action. */
		message: string | null;
		/** Already-loaded content (the exercise page has it); otherwise it is fetched. */
		initial?: PracticePayload | null;
		session?: SessionControls | null;
		/** A set was saved. `durationS` is what it logged, for the session's tally. */
		onlogged?: (durationS: number | null) => void;
		onclose: () => void;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import SetList from './SetList.svelte';
	import LastTime from './LastTime.svelte';
	import RatingChips from './RatingChips.svelte';
	import { fetchPractice } from './fetch-practice';
	import { FIELD, LABEL } from '$lib/components/ui/styles';
	import { typeInfo } from '$lib/exercises/kinds';
	import { minutesFrom } from '$lib/exercises/practice';

	interface Props extends LogProps {
		/** The practice panel's latest run, or null. Fills Minutes and the set's `player_json`. */
		run: { durationS: number; playerJson: string } | null;
		/** The panel is playing: nothing may close the popup by accident. */
		playing: boolean;
		/** The type's own content (and panel), given the loaded payload. */
		body: Snippet<[PracticePayload]>;
	}

	// `songs` and `takes` are part of `LogProps` for the type-specific Log
	// wrappers, which read them straight off their own props for the practice
	// panel — this shell never touches them itself.
	// eslint-disable-next-line svelte/no-unused-props
	let {
		dance,
		exercise,
		sets,
		backfillDay,
		timezone,
		message,
		initial = null,
		session = null,
		onlogged,
		onclose,
		run,
		playing,
		body
	}: Props = $props();

	const info = $derived(typeInfo(exercise.source));
	const has = (f: 'minutes' | 'reps' | 'rating' | 'note') => info.fields.includes(f);

	let payload = $state<PracticePayload | null>(initial);
	let loadError = $state<string | null>(null);
	let busy = $state(false);
	let justLogged = $state(false);
	let confirming = $state(false);
	let rating = $state<number | null>(null);
	let minutes = $state('');
	/** Exact seconds from the panel. Typing into Minutes clears it, so a hand-entered value wins. */
	let exactS = $state<number | null>(null);

	function load() {
		fetchPractice(dance.slug, exercise.id)
			.then((p) => (payload = p))
			.catch(() => (loadError = 'Could not load this exercise’s details.'));
	}
	$effect(() => {
		if (!initial) load();
	});

	// `run` is already spent once a set is logged: the drill/figure wrappers
	// null it out in their own `onlogged` (see kinds/drill/Log.svelte and
	// kinds/figure/Log.svelte), which is also what remounts the panel. A
	// same-settings `playerJson` string comparison used to stand in for that
	// and broke the very next identical run — see fix round 1, finding 1.
	const liveRun = $derived(run);
	$effect(() => {
		if (!liveRun) return;
		minutes = String(minutesFrom(liveRun.durationS));
		exactS = liveRun.durationS;
	});

	/** Practice time that a close would throw away. */
	const unsaved = $derived(playing || liveRun !== null);
</script>

<Sheet
	title={exercise.name}
	open={true}
	{onclose}
	guard={unsaved}
	onguarded={() => (confirming = true)}
>
	{#if confirming}
		<div
			class="mb-3 flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-[13px]"
			role="alert"
		>
			<span class="min-w-0 flex-1">
				Discard {liveRun ? `${minutesFrom(liveRun.durationS)} min of ` : ''}practice?
			</span>
			<button type="button" class="h-9 px-2 font-medium" onclick={() => (confirming = false)}
				>Keep</button
			>
			<button type="button" class="h-9 px-2 font-medium text-danger" onclick={onclose}
				>Discard</button
			>
		</div>
	{/if}

	{#if session && !justLogged}
		<div class="mb-2 flex justify-end">
			<button type="button" class="text-[13px] text-accent" onclick={session.onskip}>Skip →</button>
		</div>
	{/if}

	{#if payload}
		<LastTime last={payload.last} />
		<div class="mt-3">{@render body(payload)}</div>
	{:else if loadError}
		<p class="text-[13px] text-danger">{loadError}</p>
	{:else}
		<p class="text-[13px] text-muted">Loading…</p>
	{/if}

	<form
		method="POST"
		action="?/log"
		class="mt-4"
		use:enhance={() => {
			busy = true;
			return async ({ update, result }) => {
				await update();
				busy = false;
				if (result.type !== 'success') return;
				const logged = exactS ?? (minutes === '' ? null : Number(minutes) * 60);
				rating = null;
				minutes = '';
				exactS = null;
				justLogged = true;
				// In a session "Logged ✓" stays until Next, Skip or Finish — the Next
				// button hangs off it. Outside one it fades back to "Log set".
				if (!session) setTimeout(() => (justLogged = false), 2500);
				onlogged?.(logged);
				load();
			};
		}}
	>
		<input type="hidden" name="exerciseId" value={exercise.id} />
		{#if backfillDay}<input type="hidden" name="day" value={backfillDay} />{/if}
		<input type="hidden" name="durationS" value={exactS ?? ''} />
		{#if liveRun && !backfillDay}<input type="hidden" name="run" value={liveRun.playerJson} />{/if}

		<div class="grid grid-cols-2 gap-3">
			{#if has('minutes')}
				<label>
					<span class={LABEL}>Minutes</span>
					<input
						name="durationMin"
						type="number"
						inputmode="numeric"
						min="0"
						max="600"
						bind:value={minutes}
						oninput={() => (exactS = null)}
						class={FIELD}
					/>
				</label>
			{/if}
			{#if has('reps')}
				<label>
					<span class={LABEL}>Reps</span>
					<input name="reps" type="number" inputmode="numeric" min="0" max="10000" class={FIELD} />
				</label>
			{/if}
		</div>

		{#if has('rating')}
			<div class="mt-3">
				<RatingChips question={info.ratingQuestion} value={rating} onchange={(r) => (rating = r)} />
			</div>
		{/if}

		{#if has('note')}
			<label class="mt-3 block">
				<span class={LABEL}>Note</span>
				<textarea name="note" rows="2" maxlength="2000" class={FIELD}></textarea>
			</label>
		{/if}

		{#if message}
			<p class="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{message}
			</p>
		{/if}

		<button
			type="submit"
			disabled={busy || playing}
			class="mt-4 h-12 w-full rounded-xl text-[15px] font-semibold disabled:opacity-60 {justLogged
				? 'bg-done-bg text-done'
				: 'bg-accent text-accent-ink'}"
		>
			{justLogged ? 'Logged ✓' : backfillDay ? 'Add set to this day' : 'Log set'}
		</button>
		{#if playing}
			<p class="mt-2 text-center text-[12px] text-muted">Stop the count to log it.</p>
		{/if}
	</form>

	{#if session && justLogged}
		{#if session.next}
			<button
				type="button"
				class="mt-3 h-12 w-full rounded-xl border border-accent text-[15px] font-semibold text-accent"
				onclick={session.onnext}>Next: {session.next.name} →</button
			>
		{:else}
			<p class="mt-3 text-center text-[14px] font-medium">{session.summary}</p>
			<button
				type="button"
				class="mt-2 h-11 w-full rounded-xl border border-rule text-[14px]"
				onclick={session.onfinish}>Finish</button
			>
		{/if}
	{/if}

	{#if sets.length > 0}
		<h3 class="mt-6 mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">
			{backfillDay ? 'Sets that day' : 'Sets today'}
		</h3>
		<SetList {sets} {timezone} />
	{/if}

	<a
		href={resolve('/[dance]/exercises/[id]', { dance: dance.slug, id: String(exercise.id) })}
		class="mt-6 block text-[14px] font-medium text-accent">Details and settings →</a
	>
</Sheet>
