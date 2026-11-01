<script lang="ts">
	import type { Snippet } from 'svelte';
	import { claimBottom } from '$lib/nav/chrome.svelte';

	/**
	 * Pinned to the bottom of a page. `fade`: no border, the page scrolls under a fade. Callers add `pb-28` to their scroll content.
	 *
	 * Without `mode` it sits above the tab bar when one shows (`--pin-bottom`, set by
	 * the layout; 0 where there is none). With `mode` (an edit's Save) it takes the
	 * bottom edge and the tab bar steps aside while it is mounted.
	 */
	let {
		children,
		fade = false,
		mode = false,
		class: extra = ''
	}: { children: Snippet; fade?: boolean; mode?: boolean; class?: string } = $props();

	claimBottom(() => mode);
</script>

<div
	class="{extra} fixed inset-x-0 z-20 px-4 {fade
		? 'bg-linear-to-b from-ground/0 to-ground to-[34%] pt-7'
		: 'border-t border-hairline bg-ground pt-3'}"
	style:bottom={mode ? '0px' : 'var(--pin-bottom, 0px)'}
	style:padding-bottom="calc(12px + {mode
		? 'var(--safe-bottom)'
		: 'var(--pin-safe, var(--safe-bottom))'})"
>
	<div class="mx-auto max-w-[560px]">{@render children()}</div>
</div>
