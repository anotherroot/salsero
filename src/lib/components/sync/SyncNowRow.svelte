<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import LeadTile from '$lib/components/system/LeadTile.svelte';
	import { GROUP, ROW_TALL, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import { sync } from '$lib/offline/device.svelte';
	import { pressSyncNow, syncButton } from '$lib/offline/sync-button.svelte';
	import { lastSyncedText, syncButtonWord } from '$lib/sync/view';

	/**
	 * The phone's Settings (last-synced, look A): when it last synced, Sync now,
	 * and the tip that a pull on any screen does the same. Only where this page
	 * has a device copy; the desktop has its own on the side (`SideSync`).
	 */
	const tz = $derived(
		(page.data.user as { timezone?: string } | null | undefined)?.timezone ?? 'UTC'
	);
	const phase = $derived(syncButton.phase);
</script>

{#if sync.summary}
	<div class="contents desk:hidden" data-desk-hidden data-sync-row>
		<span class="{SECTION_LABEL} mt-[14px]">{t().sync.title}</span>
		<div class={GROUP}>
			<div class="{ROW_TALL} pr-1.5">
				<LeadTile icon="refresh" />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="text-[16px] font-bold text-ink">{t().sync.title}</span>
					<span class="text-[13px] text-muted"
						>{lastSyncedText(sync.summary.lastSyncedAt, sync.now || Date.now(), tz)}</span
					>
				</span>
				<button type="button" class={button('tertiary', 'sm')} onclick={pressSyncNow}>
					{#if phase === 'syncing'}<Spinner size={18} />{:else}<Icon
							name="refresh"
							size={18}
						/>{/if}<span aria-live="polite">{syncButtonWord(phase)}</span>
				</button>
			</div>
		</div>
		<p class="px-4 pt-0.5 text-[13px] text-muted">{t().sync.button.tip}</p>
	</div>
{/if}
