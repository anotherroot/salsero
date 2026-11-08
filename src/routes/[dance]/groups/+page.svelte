<script lang="ts">
	import { desk } from '$lib/nav/desk.svelte';
	import { t } from '$lib/i18n/catalog';
	import { MY_CLASS } from '$lib/teams/view';

	let { data } = $props();
	// At Follow my class the tab is My class (the layout's `myClass`); above it the
	// phone's tab is You, the desktop's Groups.
	const title = $derived(
		data.myClass ? MY_CLASS.title : desk.current ? t().shell.tabs.groups : t().shell.tabs.you
	);
</script>

<!-- The list, the empty pane and New group are the layout's (ListPane); this page is only the title. -->
<svelte:head><title>{title} · {data.dance.label}</title></svelte:head>
