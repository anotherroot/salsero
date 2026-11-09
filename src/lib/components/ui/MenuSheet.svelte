<script lang="ts">
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';
	import { GROUP } from './styles';
	import { offlineMenu, type MenuItem } from '$lib/menu';
	import NeedsConnectionNote from '$lib/components/system/NeedsConnectionNote.svelte';
	import { connection } from '$lib/offline/connection.svelte';

	/**
	 * The small sheet a page's ⋯ opens, titled with the item's name (spec
	 * 2026-11-06). A row is a link (`href`) or a button: the menu closes, then
	 * its `onclick` runs (it usually opens another sheet). The page draws the ⋯
	 * itself (a `BandButton icon="more"` that sets `open`) and this sheet once,
	 * in its body: the band is drawn twice (big and slim), and a sheet inside it
	 * would be too.
	 */
	let {
		title,
		items,
		open = $bindable(false)
	}: {
		title: string;
		items: MenuItem[];
		open?: boolean;
	} = $props();

	/** Offline, what needs a connection is greyed, with one note at the top (look 4B). */
	const menu = $derived(offlineMenu(items, connection.online));

	const ROW =
		'flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-step';
</script>

{#if items.length > 0}
	<Sheet {title} size="small" {open} onclose={() => (open = false)}>
		{#if menu.note}<NeedsConnectionNote />{/if}
		<div class={GROUP}>
			{#each menu.items as item (item.key)}
				{#if item.disabled}
					<button type="button" class="{ROW} opacity-40" aria-disabled="true">
						{@render body(item)}
					</button>
				{:else if item.href}
					<a href={item.href} class={ROW}>
						{@render body(item)}
					</a>
				{:else}
					<button
						type="button"
						class={ROW}
						aria-haspopup="dialog"
						onclick={() => {
							open = false;
							item.onclick?.();
						}}
					>
						{@render body(item)}
					</button>
				{/if}
			{/each}
		</div>
	</Sheet>
{/if}

{#snippet body(item: MenuItem)}
	<span class="flex-none {item.danger ? 'text-danger' : 'text-accent-text'}"
		><Icon name={item.icon} size={22} /></span
	>
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="text-[16px] leading-tight font-bold {item.danger ? 'text-danger' : 'text-ink'}"
			>{item.label}</span
		>
		{#if item.meta}<span class="text-[13px] text-muted">{item.meta}</span>{/if}
	</span>
{/snippet}
