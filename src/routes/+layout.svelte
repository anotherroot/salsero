<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { DANCE_SLUGS, DANCES, isDanceSlug, type DanceSlug } from '$lib/dances/dances';
	import BottomNav from '$lib/components/shell/BottomNav.svelte';

	let { data, children } = $props();
	/*
	 * This layout sits ABOVE `[dance]`, so no load of its own hands it the
	 * dance — `/settings`, `/voice` and `/login` live out here too. The URL is
	 * the one thing every page shares, so the slug is read from it, and an
	 * unknown one means this is not a dance page.
	 */
	const slug = $derived(page.url.pathname.split('/')[1] ?? '');
	const dance = $derived(isDanceSlug(slug) ? DANCES[slug] : null);
	/*
	 * The tabs show everywhere, the switcher only inside a dance: on `/settings`
	 * you are not in one, but the way back still has to lead somewhere.
	 *
	 * Where it leads is remembered here rather than read from `data` each time.
	 * The root layout's load depends on a cookie, and SvelteKit's dependency
	 * tracking does not cover cookies, so it never re-runs on a client-side
	 * navigation: after switching to bachata and tapping Settings, `lastDance`
	 * would still say salsa. It is the seed for the first paint; the URL is the
	 * truth after that.
	 */
	let seen = $state<DanceSlug | null>(null);
	$effect(() => {
		if (dance) seen = dance.slug;
	});
	const navDance = $derived(dance ?? DANCES[seen ?? data.lastDance]);
	const nav = $derived(Boolean(data.user) && page.url.pathname !== '/login');
</script>

{#if nav}
	<div class="mx-auto min-h-dvh max-w-[560px] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
		{#if dance}
			<!--
				`aria-current="true"`, not "page": the bottom tabs already mark the
				page, and on `/[dance]` the active pill and the Today tab are the
				same destination — two "page" markers on one screen.
			-->
			<nav class="flex justify-center gap-1 px-4 pt-2" aria-label="Dance">
				{#each DANCE_SLUGS as s (s)}
					<a
						href={resolve('/[dance]', { dance: s })}
						aria-current={s === dance.slug ? 'true' : undefined}
						class="rounded-full px-3 py-1 text-[13px] font-medium {s === dance.slug
							? 'bg-accent text-accent-ink'
							: 'text-muted'}">{DANCES[s].label}</a
					>
				{/each}
			</nav>
		{/if}
		{@render children()}
	</div>
	<BottomNav dance={navDance.slug} />
{:else}
	{@render children()}
{/if}
