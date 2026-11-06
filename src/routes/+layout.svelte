<script lang="ts">
	import './layout.css';
	import { untrack } from 'svelte';
	import { navigating, page, updated } from '$app/state';
	import { DANCES, danceInPath, type DanceSlug } from '$lib/dances/dances';
	import { deskSkeletonMode, leavesPage, SKELETON_DELAY_MS, skeletonFor } from '$lib/nav/pending';
	import { showsTabs } from '$lib/nav/tabs';
	import { bottom } from '$lib/nav/chrome.svelte';
	import BottomNav from '$lib/components/shell/BottomNav.svelte';
	import Side from '$lib/components/shell/Side.svelte';
	import SheetCorner from '$lib/components/shell/SheetCorner.svelte';
	import { frameNow } from '$lib/nav/frame';
	import NavProgress from '$lib/components/shell/NavProgress.svelte';
	import PageSkeleton from '$lib/components/shell/PageSkeleton.svelte';
	import UnsavedDialog from '$lib/components/ui/UnsavedDialog.svelte';
	import ClashSheet from '$lib/components/ui/ClashSheet.svelte';
	import {
		clashPrompt,
		guardNavigation,
		loadAgreed,
		prompt,
		sendingNow,
		unsaved
	} from '$lib/unsaved/guard.svelte';
	import { entryState, syncSheets } from '$lib/sheets/history.svelte';
	import { listOpener, openerAhead, syncTrail } from '$lib/nav/trail.svelte';
	import { columnOf } from '$lib/nav/moves-pane';
	import { stopSample } from '$lib/songs/sample-player.svelte';
	import { afterNavigate, beforeNavigate, goto, invalidate } from '$app/navigation';
	import ErrorScreen from '$lib/components/system/ErrorScreen.svelte';
	import UpdateNeeded from '$lib/components/system/UpdateNeeded.svelte';
	import { BUSY_ROUTES, updateNeededNow } from '$lib/app-update/view';
	import {
		fullLoadFor,
		mayReloadNow,
		reloadWhy,
		typedFields,
		type FieldState
	} from '$lib/nav/fresh';
	import { held } from '$lib/nav/fresh.svelte';
	import ReloadBar from '$lib/components/shell/ReloadBar.svelte';
	import { holdsBack, staleMove } from '$lib/page-epoch';
	import { errorBack, errorView } from '$lib/nav/error-view';

	let { data, children } = $props();
	guardNavigation();
	// Back closes the top sheet, not the page (`$lib/sheets/stack.ts`).
	syncSheets();
	// Tabs reopen where you left them; the band's back goes where you came from.
	syncTrail();
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
	// A navigation held back by the page epoch (`stuck`, below) is not under way:
	// it waits for Reload, so no tab, skeleton or progress bar says otherwise.
	let stuck = $state(false);
	const ahead = $derived(stuck ? null : navigating.to);
	/*
	 * The list column beside the page now and beside the one loading: the desktop
	 * skeleton covers only the pane when it stays (a figure opened from a routine
	 * keeps the Routines column), the whole frame when it changes.
	 */
	const columnNow = $derived(
		columnOf(page.route.id, page.url.pathname, listOpener(page.url.pathname))
	);
	const columnAhead = $derived(
		ahead
			? columnOf(
					ahead.route.id,
					ahead.url.pathname,
					openerAhead(ahead.url.pathname, page.url.pathname, navigating.type)
				)
			: null
	);
	const shownPath = $derived(ahead?.url.pathname ?? page.url.pathname);
	const shownDance = $derived(danceOf(shownPath));
	const leaving = $derived(ahead != null && leavesPage(page.url.pathname, ahead.url.pathname));
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
	const skeleton = $derived(late && ahead ? skeletonFor(ahead.route.id, ahead.url.search) : null);
	/*
	 * The tabs show inside a dance except Practice and share (`showsTabs`), judged
	 * on where the app is going so the bar comes or goes with the tap, and step
	 * aside while a bar claims the bottom (`$lib/nav/chrome.svelte.ts`). Pinned
	 * bars read `--pin-bottom` / `--pin-safe` to sit above the tab bar or on the edge.
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
	const tabs = $derived(showsTabs((ahead ?? page).route.id) && !bottom.claimed);
	const nav = $derived(Boolean(data.user) && page.url.pathname !== '/login');
	/*
	 * What surrounds the page on the desktop (`$lib/nav/frame.ts`): the page's own
	 * until the skeleton covers it, then the destination's (`frameNow`), so the old
	 * page never reflows under a tap. Below 1024 none of it shows: every class it
	 * adds is `desk:`, and the frame's variables are 0 there. An error page's frame
	 * comes from the path that was asked for (`frameOfError`): a 404 has no route.
	 */
	const frame = $derived(
		frameNow(
			{ routeId: page.route.id, path: page.url.pathname, error: Boolean(page.error) },
			ahead ? ahead.route.id : undefined,
			skeleton !== null,
			nav
		)
	);
	const SHEET = {
		side: 'desk:ml-[var(--side-w)] desk:pt-[var(--band-row-h)] desk:max-w-none desk:bg-ground',
		bare: 'desk:pt-[var(--band-row-h)] desk:max-w-none desk:bg-ground',
		// The card pages' own column (`CardFrame`) is the band-coloured window.
		card: 'desk:max-w-none',
		none: ''
	} as const;

	/*
	 * Update needed replaces the whole tree, so it never lands on a page mid-edit
	 * (`updateNeededNow`): it comes with a page load or a finished navigation,
	 * and when the answer turns required on an open page, at once only if that
	 * page is quiet, else at the next navigation. Coming back to the app and
	 * every navigation ask again (the root load never re-runs by itself).
	 */
	let updateNeeded = $state(
		untrack(() =>
			updateNeededNow(data.appUpdate, {
				routeId: page.route.id,
				shown: false,
				at: 'load',
				playerOpen: false,
				sheetsOpen: false,
				unsaved: 0,
				held: 0
			})
		)
	);
	const judgeUpdate = (at: 'navigated' | 'refresh') => {
		updateNeeded = updateNeededNow(data.appUpdate, {
			routeId: page.route.id,
			shown: updateNeeded,
			at,
			...quietNow()
		});
	};
	$effect(() => {
		void data.appUpdate;
		untrack(() => judgeUpdate('refresh'));
	});
	afterNavigate((nav) => {
		if (!data.appUpdate) return;
		// A hash link stays on the page, with whatever it holds.
		const samePage = nav.from?.url.pathname === nav.to?.url.pathname;
		judgeUpdate(nav.type === 'enter' || samePage ? 'refresh' : 'navigated');
		if (nav.type !== 'enter') void invalidate('app:update');
	});
	$effect(() => {
		if (!data.appUpdate) return;
		const back = () => {
			if (document.visibilityState === 'visible') void invalidate('app:update');
		};
		document.addEventListener('visibilitychange', back);
		return () => document.removeEventListener('visibilitychange', back);
	});

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

	/*
	 * A deploy. SvelteKit polls `version.json` (`version.pollInterval` in
	 * vite.config.ts) and `updated.current` turns true once a new build is out;
	 * this page's code is then old. See `$lib/nav/fresh.ts` for the rules.
	 *
	 * The next navigation to another page becomes a full load, which looks
	 * like any page change. Registered last, so the unsaved-changes guard and
	 * the offline handler have had their say on the same navigation: the
	 * guard's question shows as `prompt.ask`, offline is `navigator.onLine`.
	 */
	const fieldsNow = (): FieldState[] =>
		[...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].map(
			(f) => ({
				tag: f.tagName.toLowerCase(),
				type: f.type.toLowerCase(),
				focused: f === document.activeElement,
				value: f.value,
				defaultValue: f.defaultValue
			})
		);
	const quietNow = () => {
		const entry = entryState();
		return {
			playerOpen: (entry.videoPlayer ?? 0) > 0,
			sheetsOpen: (entry.sheets ?? 0) > 0,
			// An upload in flight counts: a reload cuts it off. So does a field
			// someone is typing in, tracked by the guard or not (signing in).
			unsaved: unsaved(null, true).length + typedFields(fieldsNow()),
			held: held()
		};
	};
	beforeNavigate((nav) => {
		const to = nav.to?.url;
		const full = fullLoadFor(
			{
				type: nav.type,
				willUnload: nav.willUnload,
				fromPath: page.url.pathname,
				toPath: to?.pathname ?? null
			},
			{
				updated: updated.current,
				asking: prompt.ask !== null,
				online: navigator.onLine,
				...quietNow()
			}
		);
		if (!full || !to) return;
		nav.cancel();
		location.href = to.href;
	});
	/*
	 * Coming back to the page is when a deploy is worth asking about. A quiet
	 * page reloads by itself; anything open, unsaved or running gets the
	 * Reload bar instead. `reloading` keeps the bar from flashing up for the
	 * moment before a reload that is going to happen.
	 */
	let reloading = $state(false);
	$effect(() => {
		let checking = false;
		const back = async () => {
			if (document.visibilityState !== 'visible' || checking) return;
			checking = true;
			const quiet = () => mayReloadNow({ routeId: page.route.id, ...quietNow() });
			reloading = quiet();
			if ((await updated.check()) && quiet()) {
				location.reload();
				return;
			}
			reloading = false;
			checking = false;
		};
		document.addEventListener('visibilitychange', back);
		return () => document.removeEventListener('visibilitychange', back);
	});
	// Not on Practice or My count (their own controls sit at the bottom; leaving
	// them loads the new version), nor over an edit's Save bar.
	const reloadBar = $derived(
		updated.current &&
			!reloading &&
			!bottom.claimed &&
			!(BUSY_ROUTES as readonly (string | null)[]).includes(page.route.id)
	);
	/** The toast's line: what keeps the page, read now and again while it shows (the DOM is not reactive). */
	let reloadReason = $state('');
	$effect(() => {
		if (!reloadBar) return;
		const read = () => (reloadReason = reloadWhy(quietNow()));
		read();
		const timer = setInterval(read, 1500);
		return () => clearInterval(timer);
	});
	/*
	 * The server refused this page: a deploy broke what it sends (the page
	 * epoch, `$lib/page-epoch.ts`; app.html's fetch wrapper fires `salsa:stale`).
	 * A navigation under way loads its page whole, a quiet page reloads, and
	 * anything else keeps the page, with what was typed, and shows the bar.
	 * Cancelling the event holds the answer back (`holdsBack`). A navigation
	 * whose data is held back stays pending until Reload (`stuck`): SvelteKit
	 * would otherwise fall back to a full load of it, unasked.
	 */
	let stale = $state(false);
	let staleLeaving = $state(false);
	$effect(() => {
		const onstale = (e: Event) => {
			const going = navigating.to?.url.href ?? null;
			const move = staleMove({
				routeId: page.route.id,
				navigating: going !== null,
				stuck,
				sending: sendingNow(),
				...quietNow()
			});
			const url = (e as CustomEvent<{ url: string }>).detail.url;
			const hold = holdsBack(move, url, location.href, going !== null);
			if (hold) e.preventDefault();
			if (move === 'bar') {
				stale = true;
				if (hold && going !== null) stuck = true;
				return;
			}
			staleLeaving = true;
			if (move === 'go' && going) loadAgreed(going);
			else location.reload();
		};
		window.addEventListener('salsa:stale', onstale);
		return () => window.removeEventListener('salsa:stale', onstale);
	});
	/*
	 * Unlike "New version", shown on every page and over a claimed bottom too:
	 * nothing a stale page sends will save, so Reload is the only way on, and a
	 * run on Practice or a Save bar would otherwise fail without a word.
	 */
	const staleBar = $derived(stale && !staleLeaving);
</script>

<svelte:head>
	<link rel="icon" href="/icon-{navDance.slug}.svg" type="image/svg+xml" />
</svelte:head>

{#if updateNeeded && data.appUpdate}
	<UpdateNeeded update={data.appUpdate} />
{:else if nav}
	<!--
		`data-dance` carries the accent (see layout.css) down to everything a
		dance touches: the page content, the tab bar (`BottomNav`, a sibling of
		the content div, inside this wrapper), the loading skeleton and the
		unsaved-changes dialog.
		`display: contents` keeps the wrapper out of layout entirely.
		`data-frame` is the desktop frame: layout.css lets its band through body and
		zeroes the side's width where there is no side.
	-->
	<div
		data-dance={navDance.slug}
		data-group={page.data.groupMode ? '' : undefined}
		data-frame={frame}
		style:display="contents"
		style:--pin-bottom={tabs ? 'var(--tab-bar-space)' : '0px'}
		style:--pin-safe={tabs ? '0px' : 'var(--safe-bottom)'}
	>
		<!-- The sheet: the phone's 560 column, or on the desktop the window past the frame. -->
		<div
			class="mx-auto min-h-dvh max-w-[560px] {tabs
				? 'pb-[calc(var(--tab-bar-h)+12px+var(--safe-bottom))] desk:pb-0'
				: ''} {SHEET[frame]}"
		>
			{@render children()}
		</div>
		{#if skeleton}
			<PageSkeleton
				{skeleton}
				{tabs}
				desk={deskSkeletonMode(ahead?.route.id, page.route.id, columnAhead, columnNow)}
				{frame}
			/>
		{/if}
		{#if frame === 'side' || frame === 'bare'}
			<!--
				The window around the sheet, in this dance's (or group's) band: behind
				everything, the sheet's ground paints over it (layout.css says why not body).
			-->
			<div
				aria-hidden="true"
				class="pointer-events-none fixed inset-0 -z-10 hidden bg-band desk:block"
				data-frame-band
			></div>
			<SheetCorner {frame} />
		{/if}
		{#if tabs}
			<BottomNav dance={navDance.slug} path={shownPath} />
		{/if}
		<!-- After the content, in the tab bar's place (desktop spec, "Keyboard and focus"). -->
		{#if frame === 'side'}
			<Side dance={navDance.slug} path={shownPath} />
		{/if}
		{#if staleBar}
			<ReloadBar stale />
		{:else if reloadBar}
			<ReloadBar why={reloadReason} />
		{/if}
		<!-- In here, not after the {#if}: its Save button takes the dance's accent too. -->
		<UnsavedDialog />
		<ClashSheet ask={clashPrompt.ask} onclose={() => (clashPrompt.ask = null)} />
	</div>
{:else}
	<!-- Signed out (sign in, Join): never the side, so no band around a sheet either. -->
	<div data-frame={frame === 'card' ? 'card' : 'none'} style:display="contents">
		{@render children()}
	</div>
	<UnsavedDialog />
	<ClashSheet ask={clashPrompt.ask} onclose={() => (clashPrompt.ask = null)} />
{/if}

{#if offline}
	<!--
		On the desktop it covers the whole window, side included: a band row across
		the top, and under it a sheet rounded at both top corners (a bare frame, so
		no side offsets the band row's title), the message centred at 560.
	-->
	<dialog
		bind:this={layer}
		data-dance={navDance.slug}
		data-frame="bare"
		aria-label="Offline"
		class="m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-0 bg-ground p-0 text-ink backdrop:bg-transparent desk:bg-band"
		oncancel={(e) => {
			e.preventDefault();
			offline = null;
		}}
	>
		<div
			class="mx-auto max-w-[560px] desk:mt-[var(--band-row-h)] desk:min-h-[calc(100dvh-var(--band-row-h))] desk:max-w-none desk:rounded-t-[28px] desk:bg-ground"
		>
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
{#if ahead}
	<NavProgress />
{/if}
