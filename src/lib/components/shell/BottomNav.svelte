<script lang="ts">
	import { resolve } from '$app/paths';
	import type { DanceSlug } from '$lib/dances/dances';

	/**
	 * `path` is where the app is GOING while a navigation is in flight, so the
	 * tapped tab lights at once instead of after the data arrives (the root
	 * layout passes `navigating.to`'s path, else the page's).
	 */
	let { dance, path }: { dance: DanceSlug; path: string } = $props();

	const TABS = [
		{ path: '/[dance]' as const, label: 'Today', seg: '' },
		{ path: '/[dance]/figures' as const, label: 'Figures', seg: 'figures' },
		{ path: '/[dance]/routines' as const, label: 'Routines', seg: 'routines' },
		{ path: '/[dance]/lessons' as const, label: 'Lessons', seg: 'lessons' },
		{ path: '/[dance]/songs' as const, label: 'Songs', seg: 'songs' }
	];

	/**
	 * Which tab is lit, decided on the path AFTER the dance segment — the tabs
	 * never leave the dance you are in, so the slug itself says nothing about
	 * which one you are on.
	 *
	 * The prefix test is not a formality: this nav also renders on the shared
	 * pages, and slicing a same-length path off blind lights up Today on
	 * `/voice` (six characters, exactly like `/salsa`).
	 */
	function current(seg: string): boolean {
		const prefix = `/${dance}`;
		if (path !== prefix && !path.startsWith(`${prefix}/`)) return false;
		const rest = path.slice(prefix.length).replace(/^\//, '');
		return seg === '' ? rest === '' : rest.startsWith(seg);
	}

	// Settings and `/voice` are shared by both dances, so this tab sits outside
	// the dance and stays lit across the pair.
	const settingsHere = $derived(path.startsWith('/settings') || path.startsWith('/voice'));
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
	style="padding-bottom: env(safe-area-inset-bottom)"
	aria-label="Main"
>
	<ul class="mx-auto flex max-w-[560px]">
		{#each TABS as tab (tab.seg)}
			{@const here = current(tab.seg)}
			<li class="flex-1">
				<a
					href={resolve(tab.path, { dance })}
					aria-current={here ? 'page' : undefined}
					class="flex h-14 items-center justify-center text-[13px] font-medium whitespace-nowrap sm:text-[14px] {here
						? 'text-accent'
						: 'text-muted'}">{tab.label}</a
				>
			</li>
		{/each}
		<li class="flex-1">
			<a
				href={resolve('/settings')}
				aria-current={settingsHere ? 'page' : undefined}
				class="flex h-14 items-center justify-center text-[13px] font-medium whitespace-nowrap sm:text-[14px] {settingsHere
					? 'text-accent'
					: 'text-muted'}">Settings</a
			>
		</li>
	</ul>
</nav>
