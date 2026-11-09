<script lang="ts">
	import { page } from '$app/state';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import SyncEntry from '$lib/components/sync/SyncEntry.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { focusAfterRemoval } from '$lib/focus';
	import { t } from '$lib/i18n/catalog';
	import { outboxList, sync, syncNow } from '$lib/offline/device.svelte';
	import type { OutboxItem } from '$lib/offline/protocol';
	import { lastSyncedText } from '$lib/sync/view';

	/**
	 * The Sync page (offline phase 3, look 2B): what couldn't sync first, each
	 * followed by what waits on it, then what waits to go up, then when it last
	 * synced and Try now. Reached from the band's status; it loads nothing from
	 * the server: it reads the device's outbox.
	 */
	const dance = $derived(page.params.dance ?? '');
	const tz = $derived(
		(page.data.user as { timezone?: string } | null | undefined)?.timezone ?? 'UTC'
	);

	let items = $state<OutboxItem[]>([]);
	let syncing = $state(false);
	let toast = $state<{ id: number; message: string } | null>(null);
	let toastSeq = 0;

	async function load(): Promise<void> {
		items = await outboxList();
	}

	$effect(() => {
		// Read again whenever the outbox changes.
		void sync.summary;
		void load();
	});

	const refused = $derived(items.filter((i) => i.state === 'refused'));
	const heldOn = (id: string) => items.filter((i) => i.state === 'held' && i.heldBy === id);
	const waiting = $derived(
		items
			.filter((i) => i.state === 'waiting' || i.state === 'sending')
			.toSorted((a, b) => a.madeAt - b.madeAt)
	);
	const keys = $derived([...refused, ...waiting].map((i) => `sync-${i.id}`));

	async function tryNow(): Promise<void> {
		syncing = true;
		await syncNow();
		syncing = false;
		await load();
	}

	async function changed(gone: string | null): Promise<void> {
		const before = keys;
		await load();
		if (gone) await focusAfterRemoval(before, `sync-${gone}`, 'sync-try-now');
	}
</script>

<Screen title={t().sync.title} compact>
	<div class="flex flex-col gap-5 px-4 pt-2 pb-8">
		{#if sync.summary?.signedOut}
			<Banner kind="warning" title={t().sync.status.signIn}>
				{#snippet action()}
					<a
						class={button('secondary', 'sm')}
						href="/login?next={encodeURIComponent(`/${dance}/sync`)}">{t().sync.signIn}</a
					>
				{/snippet}
			</Banner>
		{/if}

		{#if refused.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class={SECTION_LABEL}>{t().sync.refusedHeading}</h2>
				<ul class={GROUP}>
					{#each refused as item (item.id)}
						<SyncEntry
							{item}
							{tz}
							onchange={changed}
							onmessage={(m) => (toast = { id: ++toastSeq, message: m })}
						/>
						{#each heldOn(item.id) as dep (dep.id)}
							<SyncEntry
								item={dep}
								{tz}
								held
								onchange={changed}
								onmessage={(m) => (toast = { id: ++toastSeq, message: m })}
							/>
						{/each}
					{/each}
				</ul>
			</section>
		{/if}

		{#if waiting.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class={SECTION_LABEL}>{t().sync.waitingHeading}</h2>
				<ul class={GROUP}>
					{#each waiting as item (item.id)}
						<SyncEntry
							{item}
							{tz}
							onchange={changed}
							onmessage={(m) => (toast = { id: ++toastSeq, message: m })}
						/>
					{/each}
				</ul>
			</section>
		{/if}

		{#if refused.length === 0 && waiting.length === 0}
			<p class="px-4 text-[16px] font-semibold text-ink">{t().sync.allSynced}</p>
		{/if}

		<p class="flex flex-wrap items-center gap-2 px-4 text-[14px] text-muted">
			<span>{lastSyncedText(sync.summary?.lastSyncedAt ?? null, sync.now || Date.now(), tz)}</span>
			<span aria-hidden="true">·</span>
			<button
				type="button"
				class={button('tertiary', 'sm')}
				data-focus="sync-try-now"
				disabled={syncing}
				onclick={tryNow}
				>{#if syncing}<Spinner size={16} />{/if}{t().sync.tryNow}</button
			>
		</p>
	</div>
</Screen>

{#if toast}
	<Toast {toast} ondismiss={() => (toast = null)} />
{/if}
