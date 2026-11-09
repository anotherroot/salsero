<script lang="ts">
	import { page } from '$app/state';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { sync } from '$lib/offline/device.svelte';
	import { bandStatus } from '$lib/sync/status';
	import { statusText } from '$lib/sync/view';

	/**
	 * The band's subtitle with the sync status (offline phase 3): "1 couldn't
	 * sync ›" or "Sign in to sync ›" as a pill in its place, leading to the Sync
	 * page; otherwise the subtitle as it is. What waits is the offline strip's
	 * (look C2), not the band's.
	 */
	let { subtitle }: { subtitle?: string } = $props();

	const status = $derived(bandStatus(sync.summary, sync.now));
	const words = $derived(statusText(status));
	/** The Sync page lives under a dance; a shared page (Settings) takes the person's. */
	const dance = $derived(
		page.params.dance ?? (page.data.user as { dance?: string } | null | undefined)?.dance ?? null
	);
	const href = $derived(dance ? `/${dance}/sync` : null);
</script>

{#if words}
	{#if href}
		<a {href} class="inline-flex align-middle no-underline focus-visible:outline-2">
			<Badge tone="danger" solid>{words} ›</Badge>
		</a>
	{:else}
		<Badge tone="danger" solid>{words}</Badge>
	{/if}
{:else}
	{subtitle ?? ''}
{/if}
