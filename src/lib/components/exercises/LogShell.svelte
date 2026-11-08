<script lang="ts" module>
	import type { Dance } from '$lib/dances/dances';
	import type { ContentProps } from './kinds';
	import type { Unsaved } from '$lib/unsaved/pending';
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
		/**
		 * Skip, once its question is answered. `answered`: what the user agreed to
		 * lose when the Skip navigates (the desktop pane; `leavePageOrAsk`), so that
		 * navigation does not ask about it again (`passNext`).
		 */
		onskip: (answered?: Unsaved[]) => void;
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
		onlogged?: (durationS: number | null, setId: number | null) => void;
		onclose: () => void;
		/** Where this popup was opened, so a Practice opened from it can go back there. */
		from?: 'today' | 'exercise';
		/**
		 * The URL the form posts to. A form drawn by a layout names its own route
		 * (Today's `/{dance}?/log`), so it never posts to the page beside it. Default:
		 * the page's own `?/log`, for a form drawn by its page (the exercise page's
		 * popup and pane, the figure and lesson pages).
		 */
		action?: string;
		/**
		 * `sheet`: the log popup. `pane`: the desktop's left column of an open exercise
		 * (desktop spec, "Today"): no sheet, the form with Log set pinned under it.
		 */
		frame?: 'sheet' | 'pane';
		/** The pane only: a quiet extra under Log set (the exercise page's Not today). */
		belowLog?: Snippet;
		/**
		 * The popup only: the Today layout's toast (a set's "back in …" Undo), drawn inside
		 * the sheet, since a modal dialog covers the page's own.
		 */
		outer?: { toast: ToastState | null; ondismiss: () => void } | null;
		/** Outside a session: where Next goes after a log (the next due exercise). */
		follow?: { name: string; onnext: () => void } | null;
		/** What the type's `Content` gets on the page (spread after the wrapper's own `canEdit`). */
		contentProps?: Pick<ContentProps, 'onPage' | 'canEdit' | 'editLinks'>;
		/**
		 * The exercise's schedule as of the START of today (sets before today only),
		 * and today's day: what each face would set. Without them the faces show no times.
		 */
		schedule?: ScheduleState;
		today?: string;
		/**
		 * The simple popup (Follow my class, Practise and keep my own): the four faces
		 * and "Done" alone, no minutes, reps or note; the content in the simple player.
		 */
		simple?: boolean;
	}
</script>

<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { guarded, leaveOrAsk, leavePageOrAsk } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import type { ToastState } from '$lib/act-toast';
	import SetList from './SetList.svelte';
	import LastTime from './LastTime.svelte';
	import FaceRating from './FaceRating.svelte';
	import { preview as previewOf, type ScheduleState } from '$lib/schedule/schedule';
	import { earlyLine } from '$lib/schedule/words';
	import type { Feel } from '$lib/schedule/feel';
	import { fetchPractice } from './fetch-practice';
	import { restoreSet } from './restore-set';
	import {
		button,
		FIELD,
		FIELD_ERROR,
		FIELD_INVALID,
		LABEL,
		rowButton,
		SECTION_LABEL,
		TEXTAREA
	} from '$lib/components/ui/styles';
	import { typeInfo } from '$lib/exercises/kinds';
	import { minutesFrom } from '$lib/exercises/practice';
	import { fieldsShown, footerFor, rangeError } from '$lib/exercises/log-view';
	import { clock, longDayLabel } from '$lib/format';
	import { t } from '$lib/i18n/catalog';

	/** The unit beside Minutes: the same in every language. */
	const MIN = 'min';

	interface Props extends LogProps {
		/** The practice panel's latest run, or null. Fills Minutes and the set's `player_json`. */
		run: { durationS: number; playerJson: string } | null;
		/** The panel is playing: nothing may close the popup by accident. */
		playing: boolean;
		/** The type's own content (a figure's with its Hide/Show fold), given the loaded payload. */
		reference: Snippet<[PracticePayload]>;
		/** The practice panel, or a routine's Practise in player and its line; a lesson has none. */
		panel?: Snippet<[PracticePayload]>;
	}

	// `songs`, `takes`, `from` and `contentProps` are part of `LogProps` for the
	// type-specific Log wrappers, which read them straight off their own props
	// for the practice panel and the content — this shell never touches them.
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
		action = '?/log',
		frame = 'sheet',
		belowLog,
		outer = null,
		follow = null,
		schedule,
		today,
		simple = false,
		run,
		playing,
		reference,
		panel
	}: Props = $props();

	const info = $derived(typeInfo(exercise.source));
	// The simple popup draws the faces alone (`fieldsShown`).
	const shownFields = $derived(fieldsShown(simple, info.fields));
	const has = (f: 'minutes' | 'reps' | 'rating' | 'note') => shownFields.includes(f);
	// The pane's form has its own id, so a popup and a pane never share one.
	const formId = $derived(frame === 'pane' ? `log-pane-${exercise.id}` : `log-${exercise.id}`);
	/**
	 * The main button just after a log: done colours, primary's size and shape. Full
	 * width in the popup; in the pane's pinned row its own width beside Next, so Next
	 * keeps the rest for the name, and the row's width alone.
	 */
	const LOGGED_BASE =
		'inline-flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full bg-done-soft text-[16px] font-extrabold text-done';
	const LOGGED = `${LOGGED_BASE} w-full`;
	const LOGGED_BESIDE = `${LOGGED_BASE} flex-none px-6`;
	const LOGGED_ROW = `${LOGGED_BASE} min-w-0 flex-1 px-6`;
	const detailsHref = $derived(
		resolve('/[dance]/(today)/exercises/[id]', { dance: dance.slug, id: String(exercise.id) })
	);

	// A seed, read once: the popup is keyed by exercise (Today's `{#key}`), and
	// after that `load()` keeps the payload current.
	let payload = $state<PracticePayload | null>(untrack(() => initial));
	let loadError = $state<string | null>(null);
	let busy = $state(false);
	let justLogged = $state(false);
	let feel = $state<Feel | null>(null);
	/** What each face would set; none on a back-filled day or without a schedule. */
	const faces = $derived(
		schedule && today && backfillDay === null ? previewOf(schedule, today) : null
	);
	let minutes = $state('');
	let reps = $state('');
	/** Exact seconds from the panel. Typing into Minutes clears it, so a hand-entered value wins. */
	let exactS = $state<number | null>(null);

	/**
	 * Text a number field cannot parse (`validity.badInput`) reads as '' and,
	 * with `novalidate`, would post as blank. It is out of range like any other.
	 */
	let minutesBad = $state(false);
	let repsBad = $state(false);
	const fieldError = (value: string, bad: boolean, max: number) =>
		rangeError(bad ? '?' : value, max);
	const minutesError = $derived(has('minutes') ? fieldError(minutes, minutesBad, 600) : null);
	const repsError = $derived(has('reps') ? fieldError(reps, repsBad, 10000) : null);

	const view = $derived(
		footerFor({
			session: session && { next: session.next?.name ?? null, ended: session.ended },
			justLogged,
			busy,
			playing,
			backfill: backfillDay !== null,
			follow: follow?.name ?? null,
			rated: !has('rating') || feel !== null,
			simple
		})
	);
	/** Next goes on through the session, else to the exercise `follow` names. */
	const onnext = $derived(session?.onnext ?? follow?.onnext);
	/**
	 * A refused log, from the submit's own result: a form posting to a route other
	 * than the page's (Today's popup beside an open exercise) never reaches
	 * `page.form`, so `message` would stay empty. Same text as `message` otherwise.
	 */
	let refusal = $state<string | null>(null);
	const shown = $derived(refusal ?? message);

	function load() {
		fetchPractice(dance.slug, exercise.id)
			.then((p) => (payload = p))
			.catch(() => (loadError = t().exercise.log.loadError));
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
		minutesBad = false;
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

	/**
	 * The pane's Skip. With a next one it navigates, so it asks about all the page
	 * would lose (the log form and an open settings edit, in one question) and
	 * hands that answer on; the last one's Skip stays on the page, so only the log
	 * form is asked about.
	 */
	function skipPane(s: SessionControls) {
		const verb = t().exercise.log.skip;
		if (s.next) leavePageOrAsk((answered) => s.onskip(answered), verb);
		else away(() => s.onskip(), verb);
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
		say(t().exercise.log.setDeleted, undoSnapshot ? t().common.undo : undefined);
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
		if (!ok) say(t().exercise.log.couldNotPutBack);
		load();
	}
</script>

<!-- The log form: one element, drawn by the popup and by the pane alike. -->
{#snippet theForm()}
	<form
		id={formId}
		method="POST"
		{action}
		novalidate
		class="flex flex-col gap-3"
		bind:this={logForm}
		use:guarded={{
			label: t().exercise.log.formLabel,
			dirty: (changed) => unsaved || changed,
			blocked: () => (playing ? t().exercise.log.stopToLog : null),
			submit: ({ formData, cancel }) => {
				// Out of range: the field already says so in red; nothing is sent.
				if (minutesError !== null || repsError !== null) {
					cancel();
					return;
				}
				busy = true;
				refusal = null;
				// Captured now, not after `update()`: a success resets the bound
				// fields (Minutes goes back to ''), so reading `exactS`/`minutes`
				// afterwards lost a hand-typed value — see finding 1. Same rule as
				// the rule of the server (log-form.ts): durationS wins over
				// durationMin*60, else there is nothing to report.
				const asSeconds = (v: FormDataEntryValue | null) =>
					v !== null && String(v) !== '' ? Number(v) : null;
				const fromS = asSeconds(formData.get('durationS'));
				const fromMin = asSeconds(formData.get('durationMin'));
				const logged = fromS ?? (fromMin === null ? null : fromMin * 60);
				return async ({ update, result }) => {
					try {
						await update();
					} finally {
						busy = false;
					}
					if (result.type === 'failure') {
						const m = (result.data as { message?: unknown } | undefined)?.message;
						refusal = typeof m === 'string' ? m : t().exercise.log.didNotSave;
					}
					if (result.type !== 'success') return;
					feel = null;
					minutes = '';
					reps = '';
					minutesBad = false;
					repsBad = false;
					exactS = null;
					justLogged = true;
					// In a session, or with a `follow`, "Logged" stays until Next, Skip or
					// Finish — the Next button hangs off it. Otherwise it fades back to "Log set".
					if (!session && !follow) setTimeout(() => (justLogged = false), 2500);
					onlogged?.(logged, (result.data as { setId?: number } | undefined)?.setId ?? null);
					load();
				};
			}
		}}
	>
		<input type="hidden" name="exerciseId" value={exercise.id} />
		{#if backfillDay}<input type="hidden" name="day" value={backfillDay} />{/if}
		<!-- The simple popup posts only what it has: the faces, and a practice run's time. -->
		{#if !simple || exactS !== null}
			<input type="hidden" name="durationS" value={exactS ?? ''} />
		{/if}
		{#if liveRun && !backfillDay}<input type="hidden" name="run" value={liveRun.playerJson} />{/if}

		{#if has('minutes') || has('reps')}
			<div class="grid grid-cols-2 items-start gap-3">
				{#if has('minutes')}
					<div class="min-w-0">
						<label for="{formId}-minutes" class={LABEL}>{t().exercise.log.minutes}</label>
						<div
							class="{minutesError
								? FIELD_INVALID
								: FIELD} flex items-center gap-2.5 has-focus-visible:shadow-[0_0_0_6px_color-mix(in_srgb,var(--color-accent)_20%,transparent)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
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
									minutesBad = e.currentTarget.validity.badInput;
									exactS = null;
								}}
								aria-invalid={minutesError ? 'true' : undefined}
								aria-describedby={minutesError || exactS !== null
									? `${formId}-minutes-msg`
									: undefined}
								class="h-11 w-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted focus-visible:shadow-none! focus-visible:outline-none!"
							/>
							<span class="flex-none text-[15px] font-semibold text-muted">{MIN}</span>
						</div>
						{#if minutesError}
							<p id="{formId}-minutes-msg" class={FIELD_ERROR}>
								<Icon name="warning" size={16} />{minutesError}
							</p>
						{:else if exactS !== null}
							<p id="{formId}-minutes-msg" class="mt-1.5 pl-1 text-[13px] text-muted">
								{t().exercise.log.fromPractice(clock(exactS))}
							</p>
						{/if}
					</div>
				{/if}
				{#if has('reps')}
					<div class="min-w-0">
						<label for="{formId}-reps" class={LABEL}>{t().exercise.log.reps}</label>
						<input
							id="{formId}-reps"
							name="reps"
							type="number"
							inputmode="numeric"
							min="0"
							max="10000"
							placeholder="0"
							value={reps}
							oninput={(e) => {
								reps = e.currentTarget.value;
								repsBad = e.currentTarget.validity.badInput;
							}}
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
			<FaceRating
				question={info.ratingQuestion}
				value={feel}
				onchange={(f) => (feel = f)}
				preview={faces?.faces ?? null}
				early={faces?.early && today ? earlyLine(faces.early, today) : null}
			/>
		{/if}

		{#if has('note')}
			<div>
				<label for="{formId}-note" class={LABEL}
					>{t().exercise.log.note}<span class="font-medium text-muted"
						>&nbsp;{t().exercise.log.optional}</span
					></label
				>
				<textarea
					id="{formId}-note"
					name="note"
					rows="2"
					maxlength="2000"
					placeholder={t().exercise.log.notePlaceholder}
					class={TEXTAREA}></textarea>
			</div>
		{/if}

		{#if shown}
			<Banner kind="error" title={shown} />
		{/if}
	</form>
{/snippet}

<!-- `row`: the pane's pinned bar, where the buttons share one row and grow alike. -->
{#snippet mainButton(row: boolean)}
	{#if view.main}
		<!--
			One element in every state: "Logged" fading back to "Log set" 2.5 s later
			must not destroy a focused button (focusAfterRemoval's fallback lands
			here after a keyboard delete). "Logged" is still a submit: tapping it
			logs another set.
		-->
		<button
			data-focus="sets-add"
			type="submit"
			form={formId}
			class={view.main.state === 'logged'
				? row
					? view.next && onnext
						? LOGGED_BESIDE
						: LOGGED_ROW
					: LOGGED
				: row
					? rowButton('primary')
					: button('primary', 'md', true)}
			disabled={view.main.state !== 'log' && view.main.state !== 'logged'}
			aria-busy={view.main.state === 'saving' ? 'true' : undefined}
		>
			{#if view.main.state === 'saving'}
				<Spinner size={20} />
			{:else if view.main.state === 'logged'}
				<Icon name="check" size={22} stroke={2.5} />
			{:else if view.main.state === 'log'}
				<Icon name="check" size={22} />
			{/if}{view.main.label}
		</button>
	{/if}
{/snippet}

{#snippet hint()}
	{#if view.hint}
		<p class="text-center text-[13px] font-bold text-muted">{view.hint}</p>
	{/if}
{/snippet}

{#snippet nextButton(kind: 'primary' | 'secondary', row: boolean)}
	{#if view.next && onnext}
		<button type="button" class={row ? rowButton(kind) : button(kind, 'md', true)} onclick={onnext}>
			<span class="min-w-0 truncate">{view.next}</span><Icon name="chevron-right" size={20} />
		</button>
	{/if}
{/snippet}

{#snippet doneCard()}
	{#if session && view.done}
		<div
			role="status"
			class="flex items-center gap-2.5 rounded-2xl bg-done-soft px-3.5 py-3 [--icon-knockout:var(--color-on-done)]"
		>
			<span class="flex-none text-done"><Icon name="check-circle" size={28} filled /></span>
			<span class="flex min-w-0 flex-col gap-px">
				<span class="text-[15px] font-extrabold text-ink">{t().exercise.log.sessionDone}</span>
				<span class="text-[13px] font-bold text-done">{session.summary}</span>
			</span>
		</div>
	{/if}
{/snippet}

{#snippet finishButton(row: boolean)}
	{#if session && view.done}
		<!-- Secondary while Log set is still offered (Skip ran out the list): one primary per footer. -->
		<button
			type="button"
			class={row
				? rowButton(view.main ? 'secondary' : 'primary')
				: button(view.main ? 'secondary' : 'primary', 'md', true)}
			onclick={session.onfinish}
		>
			{t().exercise.log.finish}
		</button>
	{/if}
{/snippet}

{#if frame === 'pane'}
	<!--
		The desktop's left column (desktop spec, "Today"): the form with Log set pinned
		under it. The title, "Last time", the sets and the toast are the page's own
		(its header and History), so none of them is here.
	-->
	<section
		aria-label={simple ? t().exercise.page.practised : t().exercise.page.logASet}
		class="flex flex-col gap-3"
	>
		{@render doneCard()}
		<h2 class={SECTION_LABEL}>
			{simple ? t().exercise.page.practised : t().exercise.page.logASet}
		</h2>
		{#if payload}
			{#if panel}{@render panel(payload)}{/if}
		{:else if loadError}
			<Banner kind="error" title={loadError}>{t().exercise.log.stillLog}</Banner>
		{/if}
		{@render theForm()}
		{#if payload && info.paneContent === 'left'}{@render reference(payload)}{/if}
		<div
			class="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-hairline bg-ground pt-3.5 pb-5"
		>
			<div class="flex items-center gap-2.5">
				{#if session && view.skip}
					<button type="button" class={button('secondary', 'md')} onclick={() => skipPane(session)}
						>{t().exercise.log.skip}</button
					>
				{/if}
				{@render mainButton(true)}
				{@render nextButton('primary', true)}
				{@render finishButton(true)}
			</div>
			{@render hint()}
			{#if belowLog}{@render belowLog()}{/if}
		</div>
	</section>
{:else}
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
					onclick={() => away(() => session.onskip(), t().exercise.log.skip)}
				>
					{t().exercise.log.skip}<Icon name="chevron-right" size={18} />
				</button>
			{/if}
			{#if page.url.pathname !== detailsHref}
				<a
					href={detailsHref}
					aria-label={t().exercise.log.detailsLabel}
					class="flex h-11 flex-none items-center gap-0.5 pr-1 pl-2.5 text-[15px] font-extrabold text-accent-text"
				>
					{t().exercise.log.details}<Icon name="chevron-right" size={18} />
				</a>
			{/if}
		{/snippet}

		<div class="flex flex-col gap-3">
			{#if backfillDay}
				<div
					class="flex items-center gap-2.5 rounded-[14px] bg-accent-soft px-3.5 py-2.5 text-[14px] font-extrabold text-accent-text"
				>
					<Icon name="calendar" size={20} />{t().exercise.log.addingTo(longDayLabel(backfillDay))}
				</div>
			{/if}

			{#if payload}
				<!-- The type's content and its panel, as one block (a lesson's content alone). -->
				{#if panel}
					<div class="flex flex-col gap-3">
						{@render reference(payload)}
						{@render panel(payload)}
					</div>
				{:else}
					{@render reference(payload)}
				{/if}
			{:else if loadError}
				<Banner kind="error" title={loadError}>{t().exercise.log.stillLog}</Banner>
			{:else}
				<div aria-busy="true" class="flex flex-col gap-2.5 px-1 pt-1">
					<span role="status" class="sr-only">{t().common.loading}</span>
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

			{@render theForm()}

			{#if sets.length > 0 && !simple}
				<div class="flex flex-col gap-2 pt-1">
					<h3 class={SECTION_LABEL}>
						{backfillDay ? t().exercise.log.setsThatDay : t().exercise.log.setsToday}
					</h3>
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
			{@render mainButton(false)}
			{@render hint()}
			{@render nextButton('secondary', false)}
			{@render doneCard()}
			{@render finishButton(false)}
		{/snippet}

		{#snippet toast()}
			<Toast
				contained
				bottom="0"
				toast={notice ?? outer?.toast ?? null}
				onaction={notice ? undo : () => outer?.toast?.undo?.()}
				ondismiss={() => {
					if (!notice) {
						outer?.ondismiss();
						return;
					}
					notice = null;
					undoSnapshot = null;
				}}
			/>
		{/snippet}
	</Sheet>
{/if}
