<script lang="ts">
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import { FIELD_ERROR, button } from '$lib/components/ui/styles';
	import Face from './Face.svelte';
	import { FEEL_TONE } from '$lib/exercises/face-view';
	import { feelWord } from '$lib/schedule/feel';
	import type { HistoryDay } from '$lib/exercises/exercise-page';
	import { t } from '$lib/i18n/catalog';

	/*
	 * One day of the history: what it holds (the time, the face, the note) and
	 * Delete this day. The delete is at once; the page's toast carries its Undo.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		/** The row opened; kept by the page while the sheet closes. */
		day: HistoryDay;
		exerciseId: number;
		/** Deleted: the day's rows as `restoreDay` takes them, and the day's label. */
		ondeleted: (snapshots: string, label: string) => void;
	}

	let { open, onclose, day, exerciseId, ondeleted }: Props = $props();

	let busy = $state(false);
	let refusal = $state<string | null>(null);

	// Each opening starts clean.
	$effect.pre(() => {
		if (open) refusal = null;
	});

	const messageOf = (data: unknown): string => {
		const m = (data as { message?: unknown } | undefined)?.message;
		return typeof m === 'string' ? m : t().exercise.refused.dayGone;
	};
</script>

<Sheet title={day.label} size="small" {open} {onclose}>
	<div class="flex flex-col gap-4">
		{#if day.amount || day.feel}
			<div class="flex items-center gap-3">
				{#if day.amount}
					<span class="font-display text-[22px] font-extrabold text-ink">{day.amount}</span>
				{/if}
				{#if day.feel}
					<span
						class="ml-auto inline-flex items-center gap-1.5 text-[15px] font-bold {FEEL_TONE[
							day.feel
						].text}"><Face feel={day.feel} size={22} />{feelWord(day.feel)}</span
					>
				{/if}
			</div>
		{/if}
		{#if day.note}
			<LinkedText
				text={day.note}
				class="text-[15px] leading-[1.45] whitespace-pre-line text-ink-2"
			/>
		{/if}
		<form
			method="POST"
			action="?/deleteDay"
			class="flex flex-col items-center"
			use:enhance={() => {
				busy = true;
				refusal = null;
				return async ({ result, update }) => {
					try {
						if (result.type === 'success') {
							await update();
							const snapshots = (result.data as { snapshots?: unknown } | undefined)?.snapshots;
							ondeleted(typeof snapshots === 'string' ? snapshots : '', day.label);
						} else if (result.type === 'failure') {
							// Shown here, from the submit's result: the page's `form` stays as it was.
							refusal = messageOf(result.data);
						} else {
							await update();
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			<input type="hidden" name="exerciseId" value={exerciseId} />
			<input type="hidden" name="day" value={day.day} />
			<button type="submit" class={button('danger-text')} aria-busy={busy} disabled={busy}
				>{t().exercise.page.deleteDay}</button
			>
			{#if refusal}
				<p class={FIELD_ERROR} role="alert">
					<Icon name="warning" size={16} filled />{refusal}
				</p>
			{/if}
		</form>
	</div>
</Sheet>
