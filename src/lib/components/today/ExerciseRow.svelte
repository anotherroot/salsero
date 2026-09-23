<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PlanRow } from '$lib/urgency/urgency';
	import type { ExerciseItem } from '$lib/types';
	import { lastDoneLabel } from '$lib/format';
	import { frequencyLabel } from '$lib/frequency';

	interface Props {
		row: PlanRow<ExerciseItem>;
		variant: 'done' | 'due' | 'upcoming' | 'inactive';
		onopen: () => void;
	}

	let { row, variant, onopen }: Props = $props();
	let pending = $state(false);

	const ex = $derived(row.exercise);
	const badge = $derived(
		ex.source === 'figure'
			? ex.partner === 'solo'
				? 'Figure · solo'
				: 'Figure · partner'
			: ex.source === 'choreography'
				? 'Choreo'
				: 'Custom'
	);
</script>

<li
	class="flex items-stretch overflow-hidden rounded-xl border {variant === 'done'
		? 'border-done/30 bg-done-bg'
		: 'border-line bg-raised'} {variant === 'inactive'
		? 'opacity-60'
		: variant === 'upcoming'
			? 'opacity-75'
			: ''}"
>
	<button type="button" class="min-w-0 flex-1 px-4 py-3 text-left" onclick={onopen}>
		<span class="block truncate text-[15px] font-medium">{ex.name}</span>
		<span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
			<span>{badge}</span>
			<span aria-hidden="true">·</span>
			{#if variant === 'done'}
				<span class="font-medium text-done"
					>{row.setsToday} {row.setsToday === 1 ? 'set' : 'sets'} today</span
				>
			{:else}
				<!-- In the due band `overdue` is true by construction. -->
				<span class={variant === 'due' ? 'font-medium text-overdue' : ''}
					>{lastDoneLabel(row.lastDoneDaysAgo)}</span
				>
				<span aria-hidden="true">·</span>
				<span>{frequencyLabel(ex.everyDays)}</span>
			{/if}
		</span>
	</button>

	<!-- One tap logs a bare set: the fast path while cooking. Details live in the sheet. -->
	<form
		method="POST"
		action="?/log"
		class="flex"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				await update({ reset: false });
				pending = false;
			};
		}}
	>
		<input type="hidden" name="exerciseId" value={ex.id} />
		<button
			type="submit"
			disabled={pending}
			aria-label="Log a set of {ex.name}"
			class="grid w-14 place-items-center border-l text-[22px] font-light {variant === 'done'
				? 'border-done/30 text-done'
				: 'border-line text-accent'} disabled:opacity-40">+</button
		>
	</form>
</li>
