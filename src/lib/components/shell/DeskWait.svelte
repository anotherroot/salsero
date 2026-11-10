<script lang="ts">
	import StillTrying from './StillTrying.svelte';
	import { PAGE_MOVE } from '$lib/motion/page-move';

	/**
	 * The desktop's way out of a page change that waits long (page changes spec):
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
		class="pointer-events-none fixed top-[calc(var(--band-row-h)+16px)] right-0 left-[var(--side-w)] z-40 hidden justify-center desk:flex"
	>
		<div class="rounded-full bg-surface shadow-[0_4px_16px_rgb(0_0_0/0.12)]"><StillTrying /></div>
	</div>
{/if}
