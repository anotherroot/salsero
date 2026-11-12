<script lang="ts">
	/**
	 * A picker row's preview (picker preview): the figure's moving picture, 64 × 40,
	 * a tap opening its sheet — or, as the fallback (`PREVIEW_LOOK`), an eye. The
	 * strip is one image of 12 frames, stepped by CSS while the row is on screen
	 * (`motion.ts`); the still with Reduce motion or Data Saver; the empty
	 * tile when there is no picture or it would not load (a loop not cut yet).
	 * An image, never a video: outside one sound at a time.
	 */
	import { t } from '$lib/i18n/catalog';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CLIP, iconButton } from '$lib/components/ui/styles';
	import { tileShows } from '$lib/picker/preview';
	import { onScreen, stillHere } from '$lib/picker/motion';
	import type { Picture } from '$lib/types';

	interface Props {
		picture: Picture;
		/** The row's full label: the button says "Preview <label>". */
		label: string;
		look?: 'tile' | 'eye';
		/** Only a picture, not a button (a move's sheet lists its variations' pictures). */
		decorative?: boolean;
		onclick: () => void;
	}

	let { picture, label, look = 'tile', decorative = false, onclick }: Props = $props();

	let failed = $state(false);
	let visible = $state(false);
	const shows = $derived(tileShows(picture, { still: stillHere(), failed }));
</script>

{#snippet tile()}
	{#if shows.kind === 'empty'}
		<span class="flex size-full items-center justify-center bg-accent-soft text-accent-text"
			><Icon name="video" size={20} /></span
		>
	{:else if shows.kind === 'still'}
		<img
			src={shows.src}
			alt=""
			loading="lazy"
			class="block size-full object-cover"
			onerror={() => (failed = true)}
		/>
	{:else}
		<img
			src={shows.src}
			alt=""
			loading="lazy"
			class="strip absolute inset-y-0 left-0 h-full w-[1200%] max-w-none"
			class:moving={visible}
			onerror={() => (failed = true)}
		/>
	{/if}
	{#if shows.kind !== 'empty' && !decorative}
		<span
			class="absolute right-0.5 bottom-0.5 flex size-4 items-center justify-center rounded-full bg-black/55 text-white"
			aria-hidden="true"><Icon name="eye" size={11} /></span
		>
	{/if}
{/snippet}

{#if look === 'eye'}
	<button
		type="button"
		class={iconButton('bare')}
		aria-label={t().picker.look.preview(label)}
		{onclick}><Icon name="eye" size={22} /></button
	>
{:else}
	{#if decorative}
		<span
			class="{CLIP} relative block h-10 w-16 flex-none rounded-lg bg-black"
			aria-hidden="true"
			{@attach onScreen((on) => (visible = on))}>{@render tile()}</span
		>
	{:else}
		<button
			type="button"
			class="{CLIP} relative block h-10 w-16 flex-none cursor-pointer rounded-lg bg-black"
			aria-label={t().picker.look.preview(label)}
			{onclick}
			{@attach onScreen((on) => (visible = on))}>{@render tile()}</button
		>
	{/if}
{/if}

<style>
	/* 12 frames side by side: step through them, 3 a second (spec: a 4 s loop). */
	.strip {
		animation: loop12 4s steps(12) infinite;
		animation-play-state: paused;
	}
	.strip.moving {
		animation-play-state: running;
	}
	@keyframes loop12 {
		to {
			transform: translateX(-100%);
		}
	}
</style>
