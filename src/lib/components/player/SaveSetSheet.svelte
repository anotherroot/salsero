<script lang="ts">
	import { untrack } from 'svelte';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import PickerField from '$lib/components/picker/PickerField.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, LABEL, ROW, TEXTAREA, button } from '$lib/components/ui/styles';
	import FaceRating from '$lib/components/exercises/FaceRating.svelte';
	import { feelOf, type Feel } from '$lib/schedule/feel';
	import { exerciseGroups } from '$lib/picker/build';
	import type { PickExercise } from '$lib/types';
	import { t } from '$lib/i18n/catalog';

	interface Props {
		/** The exercise the run was opened from, or null when opened from a song with none. */
		exercise: { id: number; name: string; line: string } | null;
		exercises: PickExercise[];
		/** "3:42 · 12 figures called" (`runSummary`). */
		summary: string;
		/** Posted as `durationS`. */
		durationS: number;
		/** `JSON.stringify({ speed, count, clave, callEvery, called })`. */
		run: string;
		/** A failure from the last save attempt, with what was entered. */
		fail: {
			message: string;
			exerciseId: number | null;
			rating: number | null;
			note: string;
		} | null;
		/** "Don't save": leaves without logging anything. */
		onclose: () => void;
		/** The run was logged: the page leaves (the save's own redirect is not followed). */
		onsaved: () => void;
	}

	let { exercise, exercises, summary, durationS, run, fail, onclose, onsaved }: Props = $props();

	// Seeded once from a failed save (a page reloaded without JS). While the
	// sheet stays mounted `fail` only echoes what these already hold, and
	// following it would undo a change made after the refusal.
	let feel = $state<Feel | null>(untrack(() => feelOf(fail?.rating ?? null)));
	let busy = $state(false);
	let exerciseId = $state<number | null>(untrack(() => fail?.exerciseId ?? null));
	const formId = $props.id();
	const w = $derived(t().player);
	const log = $derived(t().exercise.log);
</script>

<Sheet title={w.saveTitle} sub={summary} open={true} {onclose}>
	<form
		id={formId}
		method="POST"
		action="?/save"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: w.unsavedLabel,
			// The run itself is what is unsaved, typed or not: ✕, the backdrop,
			// Escape and a navigation all ask. "Don't save" is the one way out
			// that does not, because it says so.
			dirty: () => true,
			submit: () => {
				busy = true;
				return async ({ result, update }) => {
					// Logged: where the run goes next is the page's call (back to its
					// opener), not the action's redirect to Today.
					if (result.type === 'redirect') {
						onsaved();
						return;
					}
					await update();
					busy = false;
				};
			}
		}}
	>
		<input type="hidden" name="durationS" value={Math.round(durationS)} />
		<input type="hidden" name="run" value={run} />

		{#if exercise}
			<input type="hidden" name="exerciseId" value={exercise.id} />
			<div>
				<span class={LABEL}>{w.exercise}</span>
				<div class={GROUP}>
					<div class={ROW}>
						<span class="text-accent"><Icon name="check-circle" filled /></span>
						<div class="flex min-w-0 flex-col">
							<span class="text-[16px] font-bold text-ink">{exercise.name}</span>
							<span class="text-[13px] text-muted">{exercise.line}</span>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<PickerField
				name="exerciseId"
				label={w.exercise}
				placeholder={w.chooseExercise}
				title={w.chooseExerciseTitle}
				search={w.searchExercises}
				groups={exerciseGroups(exercises)}
				nothingLeft={w.noExercises}
				bind:value={exerciseId}
				required
			/>
		{/if}

		<FaceRating question={t().exercise.types.howItWent} value={feel} onchange={(f) => (feel = f)} />

		<label class="block">
			<span class={LABEL}
				>{log.note} <span class="font-normal text-muted">{log.optional}</span></span
			>
			<textarea
				name="note"
				rows="2"
				maxlength="2000"
				placeholder={w.notePlaceholder}
				class={TEXTAREA}>{fail?.note ?? ''}</textarea
			>
		</label>

		{#if fail}
			<Banner kind="error" title={fail.message} />
		{/if}
	</form>

	{#snippet footer()}
		<div class="flex items-center gap-2">
			<button type="button" onclick={onclose} class={button('tertiary')}>{w.dontSave}</button>
			<div class="flex flex-1">
				<button
					type="submit"
					form={formId}
					disabled={busy || feel === null || (!exercise && exerciseId === null)}
					aria-busy={busy}
					class={button('primary', 'md', true)}
				>
					{#if busy}<Spinner />{:else}{t().common.save}{/if}
				</button>
			</div>
		</div>
	{/snippet}
</Sheet>
