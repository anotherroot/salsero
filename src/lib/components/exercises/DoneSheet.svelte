<script lang="ts">
	import { untrack } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import FaceRating from './FaceRating.svelte';
	import { LABEL, TEXTAREA } from '$lib/components/ui/styles';
	import { feelOf, RATING_OF, type Feel } from '$lib/schedule/feel';
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
		/** The practice panel's player_json. */
		run: string | null;
		day: string | null;
		/** No note (the levels spec's call, kept). */
		simple: boolean;
		/** Done today: that face lit, that note filled. */
		current: { rating: number | null; note: string | null } | null;
		onsaved: (r: DoneResult) => void;
	}

	let {
		open,
		onclose,
		action,
		exerciseId,
		subtitle,
		faces,
		seconds,
		run,
		day,
		simple,
		current,
		onsaved
	}: Props = $props();

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

	const messageOf = (data: unknown): string => {
		const m = (data as { message?: unknown } | undefined)?.message;
		return typeof m === 'string' ? m : t().exercise.log.didNotSave;
	};

	/** The face tap's save: the guarded form's submit callback. */
	const submit: SubmitFunction = ({ formData }) => {
		// A tap names the face; the unsaved dialog's Save sends the lit one, if any.
		const face = tapped ?? feel;
		if (face !== null) {
			formData.set('rating', String(RATING_OF[face]));
			feel = face;
		}
		if (seconds !== null) formData.set('durationS', String(Math.round(seconds)));
		busy = face;
		refusal = null;
		return async ({ result, update }) => {
			if (result.type === 'success') {
				try {
					// While the sheet is still open: the page and the day count the save
					// (the row is done) before the caller leaves.
					await update({ reset: false });
					onsaved(result.data as unknown as DoneResult);
				} finally {
					busy = null;
					tapped = null;
				}
				return;
			}
			busy = null;
			tapped = null;
			if (result.type === 'redirect') {
				await update();
				return;
			}
			// From the submit's own result: a past day's form posts to Today's
			// route, whose refusal never reaches this page's `form`.
			refusal = result.type === 'failure' ? messageOf(result.data) : t().exercise.log.didNotSave;
		};
	};
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
		{#if run !== null}<input type="hidden" name="run" value={run} />{/if}
		{#if day !== null}<input type="hidden" name="day" value={day} />{/if}

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

		<FaceRating question={title} hideQuestion value={feel} onchange={tap} preview={faces} {busy} />

		<p class="m-0 text-center text-[14px] font-semibold text-muted">
			{t().exercise.done.tapFace}
		</p>

		{#if refusal}
			<Banner kind="error" title={refusal} />
		{/if}
	</form>
</Sheet>
