<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
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
					{#if leading}<span class="bone size-10 flex-none rounded-xl"></span>{/if}
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
			class="flex flex-col bg-band px-5 {skeleton.kind === 'today' ? 'gap-[6px]' : 'pb-8'}"
			style="padding-top: calc(30px + env(safe-area-inset-top)); --focus-ring: var(--color-band-ink){skeleton.kind ===
			'today'
				? '; padding-bottom: 92px'
				: ''}"
		>
			{#if skeleton.kind === 'today'}
				<div class="flex items-center justify-between gap-3" aria-hidden="true">
					<h1
						class="font-display text-[46px] leading-[1.05] font-extrabold tracking-[-0.02em] text-band-ink"
					>
						Today
					</h1>
					<div class="-mr-[10px] flex text-band-ink">
						<span class="flex size-11 items-center justify-center opacity-45"
							><Icon name="chevron-left" size={24} /></span
						>
						<span class="flex size-11 items-center justify-center"
							><Icon name="settings" size={24} /></span
						>
					</div>
				</div>
				<span class="mt-1 block h-[14px] w-[150px] rounded-[7px] bg-band-ink opacity-[0.28]"></span>
			{:else if skeleton.kind === 'list'}
				<h1 class="font-display text-[34px] leading-tight font-extrabold text-band-ink">
					{skeleton.title}
				</h1>
			{:else}
				<div class="flex h-[42px] items-center" aria-hidden="true">
					<span class="h-6 w-40 rounded-md bg-band-ink opacity-30"></span>
				</div>
			{/if}
		</header>

		{#if skeleton.kind === 'today'}
			<div
				class="relative -mt-7 flex min-h-[60vh] flex-col gap-2 rounded-t-[28px] bg-ground px-4 pb-6"
			>
				<div
					class="-mt-[42px] mb-[10px] flex min-h-[84px] items-center gap-[14px] rounded-[22px] bg-surface py-[14px] pr-[14px] pl-5 shadow-[0_4px_16px_rgb(0_0_0/0.12)]"
					aria-hidden="true"
				>
					<span class="flex flex-1 flex-col gap-[10px]">
						<span class="bone h-[18px] rounded-[9px]" style="width: 58%"></span>
						<span class="bone h-[11px] rounded-[5px]" style="width: 38%"></span>
					</span>
					<span class="bone size-[54px] flex-none rounded-full"></span>
				</div>
				<span class="bone mt-0.5 block h-2.5 w-16 rounded-[5px]" aria-hidden="true"></span>
				{@render rows(3, true)}
				<span class="bone mt-3.5 block h-2.5 w-24 rounded-[5px]" aria-hidden="true"></span>
				{@render rows(2, true)}
			</div>
		{:else}
			<div class="space-y-4 px-4 pt-4">
				{#if skeleton.kind === 'list'}
					{@render rows(7, false)}
				{:else}
					<div class="bone aspect-video rounded-2xl" aria-hidden="true"></div>
					{@render rows(3, false)}
				{/if}
			</div>
		{/if}
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
