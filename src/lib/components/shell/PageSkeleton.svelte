<script lang="ts">
	import type { Skeleton } from '$lib/nav/pending';

	/**
	 * The destination's shape, shown while its data is on the way. It COVERS
	 * the old page rather than replacing it: SvelteKit records the old page's
	 * scroll position only once the new data has arrived, so hiding the old
	 * page would save a scroll of zero and break Back. A navigation that is
	 * refused or fails also finds the old page exactly as it was left.
	 *
	 * It stops at the top of the tab bar when the destination shows one, so the
	 * tab that just lit stays in view, and runs to the bottom when it does not.
	 * It sits above the bars pinned over a page's end (z-30).
	 */
	let { skeleton, tabs }: { skeleton: Skeleton; tabs: boolean } = $props();

	const WIDTHS = [
		[62, 40],
		[48, 56],
		[70, 34],
		[54, 46],
		[66, 38]
	];
</script>

{#snippet rows(n: number, leading: boolean)}
	<div class="overflow-hidden rounded-2xl bg-surface" aria-hidden="true">
		{#each { length: n }, i (i)}
			{@const [w1, w2] = WIDTHS[i % WIDTHS.length]}
			<div class="pl-4">
				<div
					class="flex min-h-16 items-center gap-3 pr-4 {i < n - 1
						? 'border-b border-hairline'
						: ''}"
				>
					{#if leading}<span class="bone size-10 flex-none rounded-[10px]"></span>{/if}
					<div class="flex flex-1 flex-col gap-2">
						<span class="bone h-3 rounded-md" style="width: {w1}%"></span>
						<span class="bone h-2.5 rounded-[5px] opacity-80" style="width: {w2}%"></span>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/snippet}

<div
	class="fixed inset-x-0 top-0 z-[35] overflow-hidden bg-ground"
	style="bottom: {tabs ? 'calc(var(--tab-bar-h) + env(safe-area-inset-bottom))' : '0'}"
	aria-busy="true"
>
	<div class="mx-auto max-w-[560px]">
		<p class="sr-only" role="status">Loading…</p>

		<header
			class="flex flex-col bg-band px-5 pb-8"
			style="padding-top: calc(30px + env(safe-area-inset-top)); --focus-ring: var(--color-band-ink)"
		>
			{#if skeleton.kind === 'list'}
				<h1 class="font-display text-[34px] leading-tight font-extrabold text-band-ink">
					{skeleton.title}
				</h1>
			{:else}
				<div class="flex h-[42px] items-center" aria-hidden="true">
					<span class="h-6 w-40 rounded-md bg-band-ink opacity-30"></span>
				</div>
			{/if}
		</header>

		<div class="space-y-4 px-4 pt-4">
			{#if skeleton.kind === 'list'}
				{@render rows(7, false)}
			{:else if skeleton.kind === 'today'}
				{@render rows(3, true)}
				{@render rows(3, true)}
			{:else}
				<div class="bone aspect-video rounded-2xl" aria-hidden="true"></div>
				{@render rows(3, false)}
			{/if}
		</div>
	</div>
</div>

<style>
	.bone {
		background: var(--color-skeleton);
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
