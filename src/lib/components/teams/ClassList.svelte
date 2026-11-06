<script lang="ts">
	import { resolve } from '$app/paths';
	import ClassCodeField from '$lib/components/teams/ClassCodeField.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP } from '$lib/components/ui/styles';
	import { JOIN_STEP } from '$lib/levels/first-run';
	import { lastClassLine } from '$lib/teams/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { TeamItem } from '$lib/types';

	/**
	 * My class's list (Follow my class, levels spec "My class"): the person's
	 * classes in this dance, each with its name, when it last met and a dot while
	 * something in it is new. The phone's list page and the desktop's column
	 * beside the open class (`openId`: its row lit). In one class the tab opens
	 * the class itself and this list is not drawn.
	 *
	 * In none: Join your class, the code field (`joinAction`, the list route's
	 * explicit URL).
	 */
	let {
		teams,
		dance,
		openId,
		lastDays,
		today,
		joinAction
	}: {
		teams: (TeamItem & { newCount: number })[];
		dance: DanceSlug;
		openId: number | null;
		/** Each class's last class day, by group id; a class with none is left out. */
		lastDays: Record<number, string>;
		today: string;
		joinAction: string;
	} = $props();

	const classes = $derived(teams.filter((t) => t.deletedAt === null));
</script>

{#if classes.length === 0}
	<div class="flex flex-col gap-4 pt-2">
		<div class="flex flex-col gap-1 px-1">
			<h2 class="font-display text-[22px] leading-[1.15] font-extrabold text-ink">
				{JOIN_STEP.title}
			</h2>
			<p class="text-[15px] leading-[1.45] text-muted">{JOIN_STEP.subtitle}</p>
		</div>
		<div class="rounded-[22px] bg-surface px-4 pt-5 pb-4">
			<ClassCodeField action={joinAction} />
		</div>
		<p class="px-1 text-[13px] leading-[1.45] text-muted">{JOIN_STEP.or}</p>
	</div>
{:else}
	<ul class={GROUP} aria-label="Your classes">
		{#each classes as team (team.id)}
			{@const lit = team.id === openId}
			{@const fresh = team.newCount > 0}
			<li class:bg-accent-soft={lit}>
				<a
					href={resolve('/[dance]/groups/[id]', { dance, id: String(team.id) })}
					aria-current={lit ? 'page' : undefined}
					class="flex min-h-[72px] items-center gap-3 py-3 pr-3 pl-4 active:bg-step"
				>
					<span
						aria-hidden="true"
						class="relative flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
						><Icon name="group" size={24} />
						{#if fresh}
							<span
								class="absolute -top-0.5 -right-0.5 h-[10px] w-[10px] rounded-full bg-accent ring-2 ring-surface"
							></span>
						{/if}
					</span>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="truncate text-[16px] leading-[1.3] font-bold text-ink"
							>{team.name}{#if fresh}<span class="sr-only">, something new</span>{/if}</span
						>
						<span class="text-[13px] text-muted"
							>{lastClassLine(lastDays[team.id] ?? null, today)}</span
						>
					</span>
					<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
