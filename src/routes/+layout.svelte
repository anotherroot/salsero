<script lang="ts">
	import './layout.css';
	import { navigating, page } from '$app/state';
	import { DANCES, isDanceSlug, type DanceSlug } from '$lib/dances/dances';
	import { leavesPage, SKELETON_DELAY_MS, skeletonFor } from '$lib/nav/pending';
	import { showsTabs } from '$lib/nav/tabs';
	import BottomNav from '$lib/components/shell/BottomNav.svelte';
	import NavProgress from '$lib/components/shell/NavProgress.svelte';
	import PageSkeleton from '$lib/components/shell/PageSkeleton.svelte';
	import UnsavedDialog from '$lib/components/ui/UnsavedDialog.svelte';
	import { guardNavigation } from '$lib/unsaved/guard.svelte';
	import { syncSheets } from '$lib/sheets/history.svelte';
	import { stopSample } from '$lib/songs/sample-player.svelte';
	import { beforeNavigate } from '$app/navigation';

	let { data, children } = $props();
	guardNavigation();
	// Back closes the top sheet, not the page (`$lib/sheets/stack.ts`).
	syncSheets();
	// A sample belongs to the page it was started on.
	beforeNavigate(() => stopSample());
	/*
	 * This layout sits ABOVE `[dance]`, so no load of its own hands it the
	 * dance — `/settings`, `/voice` and `/login` live out here too. The URL is
	 * the one thing every page shares, so the slug is read from it, and an
	 * unknown one means this is not a dance page.
	 */
	const danceOf = (path: string) => {
		const slug = path.split('/')[1] ?? '';
		return isDanceSlug(slug) ? DANCES[slug] : null;
	};
	const dance = $derived(danceOf(page.url.pathname));
	/*
	 * Where the app is going, while a navigation waits for its data (see
	 * `$lib/nav/pending.ts`). The tabs and the accent
	 * follow it at once, so a tap shows before the page does; what the page
	 * itself renders still follows `page`.
	 */
	const shownPath = $derived(navigating.to?.url.pathname ?? page.url.pathname);
	const shownDance = $derived(danceOf(shownPath));
	const leaving = $derived(
		navigating.to != null && leavesPage(page.url.pathname, navigating.to.url.pathname)
	);
	/*
	 * The skeleton waits SKELETON_DELAY_MS so a fast load swaps straight to
	 * the page. `leaving` is a boolean, so a redirect mid-flight (a new
	 * target, still leaving) neither restarts the wait nor drops a skeleton
	 * already up.
	 */
	let late = $state(false);
	$effect(() => {
		if (!leaving) {
			late = false;
			return;
		}
		const timer = setTimeout(() => (late = true), SKELETON_DELAY_MS);
		return () => clearTimeout(timer);
	});
	const skeleton = $derived(late && navigating.to ? skeletonFor(navigating.to.route.id) : null);
	/*
	 * The tabs show on the four top-level screens only (`showsTabs`), judged on
	 * where the app is going so the bar comes or goes with the tap.
	 *
	 * Which dance they lead to is remembered here rather than read from `data` each time.
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
	const navDance = $derived(shownDance ?? dance ?? DANCES[seen ?? data.lastDance]);
	const tabs = $derived(showsTabs((navigating.to ?? page).route.id));
	const nav = $derived(Boolean(data.user) && page.url.pathname !== '/login');
</script>

{#if nav}
	<!--
		`data-dance` carries the accent (see layout.css) down to everything a
		dance touches: the page content, and
		`BottomNav` — which renders as a SIBLING of the wrapper div, not a
		child of it, so it needs its own place inside this attribute's reach.
		`display: contents` keeps the wrapper out of layout entirely.
	-->
	<div data-dance={navDance.slug} style:display="contents">
		<div
			class="mx-auto min-h-dvh max-w-[560px] {tabs
				? 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]'
				: ''}"
		>
			{@render children()}
		</div>
		{#if skeleton}
			<PageSkeleton {skeleton} {tabs} />
		{/if}
		{#if tabs}
			<BottomNav dance={navDance.slug} path={shownPath} />
		{/if}
		<!-- In here, not after the {#if}: its Save button takes the dance's accent too. -->
		<UnsavedDialog />
	</div>
{:else}
	{@render children()}
	<UnsavedDialog />
{/if}

<!-- Outside the shell's {#if}: signing in is a navigation too. -->
{#if navigating.to}
	<NavProgress />
{/if}
