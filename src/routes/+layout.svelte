<script lang="ts">
	import './layout.css';
	import { navigating, page } from '$app/state';
	import { DANCES, danceInPath, type DanceSlug } from '$lib/dances/dances';
	import { leavesPage, SKELETON_DELAY_MS, skeletonFor } from '$lib/nav/pending';
	import { showsTabs } from '$lib/nav/tabs';
	import BottomNav from '$lib/components/shell/BottomNav.svelte';
	import NavProgress from '$lib/components/shell/NavProgress.svelte';
	import PageSkeleton from '$lib/components/shell/PageSkeleton.svelte';
	import UnsavedDialog from '$lib/components/ui/UnsavedDialog.svelte';
	import { guardNavigation, prompt } from '$lib/unsaved/guard.svelte';
	import { syncSheets } from '$lib/sheets/history.svelte';
	import { stopSample } from '$lib/songs/sample-player.svelte';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import { pinned, reportStrip } from '$lib/app-bars.svelte';
	import ErrorScreen from '$lib/components/system/ErrorScreen.svelte';
	import { errorBack, errorView } from '$lib/nav/error-view';

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
		const slug = danceInPath(path);
		return slug ? DANCES[slug] : null;
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
	$effect(() => reportStrip(tabs || pinned.count > 0 ? 'tabs' : 'page'));
	const nav = $derived(Boolean(data.user) && page.url.pathname !== '/login');

	/*
	 * Offline. The root layout has a server load, so a client navigation that
	 * cannot reach the server falls back to a full page load and the browser's
	 * own error page, never `+error.svelte`. So the navigation is stopped before
	 * it starts and the Offline screen is laid OVER the page (not instead of it,
	 * so whatever was typed stays). Registered after `guardNavigation()` so the
	 * unsaved-changes guard has already had its say on the same navigation.
	 */
	let offline = $state<URL | null>(null);
	let layer = $state<HTMLDialogElement>();
	// Taken before the layer mounts: its own <title> is already in place by then.
	let titleBefore = '';
	beforeNavigate((nav) => {
		const { to, willUnload, cancel } = nav;
		// The layer is up: Back (or forward) dismisses it and goes nowhere.
		if (offline && nav.type === 'popstate') {
			cancel();
			offline = null;
			return;
		}
		if (!to?.route.id || willUnload || to.url.origin !== page.url.origin) return;
		if (to.url.href === page.url.href) return;
		if (navigator.onLine) return;
		// The unsaved-changes guard is asking: leaving is not decided yet.
		if (prompt.ask) return;
		cancel();
		titleBefore = document.title;
		offline = to.url;
	});
	afterNavigate(() => (offline = null));
	/*
	 * No preloading while offline. A link touched offline would try to fetch the
	 * route's data and code and fail, and the browser keeps a failed module import
	 * for good, so Try again later would land on the error page.
	 */
	$effect(() => {
		const body = document.body;
		const sync = () => {
			if (navigator.onLine) {
				body.dataset.sveltekitPreloadData = 'hover';
				delete body.dataset.sveltekitPreloadCode;
			} else {
				body.dataset.sveltekitPreloadData = 'off';
				body.dataset.sveltekitPreloadCode = 'off';
			}
		};
		sync();
		window.addEventListener('online', sync);
		window.addEventListener('offline', sync);
		return () => {
			window.removeEventListener('online', sync);
			window.removeEventListener('offline', sync);
		};
	});
	/*
	 * A modal <dialog>, like a Sheet: it sits in the top layer ABOVE an open
	 * sheet, makes the page behind inert, traps focus and holds back the scroll.
	 * The title the layer sets is put back when it goes.
	 */
	$effect(() => {
		if (!layer) return;
		const scroll = document.documentElement.style.overflow;
		document.documentElement.style.overflow = 'hidden';
		layer.showModal();
		// SvelteKit hears no navigation in a Back that only closes a sheet, so listen too.
		const dismiss = () => (offline = null);
		window.addEventListener('popstate', dismiss);
		[...layer.querySelectorAll('button')]
			.find((b) => b.textContent?.includes('Try again'))
			?.focus();
		return () => {
			window.removeEventListener('popstate', dismiss);
			document.title = titleBefore;
			document.documentElement.style.overflow = scroll;
		};
	});
	const retryOffline = () => {
		const url = offline;
		offline = null;
		// invalidateAll: a link tapped offline already tried to preload its data and
		// failed; SvelteKit would reuse that failure for this navigation.
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- the URL the user tapped
		if (url) void goto(url, { invalidateAll: true });
	};
</script>

{#if nav}
	<!--
		`data-dance` carries the accent (see layout.css) down to everything a
		dance touches: the page content, the tab bar (`BottomNav`, a sibling of
		the content div, inside this wrapper), the loading skeleton and the
		unsaved-changes dialog.
		`display: contents` keeps the wrapper out of layout entirely.
	-->
	<div data-dance={navDance.slug} style:display="contents">
		<div
			class="mx-auto min-h-dvh max-w-[560px] {tabs
				? 'pb-[calc(var(--tab-bar-h)+12px+env(safe-area-inset-bottom))]'
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

{#if offline}
	<dialog
		bind:this={layer}
		data-dance={navDance.slug}
		aria-label="Offline"
		class="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-0 bg-ground p-0 text-ink backdrop:bg-transparent"
		oncancel={(e) => {
			e.preventDefault();
			offline = null;
		}}
	>
		<div class="mx-auto max-w-[560px]">
			<ErrorScreen
				view={errorView(0, undefined, true)}
				back={{
					label: errorBack(page.url.pathname, navDance.slug).label,
					onclick: () => (offline = null)
				}}
				todayHref={`/${navDance.slug}`}
				onretry={retryOffline}
			/>
		</div>
	</dialog>
{/if}

<!-- Outside the shell's {#if}: signing in is a navigation too. -->
{#if navigating.to}
	<NavProgress />
{/if}
