<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import PickerField from '$lib/components/picker/PickerField.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, LABEL, ROW, TEXTAREA, button } from '$lib/components/ui/styles';
	import { nextRating } from '$lib/exercises/log-view';
	import { exerciseGroups } from '$lib/picker/build';
	import type { PickExercise } from '$lib/types';

	interface Props {
		/** The exercise the run was opened from, or null when opened from a song with none. */
		exercise: { id: number; name: string; line: string } | null;
		exercises: PickExercise[];
		/** "3:42 · 12 figures called · logged as a set" (`runSummary`). */
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
	}

	let { exercise, exercises, summary, durationS, run, fail, onclose }: Props = $props();

	let rating = $state<number | null>(fail?.rating ?? null);
	let busy = $state(false);
	let exerciseId = $state<number | null>(fail?.exerciseId ?? null);
	const formId = $props.id();
</script>

<Sheet title="Save this run" sub={summary} open={true} {onclose}>
	<form
		id={formId}
		method="POST"
		action="?/save"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'This run',
			// The run itself is what is unsaved, typed or not: ✕, the backdrop,
			// Escape and a navigation all ask. "Don't save" is the one way out
			// that does not, because it says so.
			dirty: () => true,
			submit: () => {
				busy = true;
				return async ({ update }) => {
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
				<span class={LABEL}>Exercise</span>
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
				label="Exercise"
				placeholder="Choose an exercise…"
				title="Choose an exercise"
				search="Search exercises"
				groups={exerciseGroups(exercises)}
				nothingLeft="No exercises yet."
				bind:value={exerciseId}
				required
			/>
		{/if}

		<fieldset>
			<legend class={LABEL}>How did it go?</legend>
			<input type="hidden" name="rating" value={rating ?? ''} />
			<div class="flex gap-2">
				{#each [1, 2, 3, 4, 5] as n (n)}
					<button
						type="button"
						aria-label="{n} of 5"
						aria-pressed={rating === n}
						onclick={() => (rating = nextRating(rating, n))}
						class="h-12 flex-1 cursor-pointer rounded-[14px] text-[17px] font-extrabold {rating !==
							null && n <= rating
							? 'bg-accent text-on-accent'
							: 'bg-surface text-ink-2 ring-1 ring-field-line ring-inset'}">{n}</button
					>
				{/each}
			</div>
		</fieldset>

		<label class="block">
			<span class={LABEL}>Note <span class="font-normal text-muted">(optional)</span></span>
			<textarea
				name="note"
				rows="2"
				maxlength="2000"
				placeholder="Anything to remember?"
				class={TEXTAREA}>{fail?.note ?? ''}</textarea
			>
		</label>

		{#if fail}
			<Banner kind="error" title={fail.message} />
		{/if}
	</form>

	{#snippet footer()}
		<div class="flex items-center gap-2">
			<button type="button" onclick={onclose} class={button('tertiary')}>Don’t save</button>
			<div class="flex flex-1">
				<button
					type="submit"
					form={formId}
					disabled={busy || (!exercise && exerciseId === null)}
					aria-busy={busy}
					class={button('primary', 'md', true)}
				>
					{#if busy}<Spinner />{:else}Save{/if}
				</button>
			</div>
		</div>
	{/snippet}
</Sheet>
