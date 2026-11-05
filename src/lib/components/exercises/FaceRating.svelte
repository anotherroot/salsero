<script lang="ts">
	import Face from './Face.svelte';
	import { FEEL_TONE, faceColumns } from '$lib/exercises/face-view';
	import { RATING_OF, type Feel } from '$lib/schedule/feel';
	import type { FacePreview } from '$lib/schedule/schedule';

	interface Props {
		question: string;
		value: Feel | null;
		onchange: (feel: Feel) => void;
		/** The time each face would set, or null (a back-filled day, no schedule). */
		preview?: FacePreview[] | null;
		/** "Done early: …", under the faces. */
		early?: string | null;
	}

	let { question, value, onchange, preview = null, early = null }: Props = $props();
	const columns = $derived(faceColumns(preview));
</script>

<fieldset class="m-0 min-w-0 border-0 p-0">
	<legend class="block pb-1.5 pl-1 text-[13px] font-bold text-ink-2">{question}</legend>
	<input type="hidden" name="rating" value={value === null ? '' : RATING_OF[value]} />
	<div class="grid grid-cols-4 gap-1.5">
		{#each columns as c (c.feel)}
			{@const on = value === c.feel}
			{@const tone = FEEL_TONE[c.feel]}
			<!-- Three fixed rows (face, word, time): the faces sit level however the words wrap. -->
			<button
				type="button"
				aria-pressed={on}
				onclick={() => onchange(c.feel)}
				class="grid min-w-0 cursor-pointer grid-rows-[auto_2.5em_1.4em] justify-items-center gap-1 rounded-[14px] px-1 pt-3 pb-2 text-center ring-inset {tone.bg} {tone.text} {tone.ring} {on
					? 'ring-[3px]'
					: value === null
						? 'ring-2'
						: 'opacity-55 ring-2'}"
			>
				<Face feel={c.feel} size={36} />
				<span class="text-[13px] leading-[1.15] font-bold">{c.word}</span>
				<span class="text-[12px] font-semibold text-ink-2">{c.time ?? ''}</span>
			</button>
		{/each}
	</div>
	{#if early}
		<p class="m-0 pt-2 pl-1 text-[13px] text-muted">{early}</p>
	{/if}
</fieldset>
