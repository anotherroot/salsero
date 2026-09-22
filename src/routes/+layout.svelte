<script lang="ts">
	import './layout.css';
	import { page } from '$app/state';
	import BottomNav from '$lib/components/shell/BottomNav.svelte';

	let { data, children } = $props();
	const nav = $derived(Boolean(data.user) && page.url.pathname !== '/login');
</script>

{#if nav}
	<div class="mx-auto min-h-dvh max-w-[560px] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
		{@render children()}
	</div>
	<BottomNav />
{:else}
	{@render children()}
{/if}
