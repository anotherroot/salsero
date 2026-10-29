<!-- src/lib/components/video/PlayerSheet.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { MAX_SPOT_LABEL } from '$lib/limits';
	import { spotLabel } from '$lib/video/spots';
	import type { PlayerSheet } from '$lib/video/screens';
	import type { Spot } from '$lib/types';
	import { BTN, BTN_ACCENT, BTN_DANGER_FILL } from './styles';

	/**
	 * A bottom sheet inside the player's stage — not a second `<dialog>`: one
	 * opened inside browser fullscreen is not reliably drawn above it. Nothing
	 * here takes focus by itself, so the phone's keyboard opens only when the
	 * name field is tapped.
	 */
	interface Props {
		kind: Exclude<PlayerSheet, 'list'>;
		spot: Spot | null;
		/** A refusal from the server (a 409 on delete), shown in the sheet. */
		message: string | null;
		oncancel: () => void;
		onrename: (label: string) => void;
		ondelete: () => void;
	}

	let { kind, spot, message, oncancel, onrename, ondelete }: Props = $props();

	let label = $state(untrack(() => spot?.label ?? ''));
	const linked = $derived((spot?.linkedTo.length ?? 0) > 0);

	const KEYS: [string, string][] = [
		['Space', 'play / pause'],
		['← →', '1 s back / on'],
		[', .', '0.1 s back / on'],
		['M', 'mark a point (full video)'],
		['S', 'start / end a section (full video)'],
		['I O', 'set the start / end to now (editor)'],
		['[ ]', 'jump to the start / the last 2 s'],
		['L', 'pause / resume the loop (editor)'],
		['Esc', 'back one level'],
		['?', 'these keys']
	];
</script>

<div class="absolute inset-0 z-40">
	<button
		type="button"
		aria-label="Cancel"
		class="absolute inset-0 cursor-default bg-black/60"
		onclick={oncancel}
	></button>
	<div
		role="dialog"
		aria-label={kind === 'rename' ? 'Rename' : kind === 'delete' ? 'Delete' : 'Keys'}
		class="absolute inset-x-0 bottom-0 mx-auto flex max-w-lg flex-col gap-3 rounded-t-[22px] bg-(--pl-sheet) px-5 pt-3 pb-[max(env(safe-area-inset-bottom),28px)]"
	>
		<span class="mb-1 h-1 w-10 self-center rounded-full bg-(--pl-tick)"></span>

		{#if kind === 'rename' && spot}
			<form
				class="flex flex-col gap-3"
				onsubmit={(e) => {
					e.preventDefault();
					onrename(label);
				}}
			>
				<label for="spot-name" class="text-[18px] font-semibold">Name</label>
				<input
					id="spot-name"
					type="text"
					maxlength={MAX_SPOT_LABEL}
					placeholder={spotLabel({ ...spot, label: null })}
					bind:value={label}
					class="h-12 w-full rounded-xl border border-(--pl-tick) bg-(--pl-bg) px-3.5 text-[16px] text-(--pl-ink) outline-none focus:border-(--pl-accent)"
				/>
				<div class="mt-1.5 flex gap-2">
					<button type="button" class="{BTN} h-12 flex-1" onclick={oncancel}>Cancel</button>
					<button type="submit" class="{BTN_ACCENT} h-12 flex-1">Save</button>
				</div>
			</form>
		{:else if kind === 'delete' && spot}
			<span class="text-[18px] font-semibold">Delete “{spotLabel(spot)}”?</span>
			<span class="text-[14px] text-(--pl-muted) tabular-nums"
				>{spotLabel({ ...spot, label: null })}</span
			>
			{#if linked}
				<p class="rounded-xl bg-(--pl-hover) p-3 text-[14px] leading-snug">
					Linked to <b>{spot.linkedTo.join(', ')}</b>. Unlink it there first; until then this
					section stays.
				</p>
			{/if}
			{#if message}
				<p role="alert" class="rounded-xl bg-(--pl-hover) p-3 text-[14px] leading-snug">
					{message}
				</p>
			{/if}
			<div class="mt-1.5 flex gap-2">
				<button type="button" class="{BTN} h-12 flex-1" onclick={oncancel}>Keep it</button>
				<button
					type="button"
					class="{BTN_DANGER_FILL} h-12 flex-1"
					disabled={linked}
					onclick={ondelete}>Delete</button
				>
			</div>
		{:else if kind === 'keys'}
			<span class="text-[18px] font-semibold">Keys</span>
			<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[14px]">
				{#each KEYS as [k, what] (k)}
					<dt class="font-semibold tabular-nums">{k}</dt>
					<dd class="text-(--pl-muted)">{what}</dd>
				{/each}
			</dl>
			<button type="button" class="{BTN} mt-1.5 h-12" onclick={oncancel}>Close</button>
		{/if}
	</div>
</div>
