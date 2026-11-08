<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/icons/icons';
	import { t } from '$lib/i18n/catalog';

	/*
	 * A beat's menu, under its row (spec 2026-11-08, "Hold a beat"). Esc closes
	 * it and focus goes back to the beat.
	 */
	let {
		heading,
		items,
		onclose
	}: {
		heading: string;
		items: { key: string; icon: IconName; label: string; onclick: () => void }[];
		onclose: () => void;
	} = $props();

	let box: HTMLElement | undefined = $state();
	$effect(() => {
		box?.querySelector<HTMLElement>('button')?.focus();
	});
</script>

<div
	bind:this={box}
	role="menu"
	aria-label={heading}
	tabindex="-1"
	class="mx-1 my-1 flex flex-col rounded-2xl bg-raised py-1 shadow-[0_8px_24px_rgb(0_0_0/0.18)]"
	onkeydown={(e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
		}
	}}
>
	<div class="flex items-center gap-2 py-1 pr-1 pl-4">
		<span class="flex-1 text-[13px] font-bold text-muted tabular-nums">{heading}</span>
		<button
			type="button"
			class="flex size-11 cursor-pointer items-center justify-center text-muted"
			aria-label={t().songs.page.menu.close}
			onclick={onclose}><Icon name="close" size={18} /></button
		>
	</div>
	{#each items as item (item.key)}
		<button
			type="button"
			role="menuitem"
			class="focus-inset flex min-h-12 cursor-pointer items-center gap-3 px-4 text-left text-[16px] font-bold text-ink"
			onclick={item.onclick}
		>
			<span class="text-ink-2"><Icon name={item.icon} size={20} /></span>{item.label}
		</button>
	{/each}
</div>
