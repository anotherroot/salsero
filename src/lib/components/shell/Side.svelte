<script lang="ts">
	import { frameView } from '$lib/teams/frame-view.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { DanceSlug } from '$lib/dances/dances';
	import Icon from '$lib/components/ui/Icon.svelte';
	import GroupCard from './GroupCard.svelte';
	import type { GroupMode } from '$lib/types';
	import { t } from '$lib/i18n/catalog';
	import { levelShown, litAt, sideTabsFor } from '$lib/levels/levels';
	import { sideLit } from '$lib/nav/frame';
	import { minePath } from '$lib/teams/mode';
	import { tabDot, tabDotLabel } from '$lib/nav/tabs';
	import { intend } from '$lib/nav/trail.svelte';
	import { tabTargets, tapTab } from '$lib/nav/tab-links.svelte';

	/**
	 * The desktop's main nav (desktop spec, "The side"): the level's tabs at the top,
	 * Settings at the bottom, on the band down the left of the window. It is the
	 * phone's tab bar at desk width (`BottomNav`, hidden there): which tab is lit
	 * and where a tap goes are the same (`$lib/nav/tab-links.svelte.ts`). `path`
	 * is where the app is going, as for the tab bar.
	 */
	let { dance, path }: { dance: DanceSlug; path: string } = $props();

	// In group mode Today is not a tab: Mine, back to the personal side.
	// The group's view: the side opens with its card (group view spec), Mine for Today.
	const group = $derived((page.data.groupMode ?? frameView.current) as GroupMode | null);
	const inGroup = $derived(group !== null);
	const lit = $derived(
		litAt(
			sideLit(path, dance),
			levelShown(page.data.user?.level),
			(page.data.lesson?.teamId ?? null) !== null
		)
	);
	// The person's level's tabs, as in the tab bar but without You (`sideTabsFor`).
	const tabs = $derived(sideTabsFor(levelShown(page.data.user?.level)));
	const view = $derived(page.data.groupMode?.teamId ?? null);
	const targets = $derived(tabTargets(tabs, dance, path, view));
	// Mine on a page that holds the view (a drill being edited): stop editing, stay.
	function leaveGroup(e: MouseEvent) {
		const stop = frameView.stop;
		if (stop) {
			e.preventDefault();
			stop();
			return;
		}
		intend('tab');
	}
	const mine = $derived((page.data.mineHref as string | undefined) ?? minePath(path, dance));

	const ITEM =
		'flex h-12 items-center gap-3 rounded-[24px] pr-[18px] pl-[14px] text-[16px] whitespace-nowrap';
	const OFF = `${ITEM} font-bold text-band-small hover:bg-band-ink/10`;
	const ON = `${ITEM} bg-band-ink font-extrabold text-on-cream`;
</script>

<!--
	Hidden below 1024, where the tab bar is the nav: only one "Main" is ever shown.
	`--icon-knockout`: a lit tab's filled icon cuts its details out in the pill's cream.
	`--focus-ring`: the accent is the band's own colour here and would not show.
-->
<nav
	class="fixed top-[var(--band-row-h)] bottom-0 left-0 z-30 hidden w-[var(--side-w)] flex-col justify-between bg-band px-[22px] pt-[6px] pb-[20px] desk:flex"
	style="--icon-knockout: var(--color-band-ink); --focus-ring: var(--color-band-ink)"
	aria-label={t().shell.mainNav}
	data-side
>
	<div class="flex flex-col">
		{#if group}<GroupCard {group} />{/if}
		<ul class="flex flex-col gap-1">
			{#each tabs as tab, i (tab.id)}
				{@const here = tab.id === lit}
				{@const to = targets[i]}
				{@const fresh = tabDot(tab.id, page.data)}
				<li>
					{#if inGroup && tab.id === 'today'}
						<!-- Mine: the tab bar's plain link out of the group's view (`BottomNav` says where), never lit. -->
						<a
							href={mine}
							onclick={leaveGroup}
							class="{ITEM} w-full font-extrabold text-band-small hover:bg-band-ink/10"
						>
							<Icon name="back" size={24} />
							{t().shell.mine}
						</a>
					{:else}
						<a
							href={to ?? resolve(tab.path, { dance })}
							onclick={(e) => tapTab(e, to === null)}
							aria-current={here ? 'page' : undefined}
							aria-label={fresh ? tabDotLabel(tab.id, tab.label) : undefined}
							class={here ? ON : OFF}
						>
							<Icon name={tab.icon} size={24} filled={here} />
							{tab.label}
							{#if fresh}
								<span
									class="mt-3 -ml-1 h-[9px] w-[9px] flex-none self-start rounded-full {here
										? 'bg-band'
										: 'bg-band-ink'}"
									aria-hidden="true"
								></span>
							{/if}
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
	<a
		href={resolve('/settings')}
		aria-current={lit === 'settings' ? 'page' : undefined}
		class={lit === 'settings' ? ON : OFF}
	>
		<Icon name="settings" size={24} filled={lit === 'settings'} />
		{t().shell.settings}
	</a>
</nav>
