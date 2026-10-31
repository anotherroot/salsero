<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import FrequencyField from '$lib/components/exercises/FrequencyField.svelte';
	import { button, FIELD, FIELD_ERROR, LABEL, TEXTAREA } from '$lib/components/ui/styles';
	import { DEFAULT_EVERY_DAYS } from '$lib/frequency';

	interface Props {
		message: string | null;
		/** What was typed, handed back by a failed action. */
		values: { name?: string; notes?: string } | null;
		onclose: () => void;
	}

	let { message, values, onclose }: Props = $props();
	let busy = $state(false);
	let everyDays = $state(DEFAULT_EVERY_DAYS);
</script>

<Sheet title="New exercise" open={true} {onclose}>
	<form
		id="new-exercise"
		method="POST"
		action="?/createExercise"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'New exercise',
			submit: () => {
				busy = true;
				return async ({ update, result }) => {
					await update();
					busy = false;
					if (result.type === 'success') onclose();
				};
			}
		}}
	>
		<label class="block">
			<span class={LABEL}>Name</span>
			<input
				name="name"
				required
				maxlength="200"
				placeholder="e.g. Son basic, clave clapping"
				value={values?.name ?? ''}
				class={FIELD}
				aria-invalid={message ? 'true' : undefined}
				aria-describedby={message ? 'new-exercise-error' : undefined}
			/>
			{#if message}
				<p id="new-exercise-error" class={FIELD_ERROR} role="alert">
					<Icon name="warning" size={16} />
					<span>{message}</span>
				</p>
			{/if}
		</label>
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
