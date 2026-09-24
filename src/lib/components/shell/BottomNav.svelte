<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { DanceSlug } from '$lib/dances/dances';

	let { dance }: { dance: DanceSlug } = $props();

	const TABS = [
		{ path: '/[dance]' as const, label: 'Today', seg: '' },
		{ path: '/[dance]/figures' as const, label: 'Figures', seg: 'figures' },
		{ path: '/[dance]/lessons' as const, label: 'Lessons', seg: 'lessons' },
		{ path: '/[dance]/songs' as const, label: 'Songs', seg: 'songs' }
	];

	/**
	 * Which tab is lit, decided on the path AFTER the dance segment — the tabs
	 * never leave the dance you are in, so the slug itself says nothing about
	 * which one you are on.
	 */
	function current(seg: string): boolean {
		const rest = page.url.pathname.slice(`/${dance}`.length).replace(/^\//, '');
		return seg === '' ? rest === '' : rest.startsWith(seg);
	}

	// Settings and `/voice` are shared by both dances, so this tab sits outside
	// the dance and stays lit across the pair.
	const settingsHere = $derived(
		page.url.pathname.startsWith('/settings') || page.url.pathname.startsWith('/voice')
	);
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
					class="flex h-14 items-center justify-center text-[14px] font-medium {here
						? 'text-accent'
						: 'text-muted'}">{tab.label}</a
				>
			</li>
		{/each}
		<li class="flex-1">
			<a
				href={resolve('/settings')}
				aria-current={settingsHere ? 'page' : undefined}
				class="flex h-14 items-center justify-center text-[14px] font-medium {settingsHere
					? 'text-accent'
					: 'text-muted'}">Settings</a
			>
		</li>
	</ul>
</nav>
