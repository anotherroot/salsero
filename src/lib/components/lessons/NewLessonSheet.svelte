<script lang="ts">
	import type { ActionResult } from '@sveltejs/kit';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import LessonFields from './LessonFields.svelte';
	import PickerField from '$lib/components/picker/PickerField.svelte';
	import { button } from '$lib/components/ui/styles';

	/** A refused create, as the action returns it: what was typed and why it was refused. */
	interface Refusal {
		field?: string;
		message?: string;
		title?: string;
		notes?: string;
		lessonDay?: string;
	}

	/** The New lesson sheet: the Lessons tab's and a group page's. */
	let {
		open,
		onclose,
		action,
		refusal,
		today,
		handle,
		places,
		submit = 'Create lesson'
	}: {
		open: boolean;
		onclose: () => void;
		/** Where the form posts, e.g. `?/create`. */
		action: string;
		/** This sheet's refusal, or null; the page decides whether an old one is this opening's. */
		refusal: Refusal | null;
		/** The newest day a class can have been, `YYYY-MM-DD`. */
		today: string;
		/**
		 * A page whose form is not on the action's own route (the Lessons layout's list)
		 * takes the result itself: a refusal never reaches `page.form` there. It runs
		 * `update()` for what it does not handle. Without it, the sheet just updates.
		 */
		handle?: (result: ActionResult, update: () => Promise<void>) => Promise<void>;
		/**
		 * Where it may go (the share page): Mine (value 0) and the groups the
		 * person edits. A Where field shows only with more than one place.
		 */
		places?: { value: number; label: string }[];
		/** The footer button's words. */
		submit?: string;
	} = $props();

	let where = $state<number | null>(0);

	let busy = $state(false);

	// A refusal that is about no one field goes at the top of the sheet.
	const otherError = $derived(refusal?.message && !refusal.field ? refusal.message : null);
	const errors = $derived(
		refusal?.field && refusal.message
			? { [refusal.field]: refusal.message }
			: ({} as Record<string, string>)
	);
</script>

<Sheet title="New lesson" {open} {onclose}>
	<form
		id="new-lesson"
		method="POST"
		{action}
		novalidate
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'New lesson',
			submit: ({ cancel }) => {
				// One lesson per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				return async ({ result, update }) => {
					try {
						if (handle) {
							await handle(result, () => update());
						} else await update();
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		{#if otherError}<Banner kind="error">{otherError}</Banner>{/if}

		<LessonFields
			autofocus
			lessonDay={refusal?.lessonDay ?? today}
			title={refusal?.title ?? ''}
			notes={refusal?.notes ?? null}
			max={today}
			{errors}
		/>
		{#if places && places.length > 1}
			<div>
				<PickerField
					name="teamId"
					label="Where"
					placeholder="Mine"
					title="Where"
					search="Search groups"
					groups={[
						{
							title: 'Places',
							entries: places.map((p) => ({
								key: `place:${p.value}`,
								value: p.value,
								label: p.label
							}))
						}
					]}
					nothingLeft="Nowhere else."
					bind:value={where}
					error={errors.teamId ?? null}
				/>
				<p class="mt-1.5 pl-1 text-[13px] text-muted">A group's lesson starts as a draft</p>
			</div>
		{/if}
	</form>

	{#snippet footer()}
		<button
			type="submit"
			form="new-lesson"
			class={button('primary', 'md', true)}
			aria-busy={busy}
			aria-label={busy ? 'Creating lesson' : undefined}
		>
			{#if busy}<Spinner />{:else}{submit}{/if}
		</button>
	{/snippet}
</Sheet>
