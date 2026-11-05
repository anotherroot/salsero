<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import FrequencyField from '$lib/components/exercises/FrequencyField.svelte';
	import { button, FIELD, FIELD_ERROR, LABEL, TEXTAREA } from '$lib/components/ui/styles';
	import { DEFAULT_EVERY_DAYS } from '$lib/frequency';
	import type { DanceSlug } from '$lib/dances/dances';

	/*
	 * Rendered by the (today) layout, so it is on the page beside an open exercise
	 * too: it posts to Today's action by name (a bare `?/createExercise` would post
	 * to the exercise), and a refusal is read from the submit's result, since
	 * beside an exercise SvelteKit applies no `form` from another route.
	 */
	interface Props {
		dance: DanceSlug;
		/** The page form's refusal, on Today's own route. */
		message: string | null;
		/** What was typed, handed back by a failed action. */
		values: { name?: string; notes?: string } | null;
		onclose: () => void;
	}

	let { dance, message, values, onclose }: Props = $props();
	let busy = $state(false);
	// The last submit's refusal, from its result: shown when the page form has none.
	let refused = $state<string | null>(null);
	const error = $derived(message ?? refused);
	let everyDays = $state(DEFAULT_EVERY_DAYS);
</script>

<Sheet title="New exercise" open={true} {onclose}>
	<form
		id="new-exercise"
		method="POST"
		action="/{dance}?/createExercise"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'New exercise',
			submit: () => {
				busy = true;
				refused = null;
				return async ({ update, result }) => {
					try {
						if (result.type === 'failure') {
							const m = (result.data as { message?: unknown } | undefined)?.message;
							refused = typeof m === 'string' ? m : 'Could not add the exercise.';
						}
						await update();
						if (result.type === 'success') onclose();
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		<div>
			<label for="new-exercise-name" class={LABEL}>Name</label>
			<input
				id="new-exercise-name"
				name="name"
				required
				maxlength="200"
				placeholder="e.g. Son basic, clave clapping"
				value={values?.name ?? ''}
				class={FIELD}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={error ? 'new-exercise-error' : undefined}
			/>
			{#if error}
				<p id="new-exercise-error" class={FIELD_ERROR} role="alert">
					<Icon name="warning" size={16} />
					<span>{error}</span>
				</p>
			{/if}
		</div>
		<FrequencyField name="everyDays" bind:value={everyDays} />
		<label class="block">
			<span class={LABEL}>Notes<span class="font-normal text-muted">&nbsp;(optional)</span></span>
			<textarea name="notes" rows="3" maxlength="2000" class={TEXTAREA}
				>{values?.notes ?? ''}</textarea
			>
		</label>
	</form>
	{#snippet footer()}
		<button
			type="submit"
			form="new-exercise"
			class="{button('primary', 'md', true)} gap-2"
			aria-busy={busy}
			disabled={busy}
		>
			{#if busy}<Spinner size={18} />{/if}Add exercise
		</button>
		<p class="mx-1 mt-1 text-[13px] leading-snug text-muted">
			To practise a figure on its own, open it and tap Practise on its own.
		</p>
	{/snippet}
</Sheet>
