<script lang="ts" module>
	import type { Dance } from '$lib/dances/dances';
	import type {
		CountTakeRow,
		ExerciseItem,
		HistorySet,
		PickerSong,
		PracticePayload
	} from '$lib/types';

	/** A session walking Today's list, as the popup sees it. See `$lib/exercises/session`. */
	export interface SessionControls {
		next: { name: string } | null;
		/** The Session done card's second line ("3 exercises, 24 min"); the card titles itself. */
		summary: string;
		/**
		 * Skip ran out the list rather than a log: nothing is left, so the popup
		 * shows the Session done card + Finish, under a Log set that still logs
		 * the skipped exercise.
		 */
		ended: boolean;
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
		songs: PickerSong[];
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
	import { page } from '$app/state';
	import { guarded, leaveOrAsk } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import SetList from './SetList.svelte';
	import LastTime from './LastTime.svelte';
	import RatingStars from './RatingStars.svelte';
	import { fetchPractice } from './fetch-practice';
	import { restoreSet } from './restore-set';
	import {
		button,
		FIELD,
		FIELD_ERROR,
		LABEL,
		SECTION_LABEL,
		TEXTAREA
	} from '$lib/components/ui/styles';
	import { typeInfo } from '$lib/exercises/kinds';
	import { minutesFrom } from '$lib/exercises/practice';
	import { footerFor, rangeError } from '$lib/exercises/log-view';
	import { clock, longDayLabel } from '$lib/format';

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
	const formId = $derived(`log-${exercise.id}`);
	const detailsHref = $derived(
		resolve('/[dance]/exercises/[id]', { dance: dance.slug, id: String(exercise.id) })
	);

	let payload = $state<PracticePayload | null>(initial);
	let loadError = $state<string | null>(null);
	let busy = $state(false);
	let justLogged = $state(false);
	let rating = $state<number | null>(null);
	let minutes = $state('');
	let reps = $state('');
	/** Exact seconds from the panel. Typing into Minutes clears it, so a hand-entered value wins. */
	let exactS = $state<number | null>(null);

	const minutesError = $derived(has('minutes') ? rangeError(minutes, 600) : null);
	const repsError = $derived(has('reps') ? rangeError(reps, 10000) : null);

	const view = $derived(
		footerFor({
			session: session && { next: session.next?.name ?? null, ended: session.ended },
			justLogged,
			busy,
			playing,
			backfill: backfillDay !== null
		})
	);

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

	/**
	 * Practice time that a close would throw away, even with nothing typed. The
	 * log form counts it as unsaved, so ✕, the backdrop, Escape, Skip and a
	 * navigation all ask first — the app's one unsaved-changes dialog
	 * (`$lib/unsaved`), which also covers typed reps, a note or a rating.
	 */
	const unsaved = $derived(playing || liveRun !== null);
	let logForm: HTMLFormElement | undefined = $state();

	/** Move on from this popup, asking first if the log holds anything unsaved. */
	function away(then: () => void, verb: string) {
		if (logForm) leaveOrAsk(logForm, then, verb);
		else then();
	}

	/* ── Undo of a deleted set ─────────────────────────────────────────── */

	let notice = $state<{ id: number; message: string; action?: string } | null>(null);
	let noticeSeq = 0;
	/**
	 * The deleted set, for Undo. Taken (and cleared) by the first tap: a second
	 * tap, or a replay while the first is out, would insert the set twice.
	 */
	let undoSnapshot: string | null = null;

	function say(message: string, action?: string) {
		notice = { id: ++noticeSeq, message, action };
	}

	function deleted(snapshot: string) {
		undoSnapshot = snapshot || null;
		say('Set deleted', undoSnapshot ? 'Undo' : undefined);
		// "Last time" may have been this set.
		load();
	}

	async function undo() {
		const snapshot = undoSnapshot;
		undoSnapshot = null;
		// The toast goes at the tap, Undo with it, so it cannot be sent twice;
		// the row coming back is the answer.
		notice = null;
		if (!snapshot) return;
		const ok = await restoreSet(snapshot);
		if (!ok) say('Could not put the set back.');
		load();
	}
</script>

<Sheet tall title={exercise.name} open={true} {onclose}>
	{#snippet subtitle()}
		{#if payload}
			<LastTime last={payload.last} />
		{:else if !loadError}
			<span class="block h-2.5 w-[190px] max-w-full rounded-[5px] bg-skeleton" aria-hidden="true"
			></span>
		{/if}
	{/snippet}

	{#snippet actions()}
		{#if session && view.skip}
			<button
				type="button"
				class="flex h-11 flex-none cursor-pointer items-center gap-0.5 px-2.5 text-[15px] font-extrabold text-accent-text"
				onclick={() => away(session.onskip, 'Skip')}
			>
				Skip<Icon name="chevron-right" size={18} />
			</button>
		{/if}
		{#if page.url.pathname !== detailsHref}
			<a
				href={detailsHref}
				aria-label="Details and settings"
				class="flex h-11 flex-none items-center gap-0.5 pr-1 pl-2.5 text-[15px] font-extrabold text-accent-text"
			>
				Details<Icon name="chevron-right" size={18} />
			</a>
		{/if}
	{/snippet}

	<div class="flex flex-col gap-3">
		{#if backfillDay}
			<div
				class="flex items-center gap-2.5 rounded-[14px] bg-accent-soft px-3.5 py-2.5 text-[14px] font-extrabold text-accent-text"
			>
				<Icon name="calendar" size={20} />Adding to {longDayLabel(backfillDay)}
			</div>
		{/if}

		{#if payload}
			{@render body(payload)}
		{:else if loadError}
			<Banner kind="error" title={loadError}>You can still log a set.</Banner>
		{:else}
			<div aria-busy="true" class="flex flex-col gap-2.5 px-1 pt-1">
				<span role="status" class="sr-only">Loading</span>
				<span class="block h-3 w-[92%] rounded-md bg-skeleton" aria-hidden="true"></span>
				<span class="block h-3 w-[80%] rounded-md bg-skeleton" aria-hidden="true"></span>
				<span class="block h-3 w-[56%] rounded-md bg-skeleton" aria-hidden="true"></span>
			</div>
			<div class="h-[150px] flex-none rounded-2xl bg-skeleton" aria-hidden="true"></div>
			<div class="flex-none overflow-hidden rounded-2xl bg-surface pl-4" aria-hidden="true">
				<div class="flex min-h-16 items-center gap-3 pr-4">
					<span class="size-10 flex-none rounded-[10px] bg-skeleton"></span>
					<span class="flex flex-1 flex-col gap-2">
						<span class="block h-3 w-[62%] rounded-md bg-skeleton"></span>
						<span class="block h-2.5 w-[40%] rounded-[5px] bg-skeleton opacity-80"></span>
					</span>
				</div>
			</div>
		{/if}

		<form
			id={formId}
			method="POST"
			action="?/log"
			novalidate
			class="flex flex-col gap-3"
			bind:this={logForm}
			use:guarded={{
				label: 'Practice log',
				dirty: (changed) => unsaved || changed,
				blocked: () => (playing ? 'Stop the count to log it.' : null),
				submit: ({ formData, cancel }) => {
					// Out of range: the field already says so in red; nothing is sent.
					if (minutesError !== null || repsError !== null) {
						cancel();
						return;
					}
					busy = true;
					// Captured now, not after `update()`: a success resets the bound
					// fields (Minutes goes back to ''), so reading `exactS`/`minutes`
					// afterwards lost a hand-typed value — see finding 1. Same rule as
					// the server's own (log-form.ts): durationS wins over
					// durationMin*60, else there is nothing to report.
					const asSeconds = (v: FormDataEntryValue | null) =>
						v !== null && String(v) !== '' ? Number(v) : null;
					const fromS = asSeconds(formData.get('durationS'));
					const fromMin = asSeconds(formData.get('durationMin'));
					const logged = fromS ?? (fromMin === null ? null : fromMin * 60);
					return async ({ update, result }) => {
						await update();
						busy = false;
						if (result.type !== 'success') return;
						rating = null;
						minutes = '';
						reps = '';
						exactS = null;
						justLogged = true;
						// In a session "Logged" stays until Next, Skip or Finish — the Next
						// button hangs off it. Outside one it fades back to "Log set".
						if (!session) setTimeout(() => (justLogged = false), 2500);
						onlogged?.(logged);
						load();
					};
				}
			}}
		>
			<input type="hidden" name="exerciseId" value={exercise.id} />
			{#if backfillDay}<input type="hidden" name="day" value={backfillDay} />{/if}
			<input type="hidden" name="durationS" value={exactS ?? ''} />
			{#if liveRun && !backfillDay}<input
					type="hidden"
					name="run"
					value={liveRun.playerJson}
				/>{/if}

			{#if has('minutes') || has('reps')}
				<div class="grid grid-cols-2 items-start gap-3">
					{#if has('minutes')}
						<div class="min-w-0">
							<label for="{formId}-minutes" class={LABEL}>Minutes</label>
							<div
								class="{FIELD} flex items-center gap-2.5 has-focus-visible:shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-accent)_20%,transparent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent {minutesError
									? 'border-2 border-danger'
									: ''}"
							>
								<input
									id="{formId}-minutes"
									name="durationMin"
									type="number"
									inputmode="numeric"
									min="0"
									max="600"
									placeholder="0"
									value={minutes}
									oninput={(e) => {
										minutes = e.currentTarget.value;
										exactS = null;
									}}
									aria-invalid={minutesError ? 'true' : undefined}
									aria-describedby={minutesError || exactS !== null
										? `${formId}-minutes-msg`
										: undefined}
									class="h-11 w-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted focus-visible:shadow-none focus-visible:outline-none"
								/>
								<span class="flex-none text-[15px] font-semibold text-muted">min</span>
							</div>
							{#if minutesError}
								<p id="{formId}-minutes-msg" class={FIELD_ERROR}>
									<Icon name="warning" size={16} />{minutesError}
								</p>
							{:else if exactS !== null}
								<p id="{formId}-minutes-msg" class="mt-1.5 pl-1 text-[13px] text-muted">
									From the practice: {clock(exactS)}
								</p>
							{/if}
						</div>
					{/if}
					{#if has('reps')}
						<div class="min-w-0">
							<label for="{formId}-reps" class={LABEL}>Reps</label>
							<input
								id="{formId}-reps"
								name="reps"
								type="number"
								inputmode="numeric"
								min="0"
								max="10000"
								placeholder="0"
								value={reps}
								oninput={(e) => (reps = e.currentTarget.value)}
								aria-invalid={repsError ? 'true' : undefined}
								aria-describedby={repsError ? `${formId}-reps-msg` : undefined}
								class={FIELD}
							/>
							{#if repsError}
								<p id="{formId}-reps-msg" class={FIELD_ERROR}>
									<Icon name="warning" size={16} />{repsError}
								</p>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			{#if has('rating')}
				<RatingStars question={info.ratingQuestion} value={rating} onchange={(r) => (rating = r)} />
			{/if}

			{#if has('note')}
				<div>
					<label for="{formId}-note" class={LABEL}
						>Note<span class="font-medium text-muted">&nbsp;(optional)</span></label
					>
					<textarea
						id="{formId}-note"
						name="note"
						rows="2"
						maxlength="2000"
						placeholder="What went well, what to fix"
						class={TEXTAREA}></textarea>
				</div>
			{/if}

			{#if message}
				<Banner kind="error" title={message} />
			{/if}
		</form>

		{#if sets.length > 0}
			<div class="flex flex-col gap-2 pt-1">
				<h3 class={SECTION_LABEL}>{backfillDay ? 'Sets that day' : 'Sets today'}</h3>
				<SetList
					{sets}
					{timezone}
					ondeleted={deleted}
					onfailed={(m) => {
						undoSnapshot = null;
						say(m);
					}}
				/>
			</div>
		{/if}
	</div>

	{#snippet footer()}
		{#if view.main}
			{#if view.main.state === 'logged'}
				<!-- Still a submit: tapping it logs another set, as before. -->
				<button
					type="submit"
					form={formId}
					class="inline-flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-done-soft text-[16px] font-extrabold text-done [&>svg]:[stroke-width:2.5]"
				>
					<Icon name="check" size={22} />{view.main.label}
				</button>
			{:else}
				<button
					type="submit"
					form={formId}
					class={button('primary', 'md', true)}
					disabled={view.main.state !== 'log'}
					aria-busy={view.main.state === 'saving' ? 'true' : undefined}
				>
					{#if view.main.state === 'saving'}
						<Spinner size={20} />
					{:else if view.main.state === 'log'}
						<Icon name="check" size={22} />
					{/if}{view.main.label}
				</button>
			{/if}
		{/if}
		{#if view.hint}
			<p class="text-center text-[13px] font-bold text-muted">{view.hint}</p>
		{/if}
		{#if session && view.next}
			<button type="button" class={button('secondary', 'md', true)} onclick={session.onnext}>
				<span class="min-w-0 truncate">{view.next}</span><Icon name="chevron-right" size={20} />
			</button>
		{/if}
		{#if session && view.done}
			<div
				role="status"
				class="flex items-center gap-2.5 rounded-2xl bg-done-soft px-3.5 py-3 [--icon-knockout:var(--color-on-done)]"
			>
				<span class="flex-none text-done"><Icon name="check-circle" size={28} filled /></span>
				<span class="flex min-w-0 flex-col gap-px">
					<span class="text-[15px] font-extrabold text-ink">Session done</span>
					<span class="text-[13px] font-bold text-done">{session.summary}</span>
				</span>
			</div>
			<button type="button" class={button('primary', 'md', true)} onclick={session.onfinish}>
				Finish
			</button>
		{/if}
	{/snippet}

	{#snippet toast()}
		<Toast
			contained
			bottom="0"
			toast={notice}
			onaction={undo}
			ondismiss={() => {
				notice = null;
				undoSnapshot = null;
			}}
		/>
	{/snippet}
</Sheet>
