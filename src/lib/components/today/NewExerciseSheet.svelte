<script lang="ts">
	import { enhance } from '$app/forms';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { DEFAULT_EVERY_DAYS, FREQUENCIES } from '$lib/frequency';

	interface Props {
		message: string | null;
		/** What was typed, handed back by a failed action. */
		values: { name?: string; notes?: string } | null;
		onclose: () => void;
	}

	let { message, values, onclose }: Props = $props();
	let busy = $state(false);

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
</script>

<Sheet title="New exercise" open={true} {onclose}>
	<form
		method="POST"
		action="?/createExercise"
		class="space-y-3"
		use:enhance={() => {
			busy = true;
			return async ({ update, result }) => {
				await update();
				busy = false;
				if (result.type === 'success') onclose();
			};
		}}
	>
		<label class="block">
			<span class={label}>Name</span>
			<input
				name="name"
				required
				maxlength="200"
				placeholder="e.g. Son basic, clave clapping"
				value={values?.name ?? ''}
				class={field}
			/>
		</label>
		<label class="block">
			<span class={label}>How often</span>
			<select name="everyDays" class={field} value={DEFAULT_EVERY_DAYS}>
				{#each FREQUENCIES as f (f.days)}
					<option value={f.days}>{f.label}</option>
				{/each}
			</select>
		</label>
		<label class="block">
			<span class={label}>Notes</span>
			<textarea name="notes" rows="2" maxlength="2000" class={field}>{values?.notes ?? ''}</textarea
			>
		</label>
		{#if message}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{message}
			</p>
		{/if}
		<button
			type="submit"
			disabled={busy}
			class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-60"
			>Add exercise</button
		>
	</form>
	<p class="mt-3 text-[12px] text-muted">
		Figures get an exercise automatically — add those from the Figures tab.
	</p>
</Sheet>
