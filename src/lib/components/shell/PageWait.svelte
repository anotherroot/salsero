<script lang="ts">
	import { fade } from 'svelte/transition';
	import StillTrying from './StillTrying.svelte';
	import { moveState } from '$lib/motion/page-move.svelte';
	import { PAGE_MOVE } from '$lib/motion/page-move';
	import { reducedMotion } from '$lib/motion/motion';

	/**
	 * The wait on the lifted card (page changes spec): three dots in the band's
	 * colour once a page takes half a second, and "Still trying… Go back" once it
	 * takes eight. Phone only; drawn where the card waits.
	 */
	let dots = $state(false);
	let still = $state(false);
	const waiting = $derived(
		(moveState.phase === 'up' || moveState.phase === 'held') && moveState.edge !== null
	);

	$effect(() => {
		void moveState.since;
		dots = false;
		still = false;
		if (!waiting) return;
		const a = setTimeout(() => (dots = true), PAGE_MOVE.dotsAfter);
		const b = setTimeout(() => (still = true), PAGE_MOVE.stillAfter);
		return () => {
			clearTimeout(a);
			clearTimeout(b);
		};
	});

	const fadeIn = { duration: 200 };
	const fadeOut = () => ({ duration: reducedMotion() ? 0 : PAGE_MOVE.quietOut });
</script>

{#if waiting && dots}
	<div
		class="pointer-events-none fixed inset-x-0 z-20 flex flex-col items-center gap-1 desk:hidden"
		style:top="{(moveState.edge ?? 0) + PAGE_MOVE.dotsBelow}px"
		role="status"
		in:fade={fadeIn}
		out:fade={fadeOut()}
	>
		<span class="flex h-[10px] items-center gap-[9px]" aria-hidden="true">
			{#each [0, 150, 300] as delay (delay)}
				<i class="wait-dot block size-[10px] rounded-full bg-band" style:animation-delay="{delay}ms"
				></i>
			{/each}
		</span>
		{#if still}
			<StillTrying />
		{/if}
	</div>
{/if}
