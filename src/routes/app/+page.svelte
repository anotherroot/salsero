<script lang="ts">
	import InviteQr from '$lib/components/admin/InviteQr.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Get the app</title></svelte:head>

<Screen title="Get the app">
	<p class="text-[16px] text-ink-2">Practise from your phone's home screen.</p>

	{#if data.device === 'other'}
		<div class="{GROUP} flex flex-col items-center gap-3 p-4">
			<p class="text-[16px] font-bold text-ink">Open this page on your phone.</p>
			{#if data.qr}<InviteQr
					size={data.qr.size}
					cells={data.qr.cells}
					label="QR code for this page"
				/>{/if}
		</div>
	{:else}
		{#each data.cards as card (card.dance)}
			<div class="{GROUP} flex flex-col gap-2 p-4">
				<span class="text-[17px] font-bold text-ink">{card.label}</span>
				{#if data.device === 'android'}
					{#if card.download}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a file download -->
						<a href={card.download.url} download class={button('primary', 'md', true)}>
							Download {card.label} · {card.download.size}
						</a>
					{:else}
						<p class="text-[14px] text-muted">The Android app isn't ready yet.</p>
					{/if}
				{:else}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- a flat route per dance -->
					<a href={card.open} class={button('primary', 'md', true)}>Open {card.label}</a>
				{/if}
			</div>
		{/each}

		{#if data.device === 'android'}
			<ol class="flex flex-col gap-2 text-[15px] text-ink-2">
				<li>1. Your browser asks to allow installing apps from it: allow it, then tap Install.</li>
				<li>2. If Play Protect says it doesn't know the app, tap Install anyway.</li>
				<li>3. Open the app and sign in with the account you just made.</li>
			</ol>
			<svg
				viewBox="0 0 220 120"
				role="img"
				aria-label="Sketch of the allow screen: a switch turned on"
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
				<circle cx="182" cy="72" r="9" fill="Canvas" />
				<rect x="24" y="92" width="50" height="8" rx="4" fill="currentColor" opacity="0.3" />
			</svg>
		{:else}
			<p class="text-[15px] text-ink-2">In Safari, tap Share, then Add to Home Screen.</p>
			<p class="text-[13px] text-muted">
				On iPhone, lesson videos upload only while the page is open, and there is no daily reminder.
			</p>
		{/if}
	{/if}

	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the dance chooser -->
	<a href="/" class={button('tertiary', 'md')}> Skip, use it in the browser </a>
</Screen>
