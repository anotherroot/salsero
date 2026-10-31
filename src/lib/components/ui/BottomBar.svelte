<script lang="ts">
	import type { Snippet } from 'svelte';

	/** Pinned to the bottom of a page. Callers add `pb-28` to their scroll content. */
	let { children }: { children: Snippet } = $props();
</script>

<div
	class="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-ground px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
>
	<div class="mx-auto max-w-[560px]">{@render children()}</div>
</div>
