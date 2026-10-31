<script lang="ts">
	import Icon from './Icon.svelte';
	import { iconButton } from './styles';

	/** [label] (number pill) [unit] (−) (+): the tempo control. A typed value is kept as typed (rounded, clamped into range); `step` is only what − and + move by. */
	interface Props {
		value: number;
		min: number;
		max: number;
		step?: number;
		label: string;
		unit?: string;
		minusLabel?: string;
		plusLabel?: string;
	}

	let {
		value = $bindable(),
		min,
		max,
		step = 1,
		label,
		unit,
		minusLabel = 'Slower',
		plusLabel = 'Faster'
	}: Props = $props();

	const clamp = (n: number) => Math.min(max, Math.max(min, n));

	function commit(e: Event & { currentTarget: HTMLInputElement }) {
		const n = Number(e.currentTarget.value);
		if (Number.isFinite(n) && e.currentTarget.value.trim() !== '') {
			value = clamp(Math.round(n));
		}
		// Show the settled value even when it did not change (a rejected entry snaps back).
		e.currentTarget.value = String(value);
	}
</script>

<div class="flex items-center gap-2">
	<span class="flex-1 text-[16px] font-bold text-ink" aria-hidden="true">{label}</span>
	<input
		class="h-11 w-[76px] flex-none rounded-[22px] border-0 bg-field p-0 text-center font-sans text-[18px] font-extrabold text-ink tabular-nums"
		inputmode="numeric"
		aria-label={unit ? `${label} (${unit})` : label}
		{value}
		onchange={commit}
	/>
	{#if unit}<span class="pr-1 pl-0.5 text-[13px] font-semibold text-muted">{unit}</span>{/if}
	<button
		type="button"
		class={iconButton('step')}
		aria-label={minusLabel}
		disabled={value <= min}
		onclick={() => (value = clamp(value - step))}
	>
		<Icon name="minus" size={20} />
	</button>
	<button
		type="button"
		class={iconButton('step')}
		aria-label={plusLabel}
		disabled={value >= max}
		onclick={() => (value = clamp(value + step))}
	>
		<Icon name="plus" size={20} />
	</button>
</div>
