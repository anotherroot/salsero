<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<pre>{JSON.stringify(data.groups.length)}</pre>
