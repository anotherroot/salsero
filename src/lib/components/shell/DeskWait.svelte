<script lang="ts">
	import StillTrying from './StillTrying.svelte';
	import { PAGE_MOVE } from '$lib/motion/page-move';

	/**
	 * The way out of a page change that waits long when no lifted card shows it (page changes
	 * spec): the desktop always, the phone for a filter, leaving Practice or signing in:
	 * after 8 s, "Still trying… Go back" under the band row, whether a skeleton
	 * shows or not (a pane that stays draws none). Drawn while a navigation runs.
	 */
	let still = $state(false);
	$effect(() => {
		const timer = setTimeout(() => (still = true), PAGE_MOVE.stillAfter);
		return () => clearTimeout(timer);
	});
</script>

{#if still}
	<div
		class="pointer-events-none fixed top-[calc(var(--safe-top)+5rem)] right-0 left-0 z-40 flex justify-center desk:top-[calc(var(--band-row-h)+16px)] desk:left-[var(--side-w)]"
	>
		<div class="rounded-full bg-surface shadow-[0_4px_16px_rgb(0_0_0/0.12)]"><StillTrying /></div>
	</div>
{/if}
