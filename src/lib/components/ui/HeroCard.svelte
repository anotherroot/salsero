<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	let {
		title,
		meta,
		icon = 'play',
		href,
		onclick,
		state = 'default'
	}: {
		title: string;
		meta?: string;
		icon?: IconName;
		href?: string;
		onclick?: () => void;
		/** disabled: a button that cannot be pressed; done: a status card, not a control. */
		state?: 'default' | 'disabled' | 'done';
	} = $props();

	// A plain card; Screen's hero slot does the straddling.
	const cls =
		'flex min-h-[84px] w-full flex-none items-center gap-[14px] rounded-[22px] bg-surface py-[14px] pr-[14px] pl-5 text-left shadow-[0_4px_16px_rgb(0_0_0/0.12)]';
</script>

{#snippet text(muted: boolean)}
	<span class="flex min-w-0 flex-1 flex-col gap-[3px]">
		<span
			class="font-display text-[25px] leading-[1.1] font-extrabold tracking-[-0.01em] {muted
				? 'text-muted'
				: 'text-ink'}">{title}</span
		>
		{#if meta}<span class="text-[14px] font-semibold text-muted">{meta}</span>{/if}
	</span>
{/snippet}

{#snippet disc(
	tone: string,
	knockout: string | undefined,
	nudge: boolean,
	glyph: IconName,
	size: number,
	filled: boolean
)}
	<!-- Filled icons cut their details out in the disc's own colour. -->
	<span
		class="flex h-[54px] w-[54px] flex-none items-center justify-center rounded-full {tone}"
		style:--icon-knockout={knockout}
	>
		<span style:margin-left={nudge ? '3px' : undefined} class="flex">
			<Icon name={glyph} {size} {filled} />
		</span>
	</span>
{/snippet}

{#if state === 'done'}
	<div role="status" class={cls}>
		{@render text(false)}
		{@render disc('bg-done-soft text-done', undefined, false, 'check', 28, false)}
	</div>
{:else if state === 'disabled'}
	<button type="button" class={cls} disabled>
		{@render text(true)}
		{@render disc(
			'bg-disabled-bg text-disabled-ink',
			'var(--color-disabled-bg)',
			icon === 'play',
			icon,
			24,
			true
		)}
	</button>
{:else}
	{#snippet active()}
		{@render text(false)}
		{@render disc(
			'bg-accent text-on-accent',
			'var(--color-accent)',
			icon === 'play',
			icon,
			24,
			true
		)}
	{/snippet}
	{#if href}
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a built href -->
		<a {href} class="{cls} text-ink" {onclick}>{@render active()}</a>
	{:else}
		<button type="button" class="{cls} text-ink" {onclick}>{@render active()}</button>
	{/if}
{/if}
