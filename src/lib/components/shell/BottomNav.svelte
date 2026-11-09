<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { DanceSlug } from '$lib/dances/dances';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';
	import { tabDot, tabDotLabel, tabFor } from '$lib/nav/tabs';
	import { levelShown, litAt, tabsFor } from '$lib/levels/levels';
	import { minePath } from '$lib/teams/mode';
	import { intend } from '$lib/nav/trail.svelte';
	import { tabTargets, tapTab } from '$lib/nav/tab-links.svelte';

	/**
	 * `path` is where the app is GOING while a navigation is in flight, so the
	 * tapped tab lights at once instead of after the data arrives (the root
	 * layout passes `navigating.to`'s path, else the page's).
	 */
	let { dance, path }: { dance: DanceSlug; path: string } = $props();

	// In group mode Today is not a tab: a plain Mine button back to the personal side.
	const inGroup = $derived(!!page.data.groupMode);
	// A class's lesson lights My class at Follow my class (`litAt`).
	const lit = $derived(
		litAt(
			tabFor(path, dance),
			levelShown(page.data.user?.level),
			(page.data.lesson?.teamId ?? null) !== null
		)
	);
	// The person's level's tabs. A page whose tab is not among them lights none.
	const level = $derived(levelShown(page.data.user?.level));
	const tabs = $derived(tabsFor(level));

	// Where each tab leads, and a tap on the lit list's own tab (`$lib/nav/tab-links.svelte.ts`).
	const view = $derived(page.data.groupMode?.teamId ?? null);
	const targets = $derived(tabTargets(tabs, dance, path, view));
	// Mine: your own copy of what is open, else this tab's own list (group view spec).
	const mine = $derived((page.data.mineHref as string | undefined) ?? minePath(path, dance));
</script>

<!--
	`--icon-knockout`: filled icons cut their details out in the bar's colour.
	On the desktop the side (`Side.svelte`) is the main nav and this bar is gone.
-->
<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-tab-line bg-tab-bg desk:hidden"
	style="height: calc(var(--tab-bar-h) + var(--safe-bottom)); padding-bottom: var(--safe-bottom); --icon-knockout: var(--color-tab-bg)"
	aria-label={t().shell.mainNav}
	data-tab-bar
>
	<ul
		class="mx-auto grid max-w-[560px] items-center gap-1 px-2 pt-[10px] pb-2"
		style="grid-template-columns: {tabs
			.map((tab) => (tab.id === lit || (inGroup && tab.id === 'today') ? '2fr' : '1fr'))
			.join(' ')}"
	>
		{#each tabs as tab, i (tab.id)}
			{@const here = tab.id === lit}
			{@const to = targets[i]}
			<li class="flex justify-center">
				{#if inGroup && tab.id === 'today'}
					<!--
						Mine: back icon and the word, no fill. A plain link out of the group's
						view (group view spec): to your own copy of what is open (`mineHref`),
						else the same tab's own list (`minePath`). Nothing to switch, so a
						preload is harmless.
					-->
					<a
						href={mine}
						onclick={() => intend('tab')}
						class="flex h-11 w-full items-center justify-center gap-2 px-3 text-accent-text"
					>
						<Icon name="back" size={28} />
						<span class="text-[14px] font-extrabold whitespace-nowrap">{t().shell.mine}</span>
					</a>
				{:else}
					<a
						href={to ?? resolve(tab.path, { dance })}
						onclick={(e) => tapTab(e, to === null)}
						aria-current={here ? 'page' : undefined}
						aria-label={tabDot(tab.id, page.data)
							? tabDotLabel(tab.id, tab.label)
							: here
								? undefined
								: tab.label}
						class="relative flex h-11 items-center justify-center gap-2 rounded-full {here
							? 'w-full bg-accent/12 px-3 text-accent-text'
							: 'w-11 text-muted'}"
					>
						<Icon name={tab.icon} size={28} filled={here} />
						{#if here}
							<span class="text-[14px] font-extrabold whitespace-nowrap">{tab.label}</span>
						{/if}
						{#if tabDot(tab.id, page.data)}
							<span
								class="absolute top-1 right-1 h-[10px] w-[10px] rounded-full bg-accent ring-2 ring-tab-bg"
								aria-hidden="true"
							></span>
						{/if}
					</a>
				{/if}
			</li>
		{/each}
	</ul>
</nav>
