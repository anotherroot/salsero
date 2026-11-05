<script lang="ts">
	import { FEEL_WORD, type Feel } from '$lib/schedule/feel';
	import { FEEL_TONE } from '$lib/exercises/face-view';

	interface Props {
		feel: Feel;
		size?: number;
		/** Read out as the feeling's word; off when the word is printed beside it. */
		label?: boolean;
	}

	let { feel, size = 36, label = false }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 44 44"
	fill="none"
	stroke="currentColor"
	stroke-width="2.4"
	stroke-linecap="round"
	stroke-linejoin="round"
	class="shrink-0 {FEEL_TONE[feel].text}"
	role={label ? 'img' : undefined}
	aria-label={label ? FEEL_WORD[feel] : undefined}
	aria-hidden={label ? undefined : 'true'}
>
	<circle cx="22" cy="22" r="20" />
	<circle cx="15.5" cy="17" r="2.4" fill="currentColor" stroke="none" />
	<circle cx="28.5" cy="17" r="2.4" fill="currentColor" stroke="none" />
	{#if feel === 'hard'}
		<path d="M15 31 Q22 25 29 31" />
	{:else if feel === 'getting'}
		<path d="M15 29 L29 29" />
	{:else if feel === 'gotit'}
		<path d="M15 27 Q22 33 29 27" />
	{:else}
		<path d="M14 26 Q22 37 30 26 Z" fill="currentColor" />
	{/if}
</svg>
