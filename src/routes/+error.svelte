<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { danceInPath } from '$lib/dances/dances';
	import ErrorScreen from '$lib/components/system/ErrorScreen.svelte';
	import { errorBack, errorView } from '$lib/nav/error-view';

	const dance = $derived(danceInPath(page.url.pathname) ?? page.data.lastDance ?? 'salsa');
</script>

<div data-dance={dance} style:display="contents">
	<ErrorScreen
		view={errorView(page.status, page.error?.message, browser && !navigator.onLine)}
		back={errorBack(page.url.pathname, dance)}
		todayHref={`/${dance}`}
		/* eslint-disable-next-line svelte/no-navigation-without-resolve -- the current URL */
		onretry={() => goto(page.url, { invalidateAll: true, replaceState: true })}
	/>
</div>
