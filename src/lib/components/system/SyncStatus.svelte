<script lang="ts">
	import { page } from '$app/state';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { sync } from '$lib/offline/device.svelte';
	import { syncStatus } from '$lib/sync/status';
	import { statusText } from '$lib/sync/view';

	/**
	 * The band's subtitle with the sync status (offline phase 3, look 1D):
	 * nothing extra while all is synced; "· 3 waiting" after the subtitle once
	 * changes have waited the grace; "1 couldn't sync ›" or "Sign in to sync ›"
	 * as a pill in its place. Both lead to the Sync page.
	 */
	let { subtitle }: { subtitle?: string } = $props();

	const status = $derived(syncStatus(sync.summary, sync.now));
	const words = $derived(statusText(status));
	/** The Sync page lives under a dance; a shared page (Settings) takes the person's. */
	const dance = $derived(
		page.params.dance ?? (page.data.user as { dance?: string } | null | undefined)?.dance ?? null
	);
	const href = $derived(dance ? `/${dance}/sync` : null);
	/** Between the subtitle and the status: the band's own separator, kept with its spaces. */
	const SEP = ' · ';
</script>

{#if (status.kind === 'refused' || status.kind === 'signin') && words}
	{#if href}
		<a {href} class="inline-flex align-middle no-underline focus-visible:outline-2">
			<Badge tone="danger" solid>{words} ›</Badge>
		</a>
	{:else}
		<Badge tone="danger" solid>{words}</Badge>
	{/if}
{:else}
	{subtitle ?? ''}{#if status.kind === 'waiting' && words}{#if subtitle}{SEP}{/if}{#if href}<a
				{href}
				class="text-band-small underline-offset-2 hover:underline">{words}</a
			>{:else}{words}{/if}{/if}
{/if}
