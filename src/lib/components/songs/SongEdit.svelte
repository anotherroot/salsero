<script lang="ts">
	import type { Snippet } from 'svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import SeekBar from '$lib/components/ui/SeekBar.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { PLAY_ROUND } from '$lib/components/ui/styles';
	import type { ToastState } from '$lib/act-toast';
	import { t } from '$lib/i18n/catalog';

	/*
	 * Edit (spec 2026-11-08): two tabs, Grid and Song, over a pinned player.
	 * Every change saves when made, with Undo in the toast; the page's × only
	 * leaves Edit. The tab bar steps aside (`BottomBar` `mode`).
	 */
	let {
		tab = $bindable('grid'),
		now,
		paused,
		duration,
		quietUntil,
		ontoggle,
		onseek,
		toast = $bindable(null),
		gridTab,
		songTab,
		gridBar
	}: {
		tab?: 'grid' | 'song';
		now: number;
		paused: boolean;
		duration: number;
		/** Where the music starts, pale before it on the seek bar. */
		quietUntil: number;
		ontoggle: () => void;
		onseek: (s: number) => void;
		toast?: ToastState | null;
		gridTab: Snippet;
		songTab: Snippet;
		/** The Grid tab's pinned buttons beside play (Tap on the 1, + Section). */
		gridBar?: Snippet;
	} = $props();

	const w = $derived(t().songs.page.edit);
</script>

<Segmented
	name="edit-tab"
	label={w.tabs}
	items={[
		{ value: 'grid', label: w.grid },
		{ value: 'song', label: w.song }
	]}
	bind:value={tab}
/>

<div class="flex flex-col gap-2 pb-40">
	{#if tab === 'grid'}{@render gridTab()}{:else}{@render songTab()}{/if}
</div>

<BottomBar mode width="song">
	<div class="flex items-center gap-3">
		<button
			type="button"
			class={PLAY_ROUND}
			aria-label={paused ? t().songs.page.listen.play : t().songs.page.listen.pause}
			onclick={ontoggle}
		>
			<Icon name={paused ? 'play' : 'pause'} filled />
		</button>
		{#if tab === 'grid' && gridBar}
			{@render gridBar()}
		{:else}
			<div class="min-w-0 flex-1 pt-3.5">
				<SeekBar
					label={t().songs.page.listen.position}
					value={now}
					{duration}
					{quietUntil}
					{onseek}
				/>
			</div>
		{/if}
	</div>
</BottomBar>

<Toast
	toast={toast && { id: toast.id, message: toast.message, action: toast.action }}
	onaction={() => toast?.undo?.()}
	ondismiss={() => (toast = null)}
	bottom="calc(6.5rem + var(--safe-bottom))"
/>
