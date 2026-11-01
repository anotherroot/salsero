<!-- src/lib/components/video/Transport.svelte -->
<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { roundButton } from './styles';

	interface Props {
		paused: boolean;
		/** compact: the editor's and slim bar's row; normal: the full video; large: a section's view; float: landscape over the picture. */
		size?: 'compact' | 'normal' | 'large' | 'float';
		/** On the picture: the side buttons get the glass fill. */
		glass?: boolean;
		ontoggle: () => void;
		onstep: (s: -1 | 1) => void;
		/** −0.1 s / +0.1 s: pauses, then steps. */
		ontenth: (d: -1 | 1) => void;
	}

	let { paused, size = 'normal', glass = false, ontoggle, onstep, ontenth }: Props = $props();

	const SIZES = {
		normal: { side: 54, play: 66, gap: 'gap-2.5', glyph: 28 },
		large: { side: 58, play: 78, gap: 'gap-3', glyph: 32 },
		float: { side: 48, play: 56, gap: 'gap-2.5', glyph: 24 }
	} as const;

	const compact = $derived(size === 'compact');
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
	{#if !compact}
		<button
			type="button"
			class="{side} text-[14px]"
			aria-label="−1 s, back"
			onclick={() => onstep(-1)}>−1 s</button
		>
	{/if}
	<button
		type="button"
		class="{side} text-[13px]"
		aria-label="−0.1 s, back"
		onclick={() => ontenth(-1)}>−0.1 s</button
	>
	<button type="button" class={play} aria-label={paused ? 'Play' : 'Pause'} onclick={ontoggle}>
		{#if paused}
			<span class="ml-[3px] flex"><Icon name="play" filled size={glyph} /></span>
		{:else}
			<Icon name="pause" filled size={glyph} />
		{/if}
	</button>
	<button
		type="button"
		class="{side} text-[13px]"
		aria-label="+0.1 s, forward"
		onclick={() => ontenth(1)}>+0.1 s</button
	>
	{#if !compact}
		<button
			type="button"
			class="{side} text-[14px]"
			aria-label="+1 s, forward"
			onclick={() => onstep(1)}>+1 s</button
		>
	{/if}
</div>
