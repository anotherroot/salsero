<script lang="ts">
	import { t } from '$lib/i18n/catalog';

	let { data } = $props();
	const title = $derived(t().shell.tabs.lessons);
</script>

<!-- The list and the empty pane are the layout's (ListPane); this page is only the title. -->
<svelte:head><title>{title} · {data.dance.label}</title></svelte:head>
