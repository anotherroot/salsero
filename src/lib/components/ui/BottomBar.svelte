<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Pinned to the bottom of a page. `fade`: no border, the page scrolls under a fade. Callers add `pb-28` to their scroll content. */
	let {
		children,
		fade = false,
		class: extra = ''
	}: { children: Snippet; fade?: boolean; class?: string } = $props();
</script>

<div
	class="{extra} fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(12px+var(--safe-bottom))] {fade
		? 'bg-linear-to-b from-ground/0 to-ground to-[34%] pt-7'
		: 'border-t border-hairline bg-ground pt-3'}"
>
	<div class="mx-auto max-w-[560px]">{@render children()}</div>
</div>
