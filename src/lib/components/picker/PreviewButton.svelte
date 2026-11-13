<script lang="ts">
	/**
	 * A picker row's preview (picker preview, revision 2026-11-13): a 64 px square,
	 * a tap opening the figure's sheet — or, as the fallback (`PREVIEW_LOOK`), an
	 * eye. It shows the figure's still (loaded lazily), and while `motion.ts` gives
	 * it a slot (on screen and uncovered, among the first four, the device not one
	 * for stills) its clip over it: the section at real speed, muted and looping,
	 * paused where it is while the list scrolls. The <video> is there only while
	 * the tile has a slot, so a row off screen holds no decoder. A muted background loop (`data-ambient`): one sound at a
	 * time leaves it alone. A clip that will not play falls back to the still; a
	 * still that will not load (a loop not cut yet) to the empty tile.
	 */
	import { t } from '$lib/i18n/catalog';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CLIP, iconButton } from '$lib/components/ui/styles';
	import { failedNow, tileShows, type Slot } from '$lib/picker/preview';
	import { playSlot } from '$lib/picker/motion';
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

	/** What of which picture would not load: a reused tile draws the next one afresh. */
	let failed = $state<{ for: string; what: 'clip' | 'still' } | null>(null);
	let slot = $state<Slot>('off');
	let video = $state<HTMLVideoElement | null>(null);
	const shows = $derived(tileShows(picture, { slot, failed: failedNow(failed, picture) }));

	// While the list scrolls the clip pauses where it is, and plays on from there (review):
	// unmounting it would restart it from its first frame after every scroll.
	$effect(() => {
		if (!video) return;
		if (slot === 'pause') video.pause();
		else if (slot === 'play') void video.play().catch(() => {});
	});
	const fail = (what: 'clip' | 'still') => {
		if (picture) failed = { for: picture.clip, what };
	};
</script>

{#snippet tile()}
	{#if shows.kind === 'empty'}
		<span class="flex size-full items-center justify-center bg-accent-soft text-accent-text"
			><Icon name="video" size={22} /></span
		>
	{:else}
		<img
			src={shows.still}
			alt=""
			loading="lazy"
			class="block size-full object-cover"
			onerror={() => fail('still')}
		/>
		{#if shows.kind === 'clip'}
			<video
				bind:this={video}
				src={shows.clip}
				muted
				loop
				playsinline
				autoplay
				data-ambient
				preload="auto"
				class="absolute inset-0 block size-full object-cover"
				onerror={() => fail('clip')}
			></video>
		{/if}
		{#if !decorative}
			<span
				class="absolute right-0.5 bottom-0.5 flex size-4 items-center justify-center rounded-full bg-black/55 text-white"
				aria-hidden="true"><Icon name="eye" size={11} /></span
			>
		{/if}
	{/if}
{/snippet}

{#if look === 'eye'}
	<button
		type="button"
		class={iconButton('bare')}
		aria-label={t().picker.look.preview(label)}
		{onclick}><Icon name="eye" size={22} /></button
	>
{:else if decorative}
	<span
		class="{CLIP} relative block size-16 flex-none rounded-lg bg-black"
		aria-hidden="true"
		{@attach playSlot((on) => (slot = on))}>{@render tile()}</span
	>
{:else}
	<button
		type="button"
		class="{CLIP} relative block size-16 flex-none cursor-pointer rounded-lg bg-black"
		aria-label={t().picker.look.preview(label)}
		{onclick}
		{@attach playSlot((on) => (slot = on))}>{@render tile()}</button
	>
{/if}
