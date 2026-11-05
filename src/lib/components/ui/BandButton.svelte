<script lang="ts">
	import Icon from './Icon.svelte';
	import { bandButton, type BandTone } from './styles';
	import { inPane } from '$lib/components/shell/pane-context';
	import type { IconName } from '$lib/icons/icons';

	let {
		icon,
		label,
		href,
		onclick,
		focusKey,
		tone
	}: {
		icon: IconName;
		label: string;
		href?: string;
		onclick?: (e: MouseEvent) => void;
		focusKey?: string;
		/** Default: `pane` inside a list's item pane (its header's actions), else `band`. */
		tone?: BandTone;
	} = $props();

	// A bare cream icon on the band; the 44 px square is the hit area. In a pane on
	// the desktop, a tonal icon button on the ground (`bandButton`).
	const pane = inPane();
	const cls = $derived(bandButton(tone ?? (pane ? 'pane' : 'band')));
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the caller passes a built href -->
	<a data-focus={focusKey} {href} aria-label={label} class={cls} {onclick}><Icon name={icon} /></a>
{:else}
	<button type="button" data-focus={focusKey} aria-label={label} class={cls} {onclick}
		><Icon name={icon} /></button
	>
{/if}
