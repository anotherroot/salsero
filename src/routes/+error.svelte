<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { danceInPath } from '$lib/dances/dances';
	import ErrorScreen from '$lib/components/system/ErrorScreen.svelte';
	import { errorBack, errorView } from '$lib/nav/error-view';
	import { levelShown } from '$lib/levels/levels';
	import { frameOfError } from '$lib/nav/frame';

	const dance = $derived(danceInPath(page.url.pathname) ?? page.data.appDance ?? 'salsa');
	// The root layout draws the same frame around it (`frameOfError` there too).
	const card = $derived(frameOfError(page.url.pathname, Boolean(page.data.user)) === 'card');

	// eslint-disable-next-line svelte/no-navigation-without-resolve -- the current URL
	const retry = () => goto(page.url, { invalidateAll: true, replaceState: true });
</script>

<div data-dance={dance} style:display="contents">
	<ErrorScreen
		view={errorView(page.status, page.error?.message, browser && !navigator.onLine)}
		back={errorBack(page.url.pathname, dance, levelShown(page.data.user?.level))}
		todayHref={`/${dance}`}
		{card}
		onretry={retry}
	/>
</div>
