<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { DanceSlug } from '$lib/dances/dances';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { TABS, tabFor } from '$lib/nav/tabs';
	import { groupsTabLabel } from '$lib/teams/view';
	import { intend, tabHref } from '$lib/nav/trail.svelte';

	/**
	 * `path` is where the app is GOING while a navigation is in flight, so the
	 * tapped tab lights at once instead of after the data arrives (the root
	 * layout passes `navigating.to`'s path, else the page's).
	 */
	let { dance, path }: { dance: DanceSlug; path: string } = $props();

	// In group mode Today is not a tab: a plain Mine button back to the personal side.
	const inGroup = $derived(!!page.data.groupMode);
	const lit = $derived(tabFor(path, dance));

	/*
	 * A tab reopens the last page seen in it (`$lib/nav/trail.ts`). The lit tab
	 * on its own main list has nowhere to go: its link keeps the list's href
	 * (long-press, new tab) and a tap scrolls the list to the top.
	 */
	const targets = $derived(TABS.map((t) => tabHref(t.id, dance, path)));

	function tap(e: MouseEvent, scrollTop: boolean) {
		if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
		if (!scrollTop) {
			intend('tab');
			return;
		}
		e.preventDefault();
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' });
	}
</script>

<!-- `--icon-knockout`: filled icons cut their details out in the bar's colour. -->
<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-tab-line bg-tab-bg"
	style="height: calc(var(--tab-bar-h) + var(--safe-bottom)); padding-bottom: var(--safe-bottom); --icon-knockout: var(--color-tab-bg)"
	aria-label="Main"
	data-tab-bar
>
	<ul
		class="mx-auto grid max-w-[560px] items-center gap-1 px-2 pt-[10px] pb-2"
		style="grid-template-columns: {TABS.map((t) =>
			t.id === lit || (inGroup && t.id === 'today') ? '2fr' : '1fr'
		).join(' ')}"
	>
		{#each TABS as tab, i (tab.id)}
			{@const here = tab.id === lit}
			{@const to = targets[i]}
			<li class="flex justify-center">
				{#if inGroup && tab.id === 'today'}
					<!--
						Mine: back icon and the word, accent text, no fill. A one-tap form to the
						switch action (team=mine), never a plain link: leaving group mode is the
						switch's, and a load never clears it (preload would).
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
						<input type="hidden" name="to" value="/{dance}" />
						<button
							type="submit"
							class="flex h-11 w-full items-center justify-center gap-2 px-3 text-accent-text"
						>
							<Icon name="back" size={28} />
							<span class="text-[14px] font-extrabold whitespace-nowrap">Mine</span>
						</button>
					</form>
				{:else}
					<!-- eslint-disable svelte/no-navigation-without-resolve -- a trail href, built from resolved paths -->
					<a
						href={to ?? resolve(tab.path, { dance })}
						onclick={(e) => tap(e, to === null)}
						aria-current={here ? 'page' : undefined}
						aria-label={tab.id === 'groups' && page.data.groupsNew
							? groupsTabLabel(true)
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
