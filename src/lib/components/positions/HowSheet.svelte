<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { button } from '$lib/components/ui/styles';
	import { EMPTY_ACTIONS, HOW } from '$lib/positions/view';
	import HowBody from './HowBody.svelte';

	/** How positions work (`HowBody`) in a sheet: read once, then closed. */
	let { open, onclose }: { open: boolean; onclose: () => void } = $props();
</script>

<Sheet title={EMPTY_ACTIONS.how} {open} {onclose}>
	<HowBody />

	{#snippet footer()}
		<button type="button" class={button('primary', 'md', true)} onclick={onclose}>{HOW.done}</button
		>
	{/snippet}
</Sheet>
