<script lang="ts">
	import { fade } from 'svelte/transition';
	import { t } from '$lib/i18n/catalog';
	import { goBack, moveState } from '$lib/motion/page-move.svelte';
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
			<button
				type="button"
				class="pointer-events-auto cursor-pointer px-4 py-[14px] text-[16px] leading-[1.2] font-semibold text-muted"
				onclick={goBack}
				in:fade={fadeIn}
			>
				{t().shell.wait.still}
				<b class="ml-1 font-bold text-band">{t().shell.wait.back}</b>
			</button>
		{/if}
	</div>
{/if}
