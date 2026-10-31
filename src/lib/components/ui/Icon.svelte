<script lang="ts">
	import { FILLED, ICONS, type IconName } from '$lib/icons/icons';

	let {
		name,
		size = 24,
		filled = false,
		stroke = 2,
		label
	}: {
		name: IconName;
		size?: number;
		filled?: boolean;
		stroke?: number;
		label?: string;
	} = $props();

	const inner = $derived((filled ? FILLED[name] : undefined) ?? ICONS[name]);
	const isFilled = $derived(filled && FILLED[name] !== undefined);
</script>

<!-- The markup comes from the constant table in $lib/icons/icons.ts, never from user input. -->
<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill={isFilled ? undefined : 'none'}
	stroke={isFilled ? undefined : 'currentColor'}
	stroke-width={isFilled ? undefined : stroke}
	stroke-linecap="round"
	stroke-linejoin="round"
	style="flex: none"
	aria-hidden={label ? undefined : 'true'}
	role={label ? 'img' : undefined}
	aria-label={label}
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html inner}
</svg>
