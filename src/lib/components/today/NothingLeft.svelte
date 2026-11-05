<script lang="ts">
	import { resolve } from '$app/paths';
	import TypeTile from '$lib/components/ui/TypeTile.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { CLIP, button } from '$lib/components/ui/styles';
	import { nothingLeftMeta } from '$lib/exercises/today';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { ExerciseItem } from '$lib/types';

	/**
	 * Nothing left to pull today (board "Nothing left"): what comes back first,
	 * "Dile que no · Tomorrow · and 3 more". The row opens that exercise.
	 */
	let {
		next,
		dance,
		today
	}: {
		next: { next: ExerciseItem; day: string; more: number };
		dance: DanceSlug;
		today: string;
	} = $props();

	const href = $derived(
		resolve('/[dance]/(today)/exercises/[id]', { dance, id: String(next.next.id) })
	);
</script>

<section aria-labelledby="next-up-h" class="{CLIP} rounded-2xl bg-surface">
	<h2 id="next-up-h" class="px-4 pt-3 text-[13px] font-bold text-muted">Next up</h2>
	<a {href} class="flex min-h-[58px] items-center gap-3 px-4 pt-1.5 pb-3">
		<TypeTile exercise={next.next} tone="accent" />
		<span class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] leading-[1.3] font-bold break-words text-ink">{next.next.name}</span>
			<span class="text-[13px] leading-[1.35] text-muted">{nothingLeftMeta(next, today)}</span>
		</span>
	</a>
	<div class="px-4 pb-3">
		<a
			href={resolve('/[dance]/(today)/coming-up', { dance })}
			class={button('secondary', 'md', true)}><Icon name="calendar" size={20} />See what's coming</a
		>
	</div>
</section>
