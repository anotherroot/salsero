<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { t } from '$lib/i18n/catalog';
	import { sync } from '$lib/offline/device.svelte';
	import { pressSyncNow, syncButton } from '$lib/offline/sync-button.svelte';
	import { lastSyncedWhen, syncButtonWord } from '$lib/sync/view';

	/**
	 * The desktop's side, above Settings (last-synced, look E): "Last synced" and
	 * the time, and a round button that syncs. The desktop has no pull, so this
	 * is where it syncs by hand. Only where this page has a device copy.
	 */
	const tz = $derived(
		(page.data.user as { timezone?: string } | null | undefined)?.timezone ?? 'UTC'
	);
	const phase = $derived(syncButton.phase);
	const time = $derived(
		sync.summary ? lastSyncedWhen(sync.summary.lastSyncedAt, sync.now || Date.now(), tz) : null
	);
	const head = $derived(
		phase !== 'idle' ? syncButtonWord(phase) : time === null ? t().sync.never : t().sync.button.last
	);
</script>

{#if sync.summary}
	<div class="flex items-center justify-between gap-1.5 pr-1 pl-[14px]" data-side-sync>
		<span
			class="flex min-w-0 flex-col text-[13px] leading-tight font-semibold text-band-small"
			aria-live="polite"
		>
			<span class="opacity-75">{head}</span>
			{#if time !== null}<span>{time}</span>{/if}
		</span>
		<button
			type="button"
			class="grid size-10 flex-none cursor-pointer place-items-center rounded-full bg-band-ink/15 text-band-small hover:bg-band-ink/25"
			aria-label={t().sync.button.now}
			title={t().sync.button.now}
			onclick={pressSyncNow}
		>
			{#if phase === 'syncing'}<Spinner size={18} />{:else}<Icon name="refresh" size={20} />{/if}
		</button>
	</div>
	<div class="mx-[14px] my-1.5 h-px bg-band-ink/20" aria-hidden="true"></div>
{/if}
