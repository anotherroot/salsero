<!-- src/lib/components/video/TopBar.svelte -->
<script lang="ts">
	import { VIDEO_RATES, type VideoRate } from '$lib/video-prefs';
	import Icon from './Icon.svelte';
	import { icons } from './icons';
	import { BTN, BTN_ACCENT, BTN_GHOST, BTN_ON_VIDEO } from './styles';

	interface Props {
		title: string;
		subtitle: string;
		mirror: boolean;
		rate: VideoRate;
		/** Floating over the picture (landscape): the buttons get their own backing. */
		overlay?: boolean;
		/** Landscape only: opens the list beside the video. */
		onspots?: () => void;
		spotsCount?: number;
		onclose: () => void;
		onchoose: (next: { mirror?: boolean; rate?: VideoRate }) => void;
	}

	let {
		title,
		subtitle,
		mirror,
		rate,
		overlay = false,
		onspots,
		spotsCount = 0,
		onclose,
		onchoose
	}: Props = $props();

	let speedOpen = $state(false);
	const plain = $derived(overlay ? BTN_ON_VIDEO : BTN_GHOST);
</script>

<div class="relative flex h-14 items-center gap-1 px-2">
	<button type="button" class={plain} aria-label="Close player" onclick={onclose}>
		<Icon d={icons.close} />
	</button>
	<div class="min-w-0 flex-1 pl-1 leading-tight" class:drop-shadow={overlay}>
		<span class="block truncate text-[15px] font-semibold">{title}</span>
		{#if subtitle}<span class="block truncate text-[12px] text-(--pl-muted)">{subtitle}</span>{/if}
	</div>
	{#if onspots}
		<button type="button" class={plain} onclick={onspots}>
			<Icon d={icons.list} />Sections ({spotsCount})
		</button>
	{/if}
	<button
		type="button"
		class={mirror ? BTN_ACCENT : plain}
		aria-label="Mirror"
		aria-pressed={mirror}
		onclick={() => onchoose({ mirror: !mirror })}
	>
		<Icon d={icons.mirror} />
	</button>
	<button
		type="button"
		class="{overlay ? BTN_ON_VIDEO : BTN} min-w-15"
		aria-label="Speed {rate}×"
		aria-expanded={speedOpen}
		onclick={() => (speedOpen = !speedOpen)}>{rate}×</button
	>
	{#if speedOpen}
		<div
			role="group"
			aria-label="Speed"
			class="absolute top-14 right-2 z-30 flex gap-1 rounded-2xl bg-(--pl-raised) p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.5)]"
		>
			{#each VIDEO_RATES as r (r)}
				<button
					type="button"
					class="{rate === r ? BTN_ACCENT : BTN_GHOST} min-w-14"
					aria-pressed={rate === r}
					onclick={() => {
						onchoose({ rate: r });
						speedOpen = false;
					}}>{r}×</button
				>
			{/each}
		</div>
	{/if}
</div>
