<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	let {
		icon,
		title,
		body,
		action
	}: { icon: IconName; title: string; body?: string; action?: Snippet } = $props();
</script>

<div class="flex flex-col items-center gap-2 px-6 py-9 text-center">
	<span
		class="mb-2 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent-soft text-accent-text"
	>
		<Icon name={icon} size={32} />
	</span>
	<h3 class="font-display text-[22px] leading-[1.15] font-extrabold text-ink">{title}</h3>
	{#if body}<p class="max-w-[280px] text-[15px] leading-[1.45] text-muted">{body}</p>{/if}
	{#if action}<div class="mt-2">{@render action()}</div>{/if}
</div>
