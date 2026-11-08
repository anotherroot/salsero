<!-- src/lib/components/video/Transport.svelte -->
<script lang="ts">
	import { t } from '$lib/i18n/catalog';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { roundButton } from './styles';

	interface Props {
		paused: boolean;
		/** compact: the editor's and slim bar's row; normal: the full video; large: a section's view; float: landscape over the picture. */
		size?: 'compact' | 'normal' | 'large' | 'float';
		/** fine: ±1 s and ±0.1 s; five: the simple player's −5 s and +5 s only. */
		steps?: 'fine' | 'five';
		/** On the picture: the side buttons get the glass fill. */
		glass?: boolean;
		ontoggle: () => void;
		onstep: (s: -1 | 1) => void;
		/** −0.1 s / +0.1 s: pauses, then steps. */
		ontenth: (d: -1 | 1) => void;
		/** −5 s / +5 s (steps="five"). */
		onfive?: (d: -1 | 1) => void;
	}

	let {
		paused,
		size = 'normal',
		steps = 'fine',
		glass = false,
		ontoggle,
		onstep,
		ontenth,
		onfive
	}: Props = $props();

	const SIZES = {
		normal: { side: 54, play: 66, gap: 'gap-2.5', glyph: 28 },
		large: { side: 58, play: 78, gap: 'gap-3', glyph: 32 },
		float: { side: 48, play: 56, gap: 'gap-2.5', glyph: 24 }
	} as const;

	const w = $derived(t().video);
	const compact = $derived(size === 'compact');
	const five = $derived(steps === 'five');
	const spec = $derived(compact ? null : SIZES[size as 'normal' | 'large' | 'float']);
	const sideKind = $derived(glass ? 'glass' : 'neutral');
	// Written out per size: the builder takes literal sizes only.
	const side = $derived(
		compact
			? roundButton('ghost', 48)
			: roundButton(sideKind, size === 'large' ? 58 : size === 'float' ? 48 : 54)
	);
	const play = $derived(
		compact
			? roundButton('neutral', 44)
			: roundButton('accent', size === 'large' ? 78 : size === 'float' ? 56 : 66)
	);
	const glyph = $derived(compact ? 22 : (spec?.glyph ?? 28));
</script>

<div class="flex items-center justify-center {compact ? 'gap-1' : spec?.gap}">
	{#if five}
		<button
			type="button"
			class="{side} text-[14px]"
			aria-label={w.backBy(5)}
			onclick={() => onfive?.(-1)}>{w.minus(5)}</button
		>
	{:else}
		{#if !compact}
			<button
				type="button"
				class="{side} text-[14px]"
				aria-label={w.backBy(1)}
				onclick={() => onstep(-1)}>{w.minus(1)}</button
			>
		{/if}
		<button
			type="button"
			class="{side} text-[13px]"
			aria-label={w.backBy(0.1)}
			onclick={() => ontenth(-1)}>{w.minus(0.1)}</button
		>
	{/if}
	<button type="button" class={play} aria-label={paused ? w.play : w.pause} onclick={ontoggle}>
		{#if paused}
			<span class="ml-[3px] flex"><Icon name="play" filled size={glyph} /></span>
		{:else}
			<Icon name="pause" filled size={glyph} />
		{/if}
	</button>
	{#if five}
		<button
			type="button"
			class="{side} text-[14px]"
			aria-label={w.forwardBy(5)}
			onclick={() => onfive?.(1)}>{w.plus(5)}</button
		>
	{:else}
		<button
			type="button"
			class="{side} text-[13px]"
			aria-label={w.forwardBy(0.1)}
			onclick={() => ontenth(1)}>{w.plus(0.1)}</button
		>
		{#if !compact}
			<button
				type="button"
				class="{side} text-[14px]"
				aria-label={w.forwardBy(1)}
				onclick={() => onstep(1)}>{w.plus(1)}</button
			>
		{/if}
	{/if}
</div>
