<script lang="ts">
	import type { ActionResult } from '@sveltejs/kit';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import LessonFields from './LessonFields.svelte';
	import FrequencyField from '$lib/components/exercises/FrequencyField.svelte';
	import { button } from '$lib/components/ui/styles';
	import { DEFAULT_EVERY_DAYS } from '$lib/frequency';

	/** A refused create, as the action returns it: what was typed and why it was refused. */
	interface Refusal {
		field?: string;
		message?: string;
		title?: string;
		notes?: string;
		lessonDay?: string;
	}

	/**
	 * The New lesson sheet: the Lessons tab's and a group page's. A person's
	 * lesson asks how often to go over it (its review on Today); a group's does
	 * not — `frequency` off — since each member's Add makes their own.
	 */
	let {
		open,
		onclose,
		action,
		refusal,
		today,
		frequency = true,
		handle
	}: {
		open: boolean;
		onclose: () => void;
		/** Where the form posts, e.g. `?/create`. */
		action: string;
		/** This sheet's refusal, or null; the page decides whether an old one is this opening's. */
		refusal: Refusal | null;
		/** The newest day a class can have been, `YYYY-MM-DD`. */
		today: string;
		frequency?: boolean;
		/**
		 * A page whose form is not on the action's own route (the Lessons layout's list)
		 * takes the result itself: a refusal never reaches `page.form` there. It runs
		 * `update()` for what it does not handle. Without it, the sheet just updates.
		 */
		handle?: (result: ActionResult, update: () => Promise<void>) => Promise<void>;
	} = $props();

	let busy = $state(false);
	let everyDays = $state(DEFAULT_EVERY_DAYS);

	// The sheet outlives its page (the Lessons layout's): each opening starts fresh, as a
	// remounted page's did. The form's fields unmount with the closed Sheet; this is the rest.
	$effect(() => {
		if (open) everyDays = DEFAULT_EVERY_DAYS;
	});

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

		{#if frequency}
			<div class="flex flex-col gap-1.5">
				<FrequencyField name="everyDays" label="Go over it again" bind:value={everyDays} />
				<p class="pl-1 text-[13px] text-muted">
					Puts “Review: …” on Today; lower it as it settles.
				</p>
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
			{#if busy}<Spinner />{:else}Create lesson{/if}
		</button>
	{/snippet}
</Sheet>
