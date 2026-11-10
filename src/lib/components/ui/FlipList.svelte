<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { flipList } from '$lib/motion/flip.svelte';

	/**
	 * A list that folds and opens (`flipList`), for a list drawn inside an
	 * `{#each}` where a script cannot reach it. Give each row `data-flip={key}`,
	 * the same keys, in order, as `keys`.
	 */
	let {
		keys,
		tag = 'ul',
		children,
		...rest
	}: {
		keys: readonly (string | number)[];
		tag?: 'ul' | 'ol' | 'div';
		children: Snippet;
	} & HTMLAttributes<HTMLElement> = $props();

	let list = $state<HTMLElement>();
	flipList({ container: () => list, keys: () => keys });
</script>

<svelte:element this={tag} bind:this={list} {...rest}>{@render children()}</svelte:element>
