<script lang="ts">
	import { onMount } from 'svelte';
	import { button } from '$lib/components/ui/styles';
	import { parseBridge, updateView, type AppUpdate, type BridgeStatus } from '$lib/app-update/view';

	interface Bridge {
		postMessage(message: string): void;
		onmessage: ((event: { data: string }) => void) | null;
	}

	let { update }: { update: AppUpdate } = $props();

	let status = $state<BridgeStatus>('idle');
	let bridge = $state<Bridge | null>(null);
	const view = $derived(updateView(status));

	onMount(() => {
		const b = (window as unknown as { salsaUpdate?: Bridge }).salsaUpdate ?? null;
		bridge = b;
		if (!b) return;
		const handler = (event: { data: string }) => {
			const next = parseBridge(String(event.data));
			if (next) status = next;
		};
		b.onmessage = handler;
		return () => {
			// A button mounted since (the next page's) may own it by now.
			if (b.onmessage === handler) b.onmessage = null;
		};
	});

	// A busy phone (an upload in flight) asks again until it can start.
	$effect(() => {
		if (!bridge || status !== 'busy') return;
		const b = bridge;
		const timer = setInterval(() => b.postMessage('start'), 30_000);
		return () => clearInterval(timer);
	});

	const start = () => bridge?.postMessage('start');
	const link = $derived(
		update.channel === 'play'
			? {
					// https, not market://: the app's WebView only lets http(s) leave (Pages.kt),
					// and Android hands this link to the Play Store app.
					href: `https://play.google.com/store/apps/details?id=eu.anotherroot.${update.dance}`,
					label: 'Update from Google Play'
				}
			: update.latest
				? { href: update.latest.url, label: 'Update' }
				: null
	);
</script>

<span class="flex flex-col items-start gap-1">
	{#if bridge && update.channel !== 'play'}
		<button
			type="button"
			class={button('primary')}
			disabled={view.working}
			aria-busy={view.working}
			onclick={start}>{view.label}</button
		>
		{#if view.line}<span class="px-2.5 text-[13px] font-semibold text-ink-2" role="status"
				>{view.line}</span
			>{/if}
	{:else if link}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a file, or the Play store -->
		<a href={link.href} class={button('primary')}>{link.label}</a>
	{/if}
</span>
