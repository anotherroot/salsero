<script lang="ts">
	import ListPane from '../ListPane.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';

	/**
	 * Specs only (`pane-landmarks.spec.ts`): a list and, on an item route, its item
	 * beside it, as a section's layout and an item page render them, for the
	 * landmarks the server draws.
	 */
	let { isList }: { isList: boolean } = $props();
</script>

{#snippet list()}<ul><li>Enchufla</li></ul>{/snippet}
{#snippet empty()}<p>Pick a figure</p>{/snippet}
{#snippet stop()}<button type="button" aria-label="Stop editing">×</button>{/snippet}
{#snippet below()}<p>Below the title</p>{/snippet}

<ListPane {list} {isList} title="Moves" {empty}>
	<Screen compact title="Enchufla · Doble" subtitle="Figure" left={stop} {below}>
		<p>Its facts</p>
	</Screen>
</ListPane>
