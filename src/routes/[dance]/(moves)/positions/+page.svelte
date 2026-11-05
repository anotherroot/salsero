<script lang="ts">
	import type { PageData } from './$types';

	/*
	 * Positions with nothing open. The list, its band and its sheets are the
	 * (moves) layout's (`ListPane`, `PositionsList`); the pane beside it is empty
	 * until the map takes it (plan 3, Task 7). The phone draws none of it.
	 */
	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Positions · {data.dance.label}</title></svelte:head>
