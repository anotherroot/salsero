<!-- src/lib/components/video/Transport.svelte -->
<script lang="ts">
	import Icon from './Icon.svelte';
	import { icons } from './icons';
	import { BTN, BTN_ACCENT, BTN_GHOST, BTN_ON_VIDEO } from './styles';

	interface Props {
		paused: boolean;
		/** compact: the editor's row; normal: the full video; large: a section's view. */
		size?: 'compact' | 'normal' | 'large';
		/** Without the ±1 s pair (the editor's compact row). */
		seconds?: boolean;
		/** Floating over the picture (landscape). */
		overlay?: boolean;
		ontoggle: () => void;
		onstep: (s: -1 | 1) => void;
		onframe: (f: -1 | 1) => void;
	}

	let {
		paused,
		size = 'normal',
		seconds = true,
		overlay = false,
		ontoggle,
		onstep,
		onframe
	}: Props = $props();

	const side = $derived(overlay ? BTN_ON_VIDEO : BTN_GHOST);
	const frame = $derived(
		overlay
			? BTN_ON_VIDEO
			: size === 'compact'
				? BTN_GHOST
				: `${BTN} ${size === 'large' ? 'size-14 rounded-2xl' : ''}`
	);
	const play = $derived(
		size === 'compact'
			? BTN
			: `${BTN_ACCENT} ${size === 'large' ? 'h-18 w-21 rounded-[22px]' : 'h-14 w-18 rounded-[18px]'}`
	);
	const glyph = $derived(size === 'compact' ? 20 : size === 'large' ? 30 : 26);
</script>

<div class="flex items-center justify-center gap-1.5" class:gap-2={size === 'large'}>
	{#if seconds}
		<button
			type="button"
			class="{side} min-w-13"
			class:h-14={size === 'large'}
			onclick={() => onstep(-1)}>−1 s</button
		>
	{/if}
	<button type="button" class={frame} aria-label="Previous frame" onclick={() => onframe(-1)}>
		<Icon d={icons.framePrev} />
	</button>
	<button type="button" class={play} aria-label={paused ? 'Play' : 'Pause'} onclick={ontoggle}>
		{#if paused}
			<Icon d={icons.play} filled size={glyph} />
		{:else}
			<Icon d={icons.pause} weight={3.5} size={glyph} />
		{/if}
	</button>
	<button type="button" class={frame} aria-label="Next frame" onclick={() => onframe(1)}>
		<Icon d={icons.frameNext} />
	</button>
	{#if seconds}
		<button
			type="button"
			class="{side} min-w-13"
			class:h-14={size === 'large'}
			onclick={() => onstep(1)}>+1 s</button
		>
	{/if}
</div>
