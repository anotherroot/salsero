<script lang="ts">
	import { deserialize } from '$app/forms';
	import Dialog from '$lib/components/ui/Dialog.svelte';
	import { button } from '$lib/components/ui/styles';
	import { clashView, fieldLabel, type Seen } from '$lib/clash/clash';
	import { t } from '$lib/i18n/catalog';
	import { clashPrompt } from '$lib/unsaved/guard.svelte';
	import { discardEntry, retryEntry } from '$lib/offline/device.svelte';
	import type { OutboxItem } from '$lib/offline/protocol';
	import { resendFields } from '$lib/sync/resolve';
	import { discardQuestion, labelText, reasonText } from '$lib/sync/view';

	/**
	 * One change on the Sync page (offline phase 3, look 2B): what it was, why it
	 * did not land, what was typed, and what the person can do. A refused change
	 * has Retry (Compare for a clash) and Discard, which asks; one waiting on it
	 * says so and has nothing of its own.
	 */
	let {
		item,
		tz,
		held = false,
		onchange,
		onmessage
	}: {
		item: OutboxItem;
		tz: string;
		/** Waits on the refused change drawn above it. */
		held?: boolean;
		/** The outbox changed: the page reads it again (and moves focus). */
		onchange: (gone: string | null) => void;
		/** A refusal to show on the page's toast. */
		onmessage: (message: string) => void;
	} = $props();

	let asking = $state(false);
	let busy = $state(false);
	const refused = $derived(item.state === 'refused');
	const sent = $derived(Object.fromEntries(item.fields) as Seen);
	/** `seen` never travels in the listed fields (`bodyFields` drops it): the clash view compares with theirs alone. */
	const seen: Seen | null = null;

	async function retry() {
		busy = true;
		await retryEntry(item.id);
		busy = false;
		onchange(null);
	}

	async function discard() {
		asking = false;
		busy = true;
		await discardEntry(item.id);
		busy = false;
		onchange(item.id);
	}

	/** The clash screen, as for a save online: mine sends again over theirs, theirs drops mine. */
	function compare() {
		const clash = item.clash;
		if (!clash) return;
		clashPrompt.ask = {
			kind: 'clash',
			by: clash.by,
			at: clash.at,
			view: clashView(clash, sent, seen, () => 'text'),
			typed: [],
			mine: (values) => void sendMine(values),
			theirs: () => void discard()
		};
	}

	async function sendMine(values: Record<string, string>) {
		const clash = item.clash;
		if (!clash) return;
		const body = new FormData();
		for (const [k, v] of resendFields(item.fields, values, clash.current)) body.append(k, v);
		try {
			const res = await fetch(item.url, {
				method: 'POST',
				body,
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await res.text());
			if (result.type === 'success' || result.type === 'redirect') return discard();
			const message =
				result.type === 'failure'
					? (result.data as { message?: string } | undefined)?.message
					: undefined;
			onmessage(message ?? t().sync.reason.error);
		} catch {
			onmessage(t().common.unreachable);
		}
	}
</script>

<li class="flex flex-col gap-2 px-4 py-3" class:pl-10={held} data-focus="sync-{item.id}">
	<span class="text-[16px] leading-[1.3] font-bold text-ink"
		>{labelText(item.label, item.madeAt, tz)}</span
	>
	{#if item.state === 'refused' || item.state === 'held'}
		<span class="text-[14px] {refused ? 'text-danger' : 'text-muted'}">{reasonText(item)}</span>
	{/if}
	{#each item.fields.filter(([k]) => k !== 'seen') as [key, value] (key)}
		{#if value.trim()}
			<span class="line-clamp-2 text-[14px] text-muted">{fieldLabel(key)}: {value}</span>
		{/if}
	{/each}
	{#if refused}
		<span class="flex flex-wrap gap-2 pt-1">
			{#if item.reason === 'clash' && item.clash}
				<button type="button" class={button('secondary', 'sm')} disabled={busy} onclick={compare}
					>{t().sync.compare}</button
				>
			{:else}
				<button type="button" class={button('secondary', 'sm')} disabled={busy} onclick={retry}
					>{t().sync.retry}</button
				>
			{/if}
			<button
				type="button"
				class={button('danger-text', 'sm')}
				disabled={busy}
				onclick={() => (asking = true)}>{t().sync.discard}</button
			>
		</span>
	{/if}
</li>

<Dialog
	open={asking}
	tone="danger"
	icon="trash"
	title={discardQuestion(item.dependents).title}
	body={discardQuestion(item.dependents).body}
	onclose={() => (asking = false)}
>
	{#snippet actions()}
		<button type="button" class={button('danger', 'md', true)} onclick={discard}
			>{t().sync.discard}</button
		>
		<button type="button" class={button('secondary', 'md', true)} onclick={() => (asking = false)}
			>{t().common.cancel}</button
		>
	{/snippet}
</Dialog>
