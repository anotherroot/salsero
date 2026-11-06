<script lang="ts">
	import MenuSheet from '$lib/components/ui/MenuSheet.svelte';
	import DropSheet from './DropSheet.svelte';
	import DetachSheet from './DetachSheet.svelte';
	import CopyToSheet from './CopyToSheet.svelte';
	import MoveToSheet from './MoveToSheet.svelte';
	import SameAsSheet from './SameAsSheet.svelte';
	import { copied } from './copied.svelte';
	import { cloneMenuItems, type CloneOffers, type CloneSheet } from '$lib/clones/menu';
	import { orderMenu, type MenuItem } from '$lib/menu';
	import type { CloneKind } from '$lib/types';

	/**
	 * A family page's ⋯ menu (spec 2026-11-06): the page's own items (`own`),
	 * then Copy to…, Same as…, Move to…, Detach and Drop my copy, each when its
	 * offer is set, and the sheets they open. Mount it once in the page's body,
	 * never in the band (the band is drawn twice); the band's ⋯ is the page's
	 * own `BandButton`, shown when `hasMenu(own, offers)`, setting `open`.
	 */
	let {
		title,
		kind,
		current,
		own = [],
		offers,
		open = $bindable(false)
	}: {
		/** The item's name: the menu's title. */
		title: string;
		kind: CloneKind;
		/** The page's own row. */
		current: number;
		own?: MenuItem[];
		offers: CloneOffers;
		open?: boolean;
	} = $props();

	let opened = $state<CloneSheet | null>(null);
	const close = () => (opened = null);

	const items = $derived(
		orderMenu(
			own,
			cloneMenuItems(offers, (s) => (opened = s))
		)
	);
</script>

<MenuSheet {title} {items} bind:open />

{#if offers.drop}
	<DropSheet open={opened === 'drop'} onclose={close} drop={offers.drop} fromId={current} />
{/if}
{#if offers.detach}
	<DetachSheet open={opened === 'detach'} onclose={close} {kind} detach={offers.detach} />
{/if}
{#if offers.copy}
	<CopyToSheet
		open={opened === 'copy'}
		onclose={close}
		offer={offers.copy}
		{current}
		ondone={(message, href) => copied.show(message, href)}
	/>
{/if}
{#if offers.sameAs}
	<SameAsSheet open={opened === 'sameAs'} onclose={close} offer={offers.sameAs} />
{/if}
{#if offers.move}
	<MoveToSheet open={opened === 'move'} onclose={close} offer={offers.move} {current} />
{/if}
