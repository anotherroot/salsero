<!-- src/lib/components/video/TopBar.svelte -->
<script lang="ts">
	import { VIDEO_RATES, type VideoChoice, type VideoRate } from '$lib/video-prefs';
	import type { TopBarParts } from '$lib/video/chrome';
	import { t } from '$lib/i18n/catalog';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { TOP_GLASS, topBack, topEdit } from './styles';

	interface Props {
		title: string;
		subtitle: string;
		mirror: boolean;
		rate: VideoRate;
		muted: boolean;
		/** What shows, from `topBar(mode, level.kind)`. */
		parts: TopBarParts;
		spotsCount?: number;
		/** Where the bar sits: over the picture in landscape (its wrapper pads), or the landscape panel's top. */
		place?: 'overlay' | 'panel';
		/** The Sections pill: opens the list beside the video (landscape). */
		onspots?: () => void;
		/** ‹ Full video, from a section's view. */
		onback?: () => void;
		/** Edit, from a section's view. */
		onedit?: () => void;
		onclose: () => void;
		onchoose: (next: VideoChoice) => void;
		/** The simple player: the whole video loops. */
		repeat?: boolean;
		/** A section opened as such always loops: repeat is lit and cannot be turned off. */
		repeatLocked?: boolean;
	}

	let {
		title,
		subtitle,
		mirror,
		rate,
		muted,
		parts,
		place,
		spotsCount = 0,
		repeat = false,
		repeatLocked = false,
		onspots,
		onback,
		onedit,
		onclose,
		onchoose
	}: Props = $props();

	const w = $derived(t().video);
	let speedOpen = $state(false);

	const DISC = 'grid size-10 place-items-center rounded-full';
	const GLASS_DISC = `${DISC} bg-surface/72 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]`;
	// The 40 px pills sit in a 44 px button: the outer button is the hit area,
	// the inner span carries the look.
	const HIT = 'grid h-11 flex-none cursor-pointer place-items-center';
	const pill = $derived(topBack(parts.glass));
	const glassPill = TOP_GLASS;
	/** Only the glass pill (landscape) carries the word; upright, Edit is a disc. */
	const editClass = topEdit(false);
</script>

<div
	class="relative flex flex-none items-center {place === undefined ? 'gap-0.5' : 'gap-1'} {place ===
	'overlay'
		? 'h-14'
		: place === 'panel'
			? 'h-[52px] pr-2 pl-10'
			: 'h-14 px-1'} {parts.glass ? '' : 'bg-ground'}"
>
	<button
		type="button"
		class="grid size-11 flex-none cursor-pointer place-items-center text-white"
		aria-label={w.closePlayer}
		onclick={onclose}
	>
		{#if parts.glass}
			<span class={GLASS_DISC}><Icon name="close" size={22} /></span>
		{:else}
			<Icon name="close" size={24} />
		{/if}
	</button>
	{#if parts.back && onback}
		<!-- The one part that gives way: on a very narrow phone its words truncate rather than the bar overflow. -->
		<button type="button" class="flex h-11 min-w-0 cursor-pointer items-center" onclick={onback}>
			<span class="{pill} max-w-full"
				><Icon name="chevron-left" size={20} /><span class="min-w-0 truncate">{w.fullVideo}</span
				></span
			>
		</button>
	{/if}
	{#if parts.title}
		<div
			class="flex min-w-0 flex-1 flex-col gap-px pl-0.5 {parts.glass
				? 'drop-shadow-[0_1px_3px_rgb(0_0_0/0.65)]'
				: ''}"
		>
			<span class="truncate text-[16px] leading-[1.25] font-extrabold">{title}</span>
			{#if parts.sub === 'looping' || subtitle}
				<span
					class="truncate text-[12.5px] font-semibold {parts.glass
						? 'text-white/80'
						: 'text-muted'}">{parts.sub === 'looping' ? w.looping : subtitle}</span
				>
			{/if}
		</div>
	{:else}
		<span class="flex-1"></span>
	{/if}
	{#if parts.edit === 'accent' && onedit}
		<!-- Upright, the bar has no room for the word beside ‹ Full video, Mute, Mirror and speed. -->
		<button
			type="button"
			class="grid size-11 flex-none cursor-pointer place-items-center"
			aria-label={t().common.edit}
			onclick={onedit}
		>
			<span class="{DISC} bg-accent text-on-accent"><Icon name="edit" size={20} /></span>
		</button>
	{:else if parts.edit && onedit}
		<button type="button" class={HIT} onclick={onedit}>
			<span class={editClass}><Icon name="edit" size={18} />{t().common.edit}</span>
		</button>
	{/if}
	{#if parts.sections && onspots}
		<button type="button" class={HIT} onclick={onspots}>
			<span class={glassPill}><Icon name="list" size={20} />{w.sectionsCount(spotsCount)}</span>
		</button>
	{/if}
	{#if parts.repeat}
		<button
			type="button"
			class="grid size-11 flex-none cursor-pointer place-items-center text-white disabled:cursor-default"
			aria-label={w.repeat}
			aria-pressed={repeat}
			disabled={repeatLocked}
			onclick={() => onchoose({ repeat: !repeat })}
		>
			{#if repeat}
				<span class="{DISC} bg-accent text-on-accent"><Icon name="repeat" size={22} /></span>
			{:else if parts.glass}
				<span class={GLASS_DISC}><Icon name="repeat" size={22} /></span>
			{:else}
				<Icon name="repeat" size={24} />
			{/if}
		</button>
	{/if}
	<button
		type="button"
		class="grid size-11 flex-none cursor-pointer place-items-center text-white"
		aria-label={w.mute}
		aria-pressed={muted}
		onclick={() => onchoose({ muted: !muted })}
	>
		{#if muted}
			<span class="{DISC} bg-accent text-on-accent"><Icon name="volume-off" size={22} /></span>
		{:else if parts.glass}
			<span class={GLASS_DISC}><Icon name="volume" size={22} /></span>
		{:else}
			<Icon name="volume" size={24} />
		{/if}
	</button>
	<button
		type="button"
		class="grid size-11 flex-none cursor-pointer place-items-center text-white"
		aria-label={w.mirror}
		aria-pressed={mirror}
		onclick={() => onchoose({ mirror: !mirror })}
	>
		{#if mirror}
			<span class="{DISC} bg-accent text-on-accent"><Icon name="mirror" size={22} /></span>
		{:else if parts.glass}
			<span class={GLASS_DISC}><Icon name="mirror" size={22} /></span>
		{:else}
			<Icon name="mirror" size={24} />
		{/if}
	</button>
	<button
		type="button"
		class={HIT}
		aria-label={w.speedOf(rate)}
		aria-expanded={speedOpen}
		onclick={() => (speedOpen = !speedOpen)}
	>
		<span
			class="grid h-9 min-w-[52px] place-items-center rounded-full px-2.5 text-[15px] font-extrabold text-white tabular-nums {parts.glass
				? 'bg-surface/72'
				: 'bg-step'} {speedOpen
				? 'shadow-[0_0_0_2px_var(--color-accent)]'
				: parts.glass
					? 'shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]'
					: ''}">{w.rate(rate)}</span
		>
	</button>
	{#if speedOpen}
		<div
			role="group"
			aria-label={w.speed}
			class="absolute top-[58px] right-2 z-30 flex gap-0.5 rounded-[27px] bg-surface p-[5px] shadow-[0_12px_30px_rgb(0_0_0/0.6),inset_0_0_0_1px_rgb(255_255_255/0.12)]"
		>
			{#each VIDEO_RATES as r (r)}
				<button
					type="button"
					class="h-11 min-w-[62px] cursor-pointer rounded-full text-[15px] font-extrabold tabular-nums {rate ===
					r
						? 'bg-accent text-on-accent'
						: 'text-white'}"
					aria-pressed={rate === r}
					onclick={() => {
						onchoose({ rate: r });
						speedOpen = false;
					}}>{w.rate(r)}</button
				>
			{/each}
		</div>
	{/if}
</div>
