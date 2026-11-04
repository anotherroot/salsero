<script lang="ts" generics="T extends string">
	let {
		items,
		value = $bindable(),
		onBand = false,
		name,
		label,
		onchange,
		clearable = false
	}: {
		items: readonly { value: T; label: string }[];
		/** Null (only with `clearable`): none is picked, and the form sends nothing. */
		value: T | null;
		onBand?: boolean;
		name: string;
		/** Names the group for a screen reader. */
		label: string;
		/** Called with the picked value, after the bound value has changed. */
		onchange?: (value: T) => void;
		/** A tap on the picked one clears it: a form field that may stay unknown (a position's hold). */
		clearable?: boolean;
	} = $props();

	/** A click on the radio already picked: no change event fires, so clear it here. */
	function clear(e: MouseEvent & { currentTarget: HTMLInputElement }, v: T) {
		if (!clearable || value !== v) return;
		value = null;
		e.currentTarget.checked = false;
	}

	const track = $derived(onBand ? 'bg-band-track' : 'bg-chip');
	const ring = $derived(
		onBand ? 'has-focus-visible:outline-band-ink' : 'has-focus-visible:outline-accent'
	);
	const idle = $derived(onBand ? 'text-band-small' : 'text-ink-2');
	const picked = $derived(
		onBand
			? 'has-checked:bg-band-ink has-checked:text-on-cream'
			: 'has-checked:bg-surface has-checked:text-ink'
	);
</script>

<div
	role="radiogroup"
	aria-label={label}
	class="grid h-[50px] gap-0 rounded-full p-[3px] {track}"
	style="grid-template-columns: repeat({items.length}, minmax(0, 1fr))"
>
	{#each items as item (item.value)}
		<label
			class="flex h-11 cursor-pointer items-center justify-center rounded-full font-sans text-[15px] font-bold has-checked:font-extrabold has-focus-visible:outline-2 has-focus-visible:outline-offset-1 {ring} {idle} {picked}"
		>
			<input
				type="radio"
				class="sr-only"
				{name}
				value={item.value}
				bind:group={value}
				onclick={(e) => clear(e, item.value)}
				onchange={() => onchange?.(item.value)}
			/>
			{item.label}
		</label>
	{/each}
</div>
