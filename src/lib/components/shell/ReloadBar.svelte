<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import { STALE_MESSAGE } from '$lib/page-epoch';
	import { reloadOrAsk } from '$lib/unsaved/guard.svelte';

	/*
	 * A new version is out and the page has not reloaded by itself (something
	 * was open, unsaved or running). A slim bar directly above the tab bar
	 * (`--pin-bottom`), or on the bottom edge where none shows. Reload still
	 * asks about anything unsaved, an upload in flight included.
	 *
	 * `stale`: the server has refused this page (`$lib/page-epoch.ts`), so
	 * nothing more it sends will save; the wording says so, and may take two lines.
	 */
	let { stale = false }: { stale?: boolean } = $props();
</script>

<div
	role="status"
	class="fixed inset-x-0 z-30 border-t border-hairline bg-ground px-4 pt-2 desk:left-(--pane-left)"
	style:bottom="var(--pin-bottom, 0px)"
	style:padding-bottom="calc(8px + var(--pin-safe, var(--safe-bottom)))"
>
	<div class="mx-auto flex max-w-[560px] items-center gap-3 desk:max-w-[720px]">
		<span class="flex-none text-accent-text"><Icon name="info" size={20} /></span>
		{#if stale}
			<span class="min-w-0 flex-1 text-[15px] leading-snug font-extrabold text-ink"
				>{STALE_MESSAGE}</span
			>
		{:else}
			<span class="min-w-0 flex-1 truncate text-[15px] font-extrabold text-ink">New version</span>
		{/if}
		<button type="button" class={button('secondary', 'sm')} onclick={reloadOrAsk}>Reload</button>
	</div>
</div>
