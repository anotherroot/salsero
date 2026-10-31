<script lang="ts">
	import Icon from './Icon.svelte';
	import { exerciseTile } from '$lib/exercises/tile';
	import type { TileTone } from '$lib/exercises/today';
	import type { Partner, Source } from '$lib/labels';

	let {
		exercise,
		tone
	}: {
		/** null/undefined only with tone "done": a past day's archived exercise. */
		exercise?: { source: Source; partner: Partner | null } | null;
		tone: TileTone;
	} = $props();

	const tile = $derived(exercise ? exerciseTile(exercise) : null);
	const label = $derived(
		tone === 'done' ? (tile ? `${tile.label}, done today` : 'Done') : (tile?.label ?? '')
	);
	const toneCls = $derived(
		tone === 'accent'
			? 'bg-accent-soft text-accent-text'
			: tone === 'quiet'
				? 'bg-chip text-muted'
				: 'bg-done-soft'
	);
</script>

<span
	role="img"
	aria-label={label}
	class="flex h-10 w-10 flex-none items-center justify-center rounded-xl {toneCls}"
>
	{#if tone === 'done'}
		<span class="flex text-done" style="--icon-knockout: var(--color-on-done)">
			<Icon name="check-circle" size={24} filled />
		</span>
	{:else if tile}
		<Icon name={tile.icon} size={22} />
	{/if}
</span>
