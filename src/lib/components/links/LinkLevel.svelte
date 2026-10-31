<!-- src/lib/components/links/LinkLevel.svelte -->
<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import PlayerLayer from '$lib/components/ui/PlayerLayer.svelte';

	/**
	 * One level of the Link popup: the links list, or a create step. Mounted
	 * while its level is in the host's stack, so stacking follows the stack.
	 *
	 * `light`: the site's `Sheet`, open while mounted, with a history entry of
	 * its own, so Back closes only this level. `dark`: a `PlayerLayer` inside the
	 * full-screen player's <dialog> (the media palette), `z` deep.
	 *
	 * ×, Back, Escape and the backdrop all go one level back (`onback`). The
	 * Sheet or the layer owns the dialog, the focus and the keys.
	 */
	interface Props {
		theme: 'light' | 'dark';
		title: string;
		/** A muted line under the title. */
		sub?: string;
		/** Stacked on another level: Back on the left, no ×. */
		back: boolean;
		/** Dark only: the layer's z-index class. A create step sits above the picker's z-40. */
		z?: string;
		/** Pinned under the body, a hairline above it. */
		footer?: Snippet;
		onback: () => void;
		children: Snippet;
	}

	let { theme, title, sub, back, z = 'z-40', footer, onback, children }: Props = $props();

	/** Gone with its level: a close the browser reports on the way out is not one level back. */
	let gone = false;
	onMount(() => () => (gone = true));
	function close() {
		if (!gone) onback();
	}
</script>

{#if theme === 'dark'}
	<PlayerLayer {title} {sub} {back} {z} {footer} onclose={close}>
		{@render children()}
	</PlayerLayer>
{:else}
	<Sheet open {title} {sub} {back} {footer} onclose={close}>
		{@render children()}
	</Sheet>
{/if}
