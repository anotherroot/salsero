<script lang="ts">
	let { data } = $props();
</script>

<!-- The list, the empty pane and New group are the layout's (ListPane); this page is only the title. -->
<svelte:head><title>Groups · {data.dance.label}</title></svelte:head>
