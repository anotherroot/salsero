<!-- src/lib/components/lessons/UnlinkVia.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { spotTime } from '$lib/video/spots';
	import type { ViaSection } from '$lib/types';

	/**
	 * Unlink, from the lesson, a variation or drill that is there through a
	 * section of its videos. Keeping the section link would keep it on the
	 * lesson, so the only Unlink offered takes both — after asking.
	 */
	interface Props {
		/** The form action: `?/unlinkFigure` or `?/unlinkExercise`. */
		action: string;
		/** The posted id field and its value: `figureId` or `exerciseId`. */
		name: string;
		id: number;
		label: string;
		via: ViaSection[];
		onclose: () => void;
	}

	let { action, name, id, label, via, onclose }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();
	onMount(() => dialog?.showModal());

	const ranges = $derived(via.map((s) => `${spotTime(s.startMs)}–${spotTime(s.endMs)}`).join(', '));
</script>

<dialog
	bind:this={dialog}
	aria-label="Unlink {label}"
	{onclose}
	onclick={(e) => {
		if (e.target === dialog) onclose();
	}}
>
	<div class="p-4">
		<p class="text-[15px]">
			<b>{label}</b> is linked through {via.length === 1 ? 'section' : 'sections'}
			{ranges}. Unlink it from the lesson and the {via.length === 1 ? 'section' : 'sections'}?
		</p>
		<form
			method="POST"
			{action}
			class="mt-4 flex flex-col gap-2"
			use:enhance={() =>
				async ({ update }) => {
					await update();
					onclose();
				}}
		>
			<input type="hidden" {name} value={id} />
			<input type="hidden" name="alsoSections" value="1" />
			<button type="submit" class="h-11 rounded-xl bg-danger text-[15px] font-semibold text-white"
				>Unlink</button
			>
			<button type="button" class="h-11 text-[14px] font-medium text-muted" onclick={onclose}
				>Cancel</button
			>
		</form>
	</div>
</dialog>

<style>
	dialog {
		margin: auto;
		width: calc(100% - 32px);
		max-width: 420px;
		padding: 0;
		border: none;
		border-radius: 18px;
		background: var(--color-surface);
		color: var(--color-ink);
		box-shadow: 0 16px 40px rgb(0 0 0 / 0.25);
	}
	dialog::backdrop {
		background: rgb(20 18 16 / 0.45);
	}
</style>
