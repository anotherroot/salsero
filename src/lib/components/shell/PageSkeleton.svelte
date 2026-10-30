<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Skeleton } from '$lib/nav/pending';

	/**
	 * The destination's shape, shown while its data is on the way. It COVERS
	 * the old page rather than replacing it: SvelteKit records the old page's
	 * scroll position only once the new data has arrived, so hiding the old
	 * page would save a scroll of zero and break Back. A navigation that is
	 * refused or fails also finds the old page exactly as it was left.
	 *
	 * It stops at the top of the bottom nav, so the tab that just lit stays
	 * in view, and sits above the bars pinned over a page's end (z-30).
	 */
	let { skeleton, top }: { skeleton: Skeleton; top?: Snippet } = $props();
</script>

<div
	class="fixed inset-x-0 top-0 z-[35] overflow-hidden bg-plane"
	style="bottom: calc(3.5rem + 1px + env(safe-area-inset-bottom))"
	aria-busy="true"
>
	<div class="mx-auto max-w-[560px]">
		{@render top?.()}
		<p class="sr-only" role="status">Loading…</p>

		{#if skeleton.kind === 'list'}
			<header
				class="border-b border-line px-4 pb-3"
				style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
			>
				<h1 class="flex h-10 items-center text-[17px] font-semibold">{skeleton.title}</h1>
			</header>
			<div class="space-y-2 px-4 pt-4" aria-hidden="true">
				{#each { length: 7 }, i (i)}
					<div class="bone h-16 rounded-xl"></div>
				{/each}
			</div>
		{:else if skeleton.kind === 'today'}
			<header
				class="flex h-[61px] items-center justify-center border-b border-line"
				style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
				aria-hidden="true"
			>
				<div class="bone h-5 w-28 rounded"></div>
			</header>
			<div class="space-y-6 px-4 pt-4" aria-hidden="true">
				{#each { length: 3 }, band (band)}
					<div class="space-y-2">
						<div class="bone h-3.5 w-24 rounded"></div>
						{#each { length: 2 }, i (i)}
							<div class="bone h-20 rounded-xl"></div>
						{/each}
					</div>
				{/each}
			</div>
		{:else}
			<header
				class="flex h-[61px] items-center gap-2 border-b border-line px-2"
				style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
				aria-hidden="true"
			>
				<span class="grid size-11 place-items-center text-[22px] text-ink-2">‹</span>
				<div class="bone h-5 w-40 rounded"></div>
			</header>
			<div class="space-y-4 px-4 pt-4" aria-hidden="true">
				<div class="bone aspect-video rounded-xl"></div>
				<div class="bone h-4 w-3/4 rounded"></div>
				<div class="bone h-4 w-1/2 rounded"></div>
				{#each { length: 3 }, i (i)}
					<div class="bone h-14 rounded-xl"></div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.bone {
		background: var(--color-line);
	}
	@media (prefers-reduced-motion: no-preference) {
		.bone {
			animation: breathe 1.4s ease-in-out infinite;
		}
	}
	@keyframes breathe {
		50% {
			opacity: 0.55;
		}
	}
</style>
