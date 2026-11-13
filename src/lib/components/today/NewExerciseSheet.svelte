<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import WarmupRow from '$lib/components/exercises/WarmupRow.svelte';
	import ComesBackCard from '$lib/components/exercises/ComesBackCard.svelte';
	import { button, FIELD, FIELD_ERROR, LABEL, TEXTAREA } from '$lib/components/ui/styles';
	import { DANCES, type DanceSlug } from '$lib/dances/dances';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import HearingSwitch from '$lib/components/hearing/HearingSwitch.svelte';
	import type { PickerSong } from '$lib/types';
	import { t } from '$lib/i18n/catalog';

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
		/** The person's daily number: the Warm-up line says it doesn't count toward it. */
		daily: number;
		/** Follow my class has no Comes back. */
		simple: boolean;
		/** What a hearing drill's songs are picked from (phase 2). */
		songs: PickerSong[];
		/** Opened from a song page's Naredi vajo: Sluh, that song picked. */
		preset?: { songId: number } | null;
		onclose: () => void;
	}

	let { dance, message, values, daily, simple, songs, preset = null, onclose }: Props = $props();
	let hearing = $state(untrack(() => preset !== null));
	let busy = $state(false);
	let warmup = $state(false);
	// The last submit's refusal, from its result: shown when the page form has none.
	let refused = $state<string | null>(null);
	const error = $derived(message ?? refused);
</script>

<Sheet title={t().today.newExercise.title} open={true} {onclose}>
	<form
		id="new-exercise"
		method="POST"
		action="/{dance}?/createExercise"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: t().today.newExercise.title,
			submit: () => {
				busy = true;
				refused = null;
				return async ({ update, result }) => {
					try {
						if (result.type === 'failure') {
							const m = (result.data as { message?: unknown } | undefined)?.message;
							refused = typeof m === 'string' ? m : t().today.refused.addExercise;
						}
						await update();
						if (result.type !== 'success') return;
						onclose();
						// A hearing drill opens on its page: Začni is there.
						const id = (result.data as { id?: unknown } | undefined)?.id;
						if (hearing && typeof id === 'number') void goto(resolve(`/${dance}/exercises/${id}`));
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		<HearingSwitch dance={DANCES[dance]} choices={songs} bind:hearing part="switch" />
		<div>
			<label for="new-exercise-name" class={LABEL}>{t().today.newExercise.name}</label>
			<input
				id="new-exercise-name"
				name="name"
				required
				maxlength="200"
				placeholder={t().today.newExercise.placeholder}
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
		<HearingSwitch
			dance={DANCES[dance]}
			choices={songs}
			picked={preset ? [preset.songId] : []}
			bind:hearing
			part="fields"
		/>
		<label class="block">
			<span class={LABEL}
				>{t().today.newExercise.notes}<span class="font-normal text-muted"
					>&nbsp;{t().today.newExercise.optional}</span
				></span
			>
			<textarea name="notes" rows="3" maxlength="2000" class={TEXTAREA}
				>{values?.notes ?? ''}</textarea
			>
		</label>
		<WarmupRow bind:checked={warmup} {daily} />
		{#if !simple}
			<ComesBackCard
				sheet
				value={{ kind: 'faces' }}
				own={null}
				teacher={null}
				forClass={false}
				good={null}
			/>
		{/if}
	</form>
	{#snippet footer()}
		<button
			type="submit"
			form="new-exercise"
			class="{button('primary', 'md', true)} gap-2"
			aria-busy={busy}
			disabled={busy}
		>
			{#if busy}<Spinner size={18} />{/if}{t().today.newExercise.add}
		</button>
		<p class="mx-1 mt-1 text-[13px] leading-snug text-muted">
			{t().today.newExercise.hint}
		</p>
	{/snippet}
</Sheet>
