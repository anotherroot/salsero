<script lang="ts">
	import Icon from './Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	interface Props {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		label: string;
		icon?: IconName;
		valueText?: (v: number) => string;
		oninput?: () => void;
	}

	let {
		value = $bindable(),
		min = 0,
		max = 1,
		step = 0.05,
		label,
		icon = 'volume',
		valueText = (v: number) => Math.round(v * 100) + '%',
		oninput
	}: Props = $props();

	const pct = $derived(max > min ? ((value - min) / (max - min)) * 100 : 0);
</script>

<div class="flex items-center gap-3.5">
	<span class="text-muted"><Icon name={icon} size={24} /></span>
	<input
		type="range"
		class="slider min-w-0 flex-1"
		{min}
		{max}
		{step}
		aria-label={label}
		aria-valuetext={valueText(value)}
		bind:value
		{oninput}
		style="--fill: {pct}%"
	/>
	<span class="w-11 text-right text-[15px] font-bold text-ink">{valueText(value)}</span>
</div>

<style>
	.slider {
		appearance: none;
		-webkit-appearance: none;
		height: 26px;
		margin: 0;
		background: transparent;
		cursor: pointer;
		/* The global focus rule rings the thumb instead. */
	}
	.slider:focus-visible {
		outline: none;
		box-shadow: none;
	}
	.slider::-webkit-slider-runnable-track {
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(
			to right,
			var(--color-accent) var(--fill),
			var(--color-hairline) var(--fill)
		);
	}
	.slider::-moz-range-track {
		height: 6px;
		border-radius: 3px;
		background: linear-gradient(
			to right,
			var(--color-accent) var(--fill),
			var(--color-hairline) var(--fill)
		);
	}
	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 26px;
		height: 26px;
		margin-top: -10px;
		border: 0;
		border-radius: 50%;
		background: #fff;
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.3),
			0 0 0 0.5px rgb(0 0 0 / 0.08);
	}
	.slider::-moz-range-thumb {
		width: 26px;
		height: 26px;
		border: 0;
		border-radius: 50%;
		background: #fff;
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.3),
			0 0 0 0.5px rgb(0 0 0 / 0.08);
	}
	.slider:focus-visible::-webkit-slider-thumb {
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.3),
			0 0 0 2px var(--color-surface),
			0 0 0 4px var(--color-accent),
			0 0 0 8px color-mix(in srgb, var(--color-accent) 20%, transparent);
	}
	.slider:focus-visible::-moz-range-thumb {
		box-shadow:
			0 1px 4px rgb(0 0 0 / 0.3),
			0 0 0 2px var(--color-surface),
			0 0 0 4px var(--color-accent),
			0 0 0 8px color-mix(in srgb, var(--color-accent) 20%, transparent);
	}
</style>
