<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const TABS = [
		{ href: '/' as const, label: 'Today', match: (p: string) => p === '/' },
		{ href: '/figures' as const, label: 'Figures', match: (p: string) => p.startsWith('/figures') },
		{ href: '/lessons' as const, label: 'Lessons', match: (p: string) => p.startsWith('/lessons') },
		{ href: '/songs' as const, label: 'Songs', match: (p: string) => p.startsWith('/songs') },
		{
			href: '/settings' as const,
			label: 'Settings',
			// `/voice` is reached from here and has no tab of its own, so the tab
			// stays lit while you are in there.
			match: (p: string) => p.startsWith('/settings') || p.startsWith('/voice')
		}
	];
</script>

<nav
	class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
	style="padding-bottom: env(safe-area-inset-bottom)"
	aria-label="Main"
>
	<ul class="mx-auto flex max-w-[560px]">
		{#each TABS as tab (tab.href)}
			{@const current = tab.match(page.url.pathname)}
			<li class="flex-1">
				<a
					href={resolve(tab.href)}
					aria-current={current ? 'page' : undefined}
					class="flex h-14 items-center justify-center text-[14px] font-medium {current
						? 'text-accent'
						: 'text-muted'}">{tab.label}</a
				>
			</li>
		{/each}
	</ul>
</nav>
