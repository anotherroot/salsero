<script lang="ts">
	import Badge from '$lib/components/ui/Badge.svelte';
	import { sync } from '$lib/offline/device.svelte';
	import { waitingMark } from '$lib/sync/status';
	import { t } from '$lib/i18n/catalog';

	/**
	 * "Waiting" on a thing whose change is still on its way to the server
	 * (offline phase 3, look 3B): a comment, a heart, a song added by link, a
	 * lesson published offline, a YouTube save. Drawn as Draft is, and only after
	 * the grace, so a change that goes up at once never shows it.
	 */
	let { table, id }: { table: string; id: string | number } = $props();
	const shows = $derived(waitingMark(sync.summary, table, id, sync.now));
</script>

{#if shows}<Badge tone="warn">{t().sync.waitingBadge}</Badge>{/if}
