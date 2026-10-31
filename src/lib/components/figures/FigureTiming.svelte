<script lang="ts">
	import { untrack } from 'svelte';
	import { COUNTS_PER_EIGHT, MAX_LENGTH_COUNTS } from '$lib/graph/timing';
	import { lengthError } from '$lib/figures/page';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { SHORTCUT, FIELD, LABEL } from '$lib/components/ui/styles';

	/**
	 * Which count a variation begins on, and how many counts it takes. Both are
	 * its own — a variation holds everything it is.
	 *
	 * Seeds its own state once, like `StartPositions`, so key it on the
	 * variation's id wherever it is rendered.
	 */
	let {
		startCount,
		lengthCounts
	}: {
		startCount: number;
		lengthCounts: number;
	} = $props();

	// Strings, so they bind to a radio group and a text input alike.
	let start = $state(untrack(() => String(startCount)));
	let length = $state(untrack(() => String(lengthCounts)));
	/** The check speaks only once the field has been typed in; it never blocks Save. */
	let touched = $state(false);
	const error = $derived(touched ? lengthError(length) : null);

	const counts = Array.from({ length: COUNTS_PER_EIGHT }, (_, i) => String(i + 1));
	const shortcuts = ['4', '8', '16'];
	const uid = $props.id();
</script>

<fieldset role="radiogroup" aria-label="Starts on">
	<legend class={LABEL}>Starts on</legend>
	<div class="flex gap-1">
		{#each counts as n (n)}
			<label
				class="flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl bg-surface text-[16px] font-extrabold text-ink shadow-[inset_0_0_0_1px_var(--color-field-line)] has-checked:bg-accent has-checked:text-on-accent has-checked:shadow-none has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
			>
				<input
					type="radio"
					name="startCount"
					value={n}
					required
					bind:group={start}
					class="sr-only"
				/>
				{n}
			</label>
		{/each}
	</div>
</fieldset>

<div>
	<label class={LABEL} for="{uid}-length">Counts</label>
	<div class="relative">
		<input
			id="{uid}-length"
			type="text"
			inputmode="numeric"
			name="lengthCounts"
			required
			bind:value={length}
			oninput={() => (touched = true)}
			class="{FIELD} pr-[76px]"
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${uid}-length-error` : `${uid}-length-help`}
		/>
		<span
			class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] font-semibold text-muted"
			aria-hidden="true">counts</span
		>
	</div>
	{#if error}
		<FieldError id="{uid}-length-error" message={error} />
	{:else}
		<p id="{uid}-length-help" class="mt-1.5 pl-1 text-[13px] text-muted">
			How long it takes, 1 to {MAX_LENGTH_COUNTS}. One 8-count is 8.
		</p>
	{/if}
	<div class="mt-1 flex flex-wrap gap-2" role="group" aria-label="Length shortcuts">
		{#each shortcuts as n (n)}
			<button
				type="button"
				aria-pressed={length.trim() === n}
				aria-label="{n} counts"
				onclick={() => (length = n)}
				class={SHORTCUT}>{n}</button
			>
		{/each}
	</div>
</div>
