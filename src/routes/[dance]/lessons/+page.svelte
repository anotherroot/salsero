<script lang="ts">
	let { data } = $props();
</script>

<!-- The list and the empty pane are the layout's (ListPane); this page is only the title. -->
<svelte:head><title>Lessons · {data.dance.label}</title></svelte:head>
