<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import SetList from '$lib/components/exercises/SetList.svelte';
	import { contentFor } from '$lib/components/exercises/kinds';
	import { FIELD, LABEL } from '$lib/components/ui/styles';
	import { FREQUENCIES } from '$lib/frequency';
	import { dayLabel, dateLabel } from '$lib/format';
	import { localDay } from '$lib/day/day';
	import { TYPES, typeOf } from '$lib/exercises/kinds';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const exercise = $derived(data.exercise);
	const type = $derived(typeOf(exercise.source));
	const Content = $derived(contentFor(type));
	/** A drill is the only type this page may rename or archive: the others belong to their owner. */
	const ownsItself = $derived(type === 'drill');
	const timezone = $derived(data.user?.timezone ?? 'Europe/Ljubljana');
	const failure = (action: string) =>
		form && 'action' in form && form.action === action && 'message' in form
			? String(form.message)
			: null;

	/** The owner this exercise belongs to, named from the content the server already sent. */
	const owner = $derived.by(() => {
		const c = data.practice.content;
		const dance = data.dance.slug;
		if (c.type === 'figure')
			return {
				label: `Figure · ${c.figure.name}`,
				href: resolve('/[dance]/figures/[id]', { dance, id: String(c.figure.id) })
			};
		if (c.type === 'lesson')
			return {
				label: `Lesson · ${dateLabel(c.lesson.lessonDay)}`,
				href: resolve('/[dance]/lessons/[id]', { dance, id: String(c.lesson.id) })
			};
		if (c.type === 'routine')
			return {
				label: `Routine · ${c.routine.name}`,
				href: resolve('/[dance]/routines/[id]', { dance, id: String(c.routine.id) })
			};
		return null;
	});

	/** History grouped by calendar day in the user's zone, newest day first. */
	const days = $derived.by(() => {
		const groups: { day: string; sets: typeof data.history }[] = [];
		for (const s of data.history) {
			const day = localDay(s.doneAt, timezone);
			const last = groups.at(-1);
			if (last && last.day === day) last.sets.push(s);
			else groups.push({ day, sets: [s] });
		}
		return groups;
	});

	const hours = (s: number) => {
		const m = Math.round(s / 60);
		return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
	};
</script>

<svelte:head><title>{exercise.name} · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/[dance]', { dance: data.dance.slug })}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to Today">‹</a
	>
	<div class="min-w-0 flex-1">
		<h1 class="truncate text-[17px] font-semibold">{exercise.name}</h1>
		<p class="text-[12px] text-muted">{TYPES[type].label}</p>
	</div>
</header>

<main class="space-y-6 px-4 pt-4 pb-6">
	{#if owner}
		<a href={owner.href} class="block text-[14px] font-medium text-accent">{owner.label} →</a>
	{/if}

	<Content
		dance={data.dance}
		content={data.practice.content}
		editLinks={{
			message: failure('addLink'),
			entered: form && 'urls' in form ? String(form.urls) : ''
		}}
	/>

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">History</h2>
		{#if data.summary.sets === 0}
			<p class="text-[13px] text-muted">Nothing logged yet.</p>
		{:else}
			<p class="mb-3 text-[13px] text-ink-2">
				{data.summary.sets}
				{data.summary.sets === 1 ? 'set' : 'sets'}{data.summary.totalS > 0
					? ` · ${hours(data.summary.totalS)}`
					: ''}{data.summary.recentRating !== null
					? ` · recent ★ ${data.summary.recentRating}`
					: ''}
			</p>
			<div class="space-y-3">
				{#each days as g (g.day)}
					<div>
						<h3 class="mb-1 text-[12px] text-muted">{dayLabel(g.day)}</h3>
						<SetList sets={g.sets} {timezone} />
					</div>
				{/each}
			</div>
			{#if data.history.length < data.summary.sets}
				<p class="mt-2 text-[12px] text-muted">Showing the latest {data.history.length}.</p>
			{/if}
		{/if}
	</section>

	<section>
		<h2 class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Settings</h2>
		<form
			method="POST"
			action="?/update"
			use:enhance={() =>
				async ({ update }) =>
					update({ reset: false })}
			class="space-y-3"
		>
			{#if ownsItself}
				<label class="block">
					<span class={LABEL}>Name</span>
					<input name="name" required maxlength="200" value={exercise.name} class={FIELD} />
				</label>
			{/if}
			<label class="block">
				<span class={LABEL}>How often</span>
				<select name="everyDays" class={FIELD} value={exercise.everyDays}>
					{#each FREQUENCIES as f (f.days)}
						<option value={f.days}>{f.label}</option>
					{/each}
				</select>
			</label>
			<label class="flex items-center gap-3 text-[14px]">
				<input type="checkbox" name="active" checked={exercise.active} class="size-5" />
				Active — show it in the to-do list
			</label>
			<label class="block">
				<span class={LABEL}>{ownsItself ? 'Description' : 'Practice notes'}</span>
				<textarea name="notes" rows="3" maxlength="2000" class={FIELD}
					>{exercise.notes ?? ''}</textarea
				>
			</label>
			{#if failure('update')}
				<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
					{failure('update')}
				</p>
			{/if}
			<button
				type="submit"
				class="h-11 w-full rounded-xl border border-rule text-[14px] font-medium"
				>Save settings</button
			>
		</form>
		{#if ownsItself}
			<form method="POST" action="?/archive" class="mt-3">
				<button type="submit" class="h-10 text-[14px] text-danger">Archive exercise</button>
			</form>
			{#if failure('archive')}<p class="text-[13px] text-danger">{failure('archive')}</p>{/if}
		{/if}
	</section>
</main>
