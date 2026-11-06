<script lang="ts">
	import MenuSheet from '$lib/components/ui/MenuSheet.svelte';
	import DropSheet from './DropSheet.svelte';
	import DetachSheet from './DetachSheet.svelte';
	import CopyToSheet from './CopyToSheet.svelte';
	import MoveToSheet from './MoveToSheet.svelte';
	import SameAsSheet from './SameAsSheet.svelte';
	import { copied } from './copied.svelte';
	import { cloneMenuItems, type CloneSheet } from '$lib/clones/menu';
	import { menuLabel, orderMenu, type MenuItem } from '$lib/menu';
	import type {
		CloneKind,
		CopyOffer,
		DetachOffer,
		DropOptions,
		MoveOffer,
		TwinOffer
	} from '$lib/types';

	/**
	 * A family page's ⋯ (spec 2026-11-06): the page's own items (`own`), then
	 * Copy to…, Same as…, Move to…, Detach and Drop my copy, each when its offer
	 * is set, and the sheets they open, as the button row under the tabs had
	 * them. Put it last in the band's right side. Nothing shows without an item.
	 */
	let {
		title,
		kind,
		current,
		own = [],
		copy = null,
		sameAs = null,
		move = null,
		detach = null,
		drop = null
	}: {
		/** The item's name: the menu's title. */
		title: string;
		kind: CloneKind;
		/** The page's own row. */
		current: number;
		own?: MenuItem[];
		copy?: CopyOffer | null;
		sameAs?: TwinOffer | null;
		move?: MoveOffer | null;
		detach?: DetachOffer | null;
		drop?: DropOptions | null;
	} = $props();

	let opened = $state<CloneSheet | null>(null);
	const close = () => (opened = null);

	const items = $derived(
		orderMenu(
			own,
			cloneMenuItems({ copy, sameAs, move, detach, drop }, (s) => (opened = s))
		)
	);
</script>

<MenuSheet {title} label={menuLabel(kind)} {items} focusKey="item-menu" />

{#if drop}
	<DropSheet open={opened === 'drop'} onclose={close} {drop} fromId={current} />
{/if}
{#if detach}
	<DetachSheet open={opened === 'detach'} onclose={close} {kind} {detach} />
{/if}
{#if copy}
	<CopyToSheet
		open={opened === 'copy'}
		onclose={close}
		offer={copy}
		{current}
		ondone={(message, href) => copied.show(message, href)}
	/>
{/if}
{#if sameAs}
	<SameAsSheet open={opened === 'sameAs'} onclose={close} offer={sameAs} />
{/if}
{#if move}
	<MoveToSheet open={opened === 'move'} onclose={close} offer={move} {current} />
{/if}
