<script lang="ts">
	import { onDestroy } from 'svelte';
	import { beatIndexAt, nearestBeat } from '$lib/beatgrid/beatgrid';
	import { button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import { createPlayer, type PlayerHandle } from '$lib/scheduler/attach';
	import { syntheticGrid } from '$lib/scheduler/scheduler';
	import { loadDelayCorrection } from '$lib/player/sound-delay';
	import { CHECK_BPM, CHECK_TAPS, saveTapDelay, tapDelayFrom } from '$lib/hearing/tap-delay';
	import ListenShell from './ListenShell.svelte';
	import TapPad from './TapPad.svelte';
	import { STAGE_SIGN } from './styles';

	/**
	 * The tap delay check: the voice counts 1–8 at a slow tempo, the person taps
	 * with each count, and the middle of how late the taps land is their delay.
	 * The count's own way to the ear is already in `songTime()` (count only, the
	 * screen waits for the sound), so what is left is the finger.
	 */
	interface Props {
		subtitle: string;
		/** The delay to use (saved), or null when skipped (0 for this visit). */
		ondone: (ms: number | null) => void;
		onback: () => void;
	}

	let { subtitle, ondone, onback }: Props = $props();
	const w = $derived(t().hearing);
	const grid = syntheticGrid(CHECK_BPM, 48);

	let player: PlayerHandle | null = null;
	let running = $state(false);
	let offsets = $state<number[]>([]);
	let count = $state<number | null>(null);
	let result = $state<{ ms: number; uneven: boolean } | null>(null);
	let raf = 0;

	function frame() {
		if (!player) return;
		const i = beatIndexAt(grid.beats, player.songTime());
		count = i >= 0 ? grid.counts[i] : null;
		raf = requestAnimationFrame(frame);
	}

	/** Runs inside the Start tap: nothing awaited before `start()` (iOS keeps audio locked otherwise). */
	function start() {
		offsets = [];
		result = null;
		const handle = createPlayer({
			audio: null,
			grid,
			toggles: { count: 'all', clave: null },
			voiceVolume: 1,
			delayCorrectionMs: loadDelayCorrection(),
			onStep: () => {},
			onEnd: () => stop()
		});
		player = handle;
		running = true;
		handle.start().catch((e) => {
			console.error(e);
			stop();
		});
		raf = requestAnimationFrame(frame);
	}

	function stop() {
		// Also runs on the server (onDestroy), where no frame was ever asked for.
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		player?.stop();
		player = null;
		running = false;
		count = null;
	}

	function tap(timeStamp: number) {
		if (!player) return;
		const at = player.songTime() - Math.max(0, performance.now() - timeStamp) / 1000;
		// The first two counts are for finding the beat, not for measuring.
		if (at < grid.beats[2] - 0.2) return;
		const i = nearestBeat(grid.beats, at);
		offsets = [...offsets, Math.round((at - grid.beats[i]) * 1000)];
		if (offsets.length >= CHECK_TAPS) {
			stop();
			result = tapDelayFrom(offsets);
		}
	}

	onDestroy(stop);
</script>

<ListenShell title={w.check.title} {subtitle} backLabel={w.back} onback={() => (stop(), onback())}>
	{#snippet stage()}
		<span class={STAGE_SIGN}>{count ?? '–'}</span>
		<p class="max-w-[300px] text-[15px] font-semibold text-band-small">
			{#if result}
				{result.uneven ? w.check.uneven : w.check.result(result.ms)}
			{:else if running}
				{w.check.progress(offsets.length, CHECK_TAPS)}
			{:else}
				{w.check.intro}
			{/if}
		</p>
	{/snippet}
	<TapPad label={w.check.tapWith} disabled={!running} ontap={tap} />
	{#snippet bar()}
		<div class="flex gap-2.5">
			{#if result && !result.uneven}
				<button type="button" class={button('secondary', 'lg')} onclick={start}
					>{w.check.again}</button
				>
				<div class="flex min-w-0 flex-1">
					<button
						type="button"
						class={button('primary', 'lg', true)}
						onclick={() => {
							saveTapDelay(result!.ms);
							ondone(result!.ms);
						}}>{w.check.save}</button
					>
				</div>
			{:else}
				<button
					type="button"
					class={button('secondary', 'lg')}
					onclick={() => (stop(), ondone(null))}>{w.check.skip}</button
				>
				<div class="flex min-w-0 flex-1">
					<button
						type="button"
						class={button('primary', 'lg', true)}
						disabled={running}
						onclick={start}>{result ? w.check.again : w.check.start}</button
					>
				</div>
			{/if}
		</div>
	{/snippet}
</ListenShell>
