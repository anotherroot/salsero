<script lang="ts">
	import { resolve } from '$app/paths';
	import { actAt } from '$lib/act';
	import { refusalMessage } from '$lib/act-toast';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import TypeTile from '$lib/components/ui/TypeTile.svelte';
	import { GROUP, SECTION_LABEL, iconButton } from '$lib/components/ui/styles';
	import { comingHeading } from '$lib/schedule/coming-view';
	import type { ComingGroup } from '$lib/schedule/coming-up';
	import type { PickReply } from '$lib/schedule/picks';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { ExerciseItem } from '$lib/types';

	/**
	 * Coming up (boards "Coming up", "Today after adding"): every exercise by the
	 * day it comes back. A group per day, "Waiting" first (due, past the daily
	 * number) and "Paused" last. A row opens the exercise; its + puts it on Today
	 * for today (`pick`, kind add) and the layout's toast offers Undo.
	 */
	let {
		groups,
		dance,
		today,
		currentId,
		onadded,
		onrefused
	}: {
		groups: ComingGroup<ExerciseItem>[];
		dance: DanceSlug;
		today: string;
		/** The exercise open beside the list (desktop). */
		currentId: number | null;
		/** Added: the layout's "<name> is on Today · Undo" toast, from the action's reply. */
		onadded: (exercise: ExerciseItem, reply: PickReply) => void;
		onrefused: (message: string) => void;
	} = $props();

	let busy = $state(new Set<number>());
	const plus = iconButton('bare', 'accent');

	async function add(exercise: ExerciseItem) {
		if (busy.has(exercise.id)) return;
		busy = new Set([...busy, exercise.id]);
		try {
			const result = await actAt(`/${dance}`, 'pick', { exerciseId: exercise.id, kind: 'add' });
			const message = refusalMessage(result, 'Could not add it to Today. Try again.');
			if (message) onrefused(message);
			else {
				onadded(exercise, (result as { data?: PickReply }).data ?? {});
			}
		} finally {
			busy = new Set([...busy].filter((id) => id !== exercise.id));
		}
	}

	const href = (id: number) =>
		resolve('/[dance]/(today)/exercises/[id]', { dance, id: String(id) });
</script>

{#if groups.length === 0}
	<p class="px-4 pt-6 text-center text-[15px] text-muted">Nothing is coming up yet.</p>
{/if}

{#each groups as group (group.key)}
	{@const head = comingHeading(group, today)}
	<section aria-labelledby="coming-{group.key}" class="flex flex-col gap-2 pt-3.5 first:pt-0">
		<h2 id="coming-{group.key}" class="flex items-baseline justify-between {SECTION_LABEL}">
			<span>{head.title}</span>
			{#if head.away}<span class="font-semibold">{head.away}</span>{/if}
		</h2>
		<ul class={GROUP}>
			{#each group.rows as row (row.exercise.id)}
				{@const ex = row.exercise}
				{@const lit = ex.id === currentId}
				<li
					class="flex min-h-[66px] items-center pr-1.5 pl-4 {lit
						? 'bg-accent-soft shadow-[inset_4px_0_0_var(--color-accent)]'
						: ''}"
				>
					<a
						href={href(ex.id)}
						aria-current={lit ? 'page' : undefined}
						class="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1"
					>
						<TypeTile
							exercise={ex}
							tone={row.state === 'doneToday'
								? 'done'
								: row.state === 'paused'
									? 'quiet'
									: 'accent'}
							onTint={lit}
						/>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="text-[16px] leading-[1.3] font-bold break-words text-ink">{ex.name}</span
							>
							{#if row.state === 'skipped'}
								<span class="text-[13px] leading-[1.35] {lit ? 'text-ink-2' : 'text-muted'}"
									>Not today</span
								>
							{/if}
						</span>
					</a>
					{#if row.state === 'add' || row.state === 'skipped'}
						<button
							type="button"
							class={plus}
							disabled={busy.has(ex.id)}
							aria-busy={busy.has(ex.id)}
							aria-label="Put {ex.name} on Today"
							onclick={() => add(ex)}
						>
							{#if busy.has(ex.id)}<Spinner size={20} />{:else}<Icon name="plus" />{/if}
						</button>
					{:else if row.state === 'onToday'}
						<span class="pr-2.5"><Badge tone="done">On Today</Badge></span>
					{:else if row.state === 'doneToday'}
						<span class="pr-2.5 text-[13px] font-bold text-done">Done today</span>
					{:else}
						<span class="pr-2.5 text-[13px] font-bold {lit ? 'text-ink-2' : 'text-muted'}"
							>Paused</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/each}
