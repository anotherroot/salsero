<script lang="ts">
	import BandButton from './BandButton.svelte';
	import Icon from './Icon.svelte';
	import Sheet from './Sheet.svelte';
	import { GROUP } from './styles';
	import type { MenuItem } from '$lib/menu';

	/**
	 * A page's ⋯ in the band and the small sheet it opens, titled with the
	 * item's name (spec 2026-11-06). A row is a link (`href`) or a button: the
	 * menu closes, then its `onclick` runs (it usually opens another sheet).
	 * Draws nothing at all when there is no item.
	 */
	let {
		title,
		label,
		items,
		focusKey
	}: {
		title: string;
		/** The ⋯ button's name: "Position menu". */
		label: string;
		items: MenuItem[];
		focusKey?: string;
	} = $props();

	let open = $state(false);

	const ROW =
		'flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left active:bg-step';
</script>

{#if items.length > 0}
	<BandButton icon="more" {label} {focusKey} onclick={() => (open = true)} />

	<Sheet {title} size="small" {open} onclose={() => (open = false)}>
		<div class={GROUP}>
			{#each items as item (item.key)}
				{#if item.href}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the page resolved it -->
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
