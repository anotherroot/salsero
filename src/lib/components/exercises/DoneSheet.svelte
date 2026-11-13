<script lang="ts">
	import { untrack } from 'svelte';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import FaceRating from './FaceRating.svelte';
	import { doneSubmit } from './done-submit';
	import { LABEL, TEXTAREA } from '$lib/components/ui/styles';
	import { feelOf, feelWord, type Feel } from '$lib/schedule/feel';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { suggestFeel, type HearingRound } from '$lib/hearing/drill';
	import { GAIN_CHIP } from '$lib/exercises/face-view';
	import type { DoneFace } from '$lib/schedule/schedule';
	import type { DoneResult } from '$lib/types';
	import { t } from '$lib/i18n/catalog';

	/*
	 * "How did it go?": the note, the four faces, and no button. A face tap saves
	 * (time, face, note) and hands the result to the caller, which closes the
	 * sheet and leaves in the same tick (`backWhenSettled`, `gotoWhenSettled`)
	 * and announces the toast (`announceSaved`). Closing it (×, Back, the scrim)
	 * saves nothing; a typed note makes that ask first.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		/** '?/done' on the exercise page; `/${dance}?/done` on a past day (the hard rule: never bare in a layout). */
		action: string;
		exerciseId: number;
		/** The muted line: the time, the learning progress, or a past day (`doneSubtitle`). */
		subtitle: string;
		/** What each face would set (`doneFaces`); null: no times. */
		faces: DoneFace[] | null;
		/** Read at the tap; null posts no durationS. */
		seconds: number | null;
		day: string | null;
		/** No note (the levels spec's call, kept). */
		simple: boolean;
		/** Done today: that face lit, that note filled. */
		current: { rating: number | null; note: string | null } | null;
		onsaved: (r: DoneResult) => void;
		/**
		 * A hearing drill's round (phase 2): its score on top, the face it suggests
		 * tagged (never picked), and the round saved with the face.
		 */
		hearing?: { round: HearingRound; before: number | null; line: string } | null;
	}

	let {
		open,
		onclose,
		action,
		exerciseId,
		subtitle,
		faces,
		seconds,
		day,
		simple,
		current,
		onsaved,
		hearing = null
	}: Props = $props();
	const suggest = $derived(hearing ? suggestFeel(hearing.round.score) : null);
	const gain = $derived(
		// Against the last round on the drill's settings; a round changed for once has no chip (spec 12).
		hearing && !hearing.round.changed && hearing.before !== null
			? hearing.round.score - hearing.before
			: null
	);

	const title = $derived(t().exercise.types.howItWent);

	// Seeded here for the server's paint, and again by each opening (below).
	let note = $state(untrack(() => current?.note ?? ''));
	/** The note as the sheet opened with it: only a change to it is unsaved. */
	let noteAtOpen = $state(untrack(() => current?.note ?? ''));
	let feel = $state<Feel | null>(untrack(() => feelOf(current?.rating ?? null)));
	/** The face whose save is out: every face disabled, that one lit with a spinner. */
	let busy = $state<Feel | null>(null);
	let refusal = $state<string | null>(null);
	/** The face just tapped, for the submit it starts. */
	let tapped: Feel | null = null;
	let form: HTMLFormElement | undefined = $state();

	// Each opening starts from the day's entry (or nothing): what an earlier
	// opening typed, tapped or was refused is gone with its close.
	$effect.pre(() => {
		if (!open) return;
		untrack(() => {
			note = current?.note ?? '';
			noteAtOpen = note;
			feel = feelOf(current?.rating ?? null);
			busy = null;
			refusal = null;
			tapped = null;
		});
	});

	function tap(f: Feel) {
		if (busy !== null || !form) return;
		tapped = f;
		form.requestSubmit();
	}

	/** The face tap's save (`done-submit.ts`), over this sheet's state. */
	const submit = doneSubmit({
		get tapped() {
			return tapped;
		},
		set tapped(v) {
			tapped = v;
		},
		get feel() {
			return feel;
		},
		set feel(v) {
			feel = v;
		},
		get busy() {
			return busy;
		},
		set busy(v) {
			busy = v;
		},
		get refusal() {
			return refusal;
		},
		set refusal(v) {
			refusal = v;
		},
		get seconds() {
			return seconds;
		},
		onsaved: (r) => onsaved(r)
	});
</script>

<Sheet {title} sub={subtitle || undefined} {open} {onclose}>
	<form
		bind:this={form}
		method="POST"
		{action}
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: title,
			dirty: () => note !== noteAtOpen,
			submit
		}}
	>
		<input type="hidden" name="exerciseId" value={exerciseId} />
		{#if day !== null}<input type="hidden" name="day" value={day} />{/if}
		{#if hearing}<input type="hidden" name="hearing" value={JSON.stringify(hearing.round)} />{/if}

		{#if hearing}
			<div class="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3">
				<span
					class="flex size-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
					><Icon name="ear" size={20} /></span
				>
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="font-display text-[22px] leading-tight font-extrabold text-ink"
						>{t().hearing.score.title(hearing.round.score)}
						{#if gain !== null && gain !== 0}<span class={GAIN_CHIP[gain > 0 ? 'up' : 'down']}
								>{gain > 0 ? `+${gain}` : `−${-gain}`}</span
							>{/if}</span
					>
					<span class="text-[13px] text-ink-2">{hearing.line}</span>
				</span>
			</div>
		{/if}

		{#if !simple}
			<div>
				<label for="done-note-{exerciseId}" class={LABEL}
					>{t().exercise.log.note}<span class="font-medium text-muted"
						>&nbsp;{t().exercise.log.optional}</span
					></label
				>
				<!-- One line that grows with what is typed (`field-sizing`), resizable where it does not. -->
				<textarea
					id="done-note-{exerciseId}"
					name="note"
					rows="1"
					maxlength="2000"
					readonly={busy !== null}
					placeholder={t().exercise.log.notePlaceholder}
					bind:value={note}
					class="{TEXTAREA} field-sizing-content"></textarea>
			</div>
		{/if}

		<FaceRating
			question={title}
			hideQuestion
			value={feel}
			onchange={tap}
			preview={faces}
			{busy}
			{suggest}
		/>

		<p class="m-0 text-center text-[14px] font-semibold text-muted">
			{#if hearing && suggest}{t().exercise.done.suggests(hearing.round.score, feelWord(suggest))}
			{/if}
			{t().exercise.done.tapFace}
		</p>

		{#if refusal}
			<Banner kind="error" title={refusal} />
		{/if}
	</form>
</Sheet>
