<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { DanceSlug } from '$lib/dances/dances';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';
	import { tabFor } from '$lib/nav/tabs';
	import { levelShown, litAt, tabsFor } from '$lib/levels/levels';
	import { minePath } from '$lib/teams/mode';
	import { groupsTabLabel } from '$lib/teams/view';
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
	const tabs = $derived(tabsFor(levelShown(page.data.user?.level)));

	// Where each tab leads, and a tap on the lit list's own tab (`$lib/nav/tab-links.svelte.ts`).
	const targets = $derived(tabTargets(tabs, dance, path));
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
						Mine: back icon and the word, accent text, no fill. A one-tap form to the
						switch action (team=mine), never a plain link: leaving group mode is the
						switch's, and a load never clears it (preload would). It lands on the
						same tab's own list (`minePath`): Lessons stays Lessons, now yours.
					-->
					<form
						method="POST"
						action="/{dance}/group-mode"
						class="flex w-full"
						use:enhance={() => {
							intend('tab');
							return async ({ update }) => update({ reset: false });
						}}
					>
						<input type="hidden" name="team" value="mine" />
						<input type="hidden" name="to" value={minePath(path, dance)} />
						<button
							type="submit"
							class="flex h-11 w-full items-center justify-center gap-2 px-3 text-accent-text"
						>
							<Icon name="back" size={28} />
							<span class="text-[14px] font-extrabold whitespace-nowrap">{t().shell.mine}</span>
						</button>
					</form>
				{:else}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- a trail href, built from resolved paths -->
					<a
						href={to ?? resolve(tab.path, { dance })}
						onclick={(e) => tapTab(e, to === null)}
						aria-current={here ? 'page' : undefined}
						aria-label={tab.id === 'groups' && page.data.groupsNew
							? groupsTabLabel(true, tab.label)
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
						{#if tab.id === 'groups' && page.data.groupsNew}
							<span
								class="absolute top-1 right-1 h-[10px] w-[10px] rounded-full bg-accent ring-2 ring-tab-bg"
								aria-hidden="true"
							></span>
						{/if}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/if}
			</li>
		{/each}
	</ul>
</nav>
