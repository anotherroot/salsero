<!-- src/lib/components/ui/LinkedText.svelte -->
<script lang="ts">
	import { textPieces } from '$lib/links';

	interface Props {
		text: string;
		class?: string;
	}

	// Pieces, not {@html}: the URLs become <a> elements Svelte builds, so there
	// is no string of markup anywhere for a note to inject into.
	let { text, class: klass = '' }: Props = $props();
</script>

<p class={klass}>
	{#each textPieces(text) as piece, i (i)}{#if 'url' in piece}<a
				href={piece.url}
				target="_blank"
				rel="external noopener noreferrer"
				class="break-all text-accent underline">{piece.url}</a
			>{:else}{piece.text}{/if}{/each}
</p>
