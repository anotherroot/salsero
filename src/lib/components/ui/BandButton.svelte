<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	let {
		icon,
		label,
		href,
		onclick,
		focusKey
	}: {
		icon: IconName;
		label: string;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		focusKey?: string;
	} = $props();

	// A bare cream icon on the band; the 44 px square is the hit area.
	const cls =
		'flex h-11 w-11 flex-none items-center justify-center rounded-full text-band-ink active:bg-band-ink/15';
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a built href -->
	<a data-focus={focusKey} {href} aria-label={label} class={cls} {onclick}><Icon name={icon} /></a>
{:else}
	<button type="button" data-focus={focusKey} aria-label={label} class={cls} {onclick}
		><Icon name={icon} /></button
	>
{/if}
