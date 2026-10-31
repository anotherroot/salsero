<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	let {
		title,
		meta,
		icon = 'play',
		href,
		onclick
	}: {
		title: string;
		meta?: string;
		icon?: IconName;
		href?: string;
		onclick?: () => void;
	} = $props();

	// A plain card; Screen's hero slot does the straddling.
	const cls =
		'flex min-h-[84px] w-full flex-none items-center gap-[14px] rounded-[22px] bg-surface py-[14px] pr-[14px] pl-5 text-left text-ink shadow-[0_4px_16px_rgb(0_0_0/0.12)]';
</script>

{#snippet body()}
	<span class="flex min-w-0 flex-1 flex-col gap-[3px]">
		<span class="font-display text-[25px] leading-[1.1] font-extrabold tracking-[-0.01em]"
			>{title}</span
		>
		{#if meta}<span class="text-[13px] font-semibold text-muted">{meta}</span>{/if}
	</span>
	<!-- Filled icons cut their details out in the button's own colour. -->
	<span
		class="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-accent text-on-accent"
		style="--icon-knockout: var(--color-accent)"
	>
		<span style:margin-left={icon === 'play' ? '3px' : undefined} class="flex">
			<Icon name={icon} filled />
		</span>
	</span>
{/snippet}

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a built href -->
	<a {href} class={cls} {onclick}>{@render body()}</a>
{:else}
	<button type="button" class={cls} {onclick}>{@render body()}</button>
{/if}
