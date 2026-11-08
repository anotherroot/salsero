<script lang="ts">
	import { page } from '$app/state';
	import Screen from '$lib/components/ui/Screen.svelte';
	import YouSettings from '$lib/components/settings/YouSettings.svelte';
	import { fullName } from '$lib/names';

	let { data } = $props();
	const user = $derived(page.data.user);
</script>

<svelte:head><title>You · {data.dance.label}</title></svelte:head>

<Screen title="You" subtitle={user ? fullName(user) : undefined} width="narrow">
	<YouSettings
		settings={data.you}
		theme={page.data.theme}
		from="/{data.dance.slug}/you"
		heading={false}
	/>
</Screen>
