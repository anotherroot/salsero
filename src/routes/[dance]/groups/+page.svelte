<script lang="ts">
	import { MY_CLASS } from '$lib/teams/view';

	let { data } = $props();
	// At Follow my class the tab is My class (the layout's `myClass`).
	const title = $derived(data.myClass ? MY_CLASS.title : 'Groups');
</script>

<!-- The list, the empty pane and New group are the layout's (ListPane); this page is only the title. -->
<svelte:head><title>{title} · {data.dance.label}</title></svelte:head>
