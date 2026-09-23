<script lang="ts">
	import { resolve } from '$app/paths';
	import ExerciseRow from '$lib/components/today/ExerciseRow.svelte';
	import LogSheet from '$lib/components/today/LogSheet.svelte';
	import NewExerciseSheet from '$lib/components/today/NewExerciseSheet.svelte';
	import { dayLabel, setSummary } from '$lib/format';
	import { timeOfDay } from '$lib/day/day';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let openId = $state<number | null>(null);
	let creating = $state(false);
	let showInactive = $state(false);

	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const rows = $derived([...data.plan.doneToday, ...data.plan.todo, ...data.plan.inactive]);
	const open = $derived(rows.find((r) => r.exercise.id === openId)?.exercise ?? null);
	const openSets = $derived(data.daySets.filter((s) => s.exerciseId === openId));

	/** A past day's sets, grouped by exercise in the order they were first done. */
	const pastGroups = $derived.by(() => {
		const groups: { exerciseId: number; name: string; sets: typeof data.daySets }[] = [];
		for (const s of [...data.daySets].reverse()) {
			let g = groups.find((x) => x.exerciseId === s.exerciseId);
			if (!g) groups.push((g = { exerciseId: s.exerciseId, name: s.exerciseName, sets: [] }));
			g.sets.push(s);
		}
		return groups;
	});

	const failure = (action: string) =>
		form && 'action' in form && form.action === action && 'message' in form
			? (form.message ?? null)
			: null;

	// updateExercise's fail() carries back what was typed (see +page.server.ts);
	// the ActionData union doesn't narrow that far on its own.
	const updateExerciseValues = $derived(
		form && 'action' in form && form.action === 'updateExercise' && 'practiceMode' in form
			? (form as unknown as { practiceMode: string; songId: string; countBpm: string })
			: null
	);
</script>

<svelte:head><title>{data.isToday ? 'Today' : dayLabel(data.day)} · Salsa</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve(`/?day=${data.prevDay}`)}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Previous day">‹</a
	>
	<div class="text-center">
		<h1 class="text-[17px] font-semibold">{data.isToday ? 'Today' : dayLabel(data.day)}</h1>
		{#if !data.isToday}
			<a href={resolve('/')} class="text-[12px] text-accent">Back to today</a>
		{:else}
			<p class="text-[12px] text-muted">{dayLabel(data.day)}</p>
		{/if}
	</div>
	{#if data.nextDay}
		<a
			href={data.nextDay === data.today ? resolve('/') : resolve(`/?day=${data.nextDay}`)}
			class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
			aria-label="Next day">›</a
		>
	{:else}
		<span class="grid size-11 place-items-center text-[22px] text-rule" aria-hidden="true">›</span>
	{/if}
</header>

<main class="px-4 pt-4">
	{#if data.isToday}
		{#if rows.length === 0}
			<div class="mt-10 text-center">
				<p class="text-[15px] font-medium">Nothing to practise yet.</p>
				<p class="mt-1 text-[13px] text-muted">
					Add a figure you learned, or a custom exercise below.
				</p>
				<a
					href={resolve('/figures?new=1')}
					class="mt-4 inline-block rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-accent-ink"
					>Add a figure</a
				>
			</div>
		{/if}

		{#if data.plan.doneToday.length > 0}
			<section aria-labelledby="done-h">
				<h2 id="done-h" class="mb-2 text-[12px] font-medium tracking-wide text-done uppercase">
					Done today
				</h2>
				<ul class="space-y-2">
					{#each data.plan.doneToday as row (row.exercise.id)}
						<ExerciseRow {row} variant="done" onopen={() => (openId = row.exercise.id)} />
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.plan.todo.length > 0}
			<section aria-labelledby="todo-h" class="mt-6 first:mt-0">
				<h2 id="todo-h" class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">
					To do
				</h2>
				<ul class="space-y-2">
					{#each data.plan.todo as row (row.exercise.id)}
						<ExerciseRow {row} variant="todo" onopen={() => (openId = row.exercise.id)} />
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.plan.inactive.length > 0}
			<section class="mt-6">
				<button
					type="button"
					class="mb-2 flex w-full items-center justify-between text-[12px] font-medium tracking-wide text-muted uppercase"
					aria-expanded={showInactive}
					onclick={() => (showInactive = !showInactive)}
				>
					<span>Inactive ({data.plan.inactive.length})</span>
					<span aria-hidden="true">{showInactive ? '−' : '+'}</span>
				</button>
				{#if showInactive}
					<ul class="space-y-2">
						{#each data.plan.inactive as row (row.exercise.id)}
							<ExerciseRow {row} variant="inactive" onopen={() => (openId = row.exercise.id)} />
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<button
			type="button"
			class="mt-6 mb-4 h-12 w-full rounded-xl border border-dashed border-rule text-[14px] font-medium text-ink-2"
			onclick={() => (creating = true)}>+ Custom exercise</button
		>
	{:else}
		{#if pastGroups.length === 0}
			<p class="mt-10 text-center text-[14px] text-muted">Nothing logged on this day.</p>
		{/if}
		<ul class="space-y-3">
			{#each pastGroups as g (g.exerciseId)}
				<li class="rounded-xl border border-done/30 bg-done-bg">
					<button
						type="button"
						class="w-full px-4 pt-3 pb-1 text-left text-[15px] font-medium"
						onclick={() => (openId = g.exerciseId)}>{g.name}</button
					>
					<ul class="px-4 pb-3">
						{#each g.sets as s (s.id)}
							<li class="flex gap-3 text-[13px] text-ink-2">
								<span class="text-muted tabular-nums">{timeOfDay(s.doneAt, timezone)}</span>
								<span>{setSummary(s) || 'Set'}{s.note ? ` — ${s.note}` : ''}</span>
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>

		<form
			class="mt-6 mb-4 rounded-xl border border-line bg-raised p-3"
			onsubmit={(e) => {
				e.preventDefault();
				const id = Number(new FormData(e.currentTarget).get('exerciseId'));
				if (id) openId = id;
			}}
		>
			<label for="forgot" class="mb-1 block text-[12px] font-medium text-ink-2"
				>Forgot to log something that day?</label
			>
			<div class="flex gap-2">
				<select
					id="forgot"
					name="exerciseId"
					class="min-w-0 flex-1 rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px]"
				>
					{#each data.exercises as e (e.id)}
						<option value={e.id}>{e.name}</option>
					{/each}
				</select>
				<button
					type="submit"
					class="rounded-lg bg-accent px-4 text-[14px] font-semibold text-accent-ink"
					>Add set</button
				>
			</div>
		</form>
	{/if}
</main>

{#if open}
	<LogSheet
		exercise={open}
		sets={openSets}
		songs={data.songs}
		backfillDay={data.isToday ? null : data.day}
		{timezone}
		message={failure('log') ?? failure('updateExercise') ?? failure('archiveExercise')}
		values={updateExerciseValues}
		onclose={() => (openId = null)}
	/>
{/if}

{#if creating}
	<NewExerciseSheet
		message={failure('createExercise')}
		values={form && 'name' in form ? { name: form.name, notes: form.notes } : null}
		onclose={() => (creating = false)}
	/>
{/if}
