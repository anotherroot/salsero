<script lang="ts">
	import { resolve } from '$app/paths';
	import type { DanceSlug } from '$lib/dances/dances';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { TABS, tabFor } from '$lib/nav/tabs';

	/**
	 * `path` is where the app is GOING while a navigation is in flight, so the
	 * tapped tab lights at once instead of after the data arrives (the root
	 * layout passes `navigating.to`'s path, else the page's).
	 */
	let { dance, path }: { dance: DanceSlug; path: string } = $props();

	const lit = $derived(tabFor(path, dance));
</script>

<!-- `--icon-knockout`: filled icons cut their details out in the bar's colour. -->
<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-tab-line bg-tab-bg"
	style="padding-bottom: env(safe-area-inset-bottom); --icon-knockout: var(--color-tab-bg)"
	aria-label="Main"
>
	<ul
		class="mx-auto grid max-w-[560px] items-center gap-1 px-2 py-2"
		style="grid-template-columns: {TABS.map((t) => (t.id === lit ? '1.6fr' : '1fr')).join(' ')}"
	>
		{#each TABS as tab (tab.id)}
			{@const here = tab.id === lit}
			<li class="flex justify-center">
				<a
					href={resolve(tab.path, { dance })}
					aria-current={here ? 'page' : undefined}
					aria-label={here ? undefined : tab.label}
					class="flex h-11 items-center justify-center gap-2 rounded-full {here
						? 'w-full bg-accent/12 px-3 text-accent-text'
						: 'w-11 text-muted'}"
				>
					<Icon name={tab.icon} size={28} filled={here} />
					{#if here}
						<span class="text-[14px] font-extrabold whitespace-nowrap">{tab.label}</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</nav>
