<script lang="ts">
	import InviteQr from '$lib/components/admin/InviteQr.svelte';
	import CardFrame from '$lib/components/shell/CardFrame.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const w = $derived(t().shell.getApp);
</script>

<svelte:head><title>{w.title}</title></svelte:head>

<CardFrame title={w.title}>
	<p class="text-[16px] text-ink-2">{w.intro}</p>

	{#if data.device === 'other'}
		<div class="{GROUP} flex flex-col items-center gap-3 p-4">
			<p class="text-[16px] font-bold text-ink">{w.openOnPhone}</p>
			{#if data.qr}<InviteQr size={data.qr.size} cells={data.qr.cells} label={w.qr} />{/if}
		</div>
	{:else}
		{#each data.cards as card (card.dance)}
			<div class="{GROUP} flex flex-col gap-2 p-4">
				<span class="text-[17px] font-bold text-ink">{card.label}</span>
				{#if data.device === 'android'}
					{#if card.download}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a file download -->
						<a href={card.download.url} download class={button('primary', 'md', true)}>
							{w.download(card.label, card.download.size)}
						</a>
					{:else}
						<p class="text-[14px] text-muted">{w.notReady}</p>
					{/if}
				{:else}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a flat route per dance -->
					<a href={card.open} class={button('primary', 'md', true)}>{w.open(card.label)}</a>
				{/if}
			</div>
		{/each}

		{#if data.device === 'android'}
			<ol class="flex flex-col gap-2 text-[15px] text-ink-2">
				{#each w.androidSteps as step (step)}<li>{step}</li>{/each}
			</ol>
			<svg
				viewBox="0 0 220 120"
				role="img"
				aria-label={w.sketch}
				class="w-full max-w-56 text-muted"
			>
				<rect
					x="10"
					y="8"
					width="200"
					height="104"
					rx="12"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				/>
				<rect x="24" y="26" width="110" height="8" rx="4" fill="currentColor" opacity="0.5" />
				<rect x="24" y="44" width="80" height="6" rx="3" fill="currentColor" opacity="0.3" />
				<rect x="150" y="60" width="44" height="24" rx="12" fill="currentColor" />
				<circle cx="182" cy="72" r="9" class="fill-surface" />
				<rect x="24" y="92" width="50" height="8" rx="4" fill="currentColor" opacity="0.3" />
			</svg>
		{:else}
			<p class="text-[15px] text-ink-2">{w.ios}</p>
			<p class="text-[13px] text-muted">
				{w.iosNote}
			</p>
		{/if}
	{/if}

	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the dance chooser -->
	<a href="/" class={button('tertiary', 'md')}>{w.skip}</a>
</CardFrame>
