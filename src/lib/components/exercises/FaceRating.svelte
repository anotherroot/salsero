<script lang="ts">
	import { play } from '$lib/motion/motion';
	import Face from './Face.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { t } from '$lib/i18n/catalog';
	import { FEEL_TONE, SUGGEST_TAG, faceColumns } from '$lib/exercises/face-view';
	import { RATING_OF, type Feel } from '$lib/schedule/feel';
	import type { FacePreview } from '$lib/schedule/schedule';

	interface Props {
		question: string;
		value: Feel | null;
		onchange: (feel: Feel) => void;
		/** The time each face would set, or null (a back-filled day, no schedule). */
		preview?: (FacePreview & { learnt?: boolean })[] | null;
		/** "Done early: …", under the faces. */
		early?: string | null;
		/** The sheet's title asks the question: the legend is for screen readers only. */
		hideQuestion?: boolean;
		/** The face whose save is in flight: every card is disabled, that one `aria-busy`. */
		busy?: Feel | null;
		/** A face a score suggests (a hearing round): tagged, never picked for the person. */
		suggest?: Feel | null;
	}

	let {
		question,
		value,
		onchange,
		preview = null,
		early = null,
		hideQuestion = false,
		busy = null,
		suggest = null
	}: Props = $props();
	const columns = $derived(faceColumns(preview));
	const anyLearnt = $derived(columns.some((c) => c.learnt));

	const POP: Keyframe[] = [
		{ transform: 'none' },
		{ transform: 'scale(.92)', offset: 0.25 },
		{ transform: 'scale(1.08)', offset: 0.65 },
		{ transform: 'none' }
	];
</script>

<fieldset class="m-0 min-w-0 border-0 p-0">
	<legend class={hideQuestion ? 'sr-only' : 'block pb-1.5 pl-1 text-[13px] font-bold text-ink-2'}
		>{question}</legend
	>
	<input type="hidden" name="rating" value={value === null ? '' : RATING_OF[value]} />
	<div class="grid grid-cols-4 gap-1.5">
		{#each columns as c (c.feel)}
			<!-- While a face saves it is the one lit, with a spinner for its time; the others dim. -->
			{@const on = busy === null ? value === c.feel : busy === c.feel}
			{@const dim = busy === null ? value !== null : busy !== c.feel}
			{@const tone = FEEL_TONE[c.feel]}
			<!-- Three fixed rows (face, word, time): the faces sit level however the words wrap. -->
			<button
				type="button"
				aria-pressed={on}
				aria-busy={busy === c.feel ? true : undefined}
				disabled={busy !== null}
				onclick={(e) => {
					// It pops as it is picked (motion round 1); the pick does not wait for it.
					play(e.currentTarget, POP, { duration: 420, easing: 'ease-out' });
					onchange(c.feel);
				}}
				class="relative grid min-w-0 cursor-pointer {anyLearnt
					? 'grid-rows-[auto_2.5em_2.6em]'
					: 'grid-rows-[auto_2.5em_1.4em]'} justify-items-center gap-1 rounded-[14px] px-1 pt-3 pb-2 text-center ring-inset {tone.bg} {tone.text} {tone.ring} {on ||
				(value === null && busy === null && suggest === c.feel)
					? 'ring-[3px]'
					: dim
						? 'opacity-55 ring-2'
						: 'ring-2'} disabled:cursor-default"
			>
				{#if suggest === c.feel}
					<span
						class="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 text-[10.5px] leading-[1.6] font-extrabold whitespace-nowrap {SUGGEST_TAG[
							c.feel
						]}">{t().exercise.done.suggested}</span
					>
				{/if}
				<Face feel={c.feel} size={36} />
				<span class="text-[13px] leading-[1.15] font-bold">{c.word}</span>
				{#if busy === c.feel}
					<span class="flex items-start justify-center text-ink-2"><Spinner size={16} /></span>
				{:else}
					<span class="text-[12px] font-semibold text-ink-2"
						>{c.time ?? ''}{#if c.learnt}<br /><span class="text-done"
								>{t().exercise.done.learnt}</span
							>{/if}</span
					>
				{/if}
			</button>
		{/each}
	</div>
	{#if early}
		<p class="m-0 pt-2 pl-1 text-[13px] text-muted">{early}</p>
	{/if}
</fieldset>
