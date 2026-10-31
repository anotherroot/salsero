<script lang="ts">
	import type { Snippet } from 'svelte';
	import { bandMode } from '$lib/nav/band';

	let {
		title,
		subtitle,
		compact = false,
		left,
		right,
		extra,
		hero,
		children
	}: {
		title: string;
		subtitle?: string;
		compact?: boolean;
		left?: Snippet;
		right?: Snippet;
		extra?: Snippet;
		hero?: Snippet;
		children: Snippet;
	} = $props();

	let scrollY = $state(0);
	const mode = $derived(bandMode(scrollY, compact));
	const slim = $derived(mode === 'slim');
</script>

<svelte:window bind:scrollY />

<!-- The slim band: fixed, fades in once the big one has scrolled away. -->
<div
	data-slim-band
	class="fixed inset-x-0 top-0 z-30 bg-band px-[10px] transition-opacity duration-150 motion-reduce:transition-none"
	class:opacity-0={!slim}
	class:pointer-events-none={!slim}
	aria-hidden={slim ? undefined : 'true'}
	inert={!slim}
	style="padding-top: env(safe-area-inset-top); height: calc(4rem + env(safe-area-inset-top)); --focus-ring: var(--color-band-ink)"
>
	<!-- The same 560 px column as the page, inside the full-width bar. -->
	<div class="mx-auto flex h-16 max-w-[560px] items-center gap-1">
		{#if left}{@render left()}{/if}
		{#if compact && subtitle}
			<!-- A compact screen's subtitle (a figure's variation) stays in the slim band. -->
			<span class="flex min-w-0 flex-1 flex-col gap-px">
				<span
					class="truncate font-display text-[22px] leading-tight font-extrabold tracking-[-0.005em] text-band-ink"
					>{title}</span
				>
				<span class="truncate text-[12px] leading-[1.3] font-semibold text-band-small"
					>{subtitle}</span
				>
			</span>
		{:else}
			<span
				class="min-w-0 flex-1 truncate font-display text-[22px] leading-tight font-extrabold tracking-[-0.005em] text-band-ink"
				>{title}</span
			>
		{/if}
		{#if right}<div class="flex items-center">{@render right()}</div>{/if}
	</div>
</div>

<!-- The big header is inert while the slim band shows: only one Back may take focus. -->
<header
	class="flex flex-col gap-[6px] bg-band px-5"
	inert={slim}
	style="--focus-ring: var(--color-band-ink); padding-top: calc({compact
		? 22
		: 30}px + env(safe-area-inset-top)); padding-bottom: {hero ? 92 : extra ? 50 : 52}px"
>
	<div class="flex items-center justify-between gap-3">
		<div class="flex min-w-0 flex-1 items-center gap-1" class:-ml-[10px]={!!left}>
			{#if left}{@render left()}{/if}
			<h1
				class="line-clamp-2 min-w-0 font-display font-extrabold break-words text-band-ink {compact
					? 'text-[30px] leading-[1.1] tracking-[-0.015em]'
					: 'text-[46px] leading-[1.05] tracking-[-0.02em]'}"
			>
				{title}
			</h1>
		</div>
		{#if right}<div class="-mr-[10px] flex items-center">{@render right()}</div>{/if}
	</div>
	{#if subtitle}
		<span class="text-[15px] font-semibold text-band-small" class:pl-[38px]={!!left}
			>{subtitle}</span
		>
	{/if}
	{#if extra}<div class="mt-4">{@render extra()}</div>{/if}
</header>

<div
	class="relative -mt-7 flex min-h-[60vh] flex-col gap-2 rounded-t-[28px] bg-ground pb-6"
	class:pt-5={!hero}
	style="padding-inline: 16px"
>
	{#if hero}<div class="-mt-[42px] mb-[10px]">{@render hero()}</div>{/if}
	{@render children()}
</div>
