<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, LABEL, SELECT, swap } from '$lib/components/ui/styles';
	import { FREQUENCIES, frequencyLabel } from '$lib/frequency';

	interface Props {
		name: string;
		value: number;
		label?: string;
		/** `field` on a surface card (the exercise page's settings), so the box reads as a field. */
		tone?: 'surface' | 'field';
	}

	let { name, value = $bindable(), label = 'How often', tone = 'surface' }: Props = $props();
	const box = $derived(tone === 'field' ? swap(SELECT, 'bg-surface', 'bg-field') : SELECT);
	let open = $state(false);

	function pick(days: number) {
		value = days;
		open = false;
	}
</script>

<div>
	<span class={LABEL} id="{name}-label">{label}</span>
	<button
		type="button"
		class={box}
		aria-haspopup="dialog"
		aria-labelledby="{name}-label {name}-value"
		onclick={() => (open = true)}
	>
		<span id="{name}-value" class="flex-1">{frequencyLabel(value)}</span>
		<span class="text-muted"><Icon name="chevron-down" size={20} /></span>
	</button>
	<input type="hidden" {name} {value} />
</div>

<Sheet title="How often" {open} back onclose={() => (open = false)}>
	<div role="listbox" aria-label="How often" class={GROUP}>
		{#each FREQUENCIES as f (f.days)}
			{@const chosen = f.days === value}
			<button
				type="button"
				role="option"
				aria-selected={chosen}
				class="flex min-h-14 w-full cursor-pointer items-center px-4 text-left text-[16px] {chosen
					? 'font-extrabold text-accent-text'
					: 'font-semibold text-ink'}"
				onclick={() => pick(f.days)}
			>
				<span class="flex-1">{f.label}</span>
				{#if chosen}<span class="text-accent"><Icon name="check" size={22} stroke={2.6} /></span
					>{/if}
			</button>
		{/each}
	</div>
</Sheet>
