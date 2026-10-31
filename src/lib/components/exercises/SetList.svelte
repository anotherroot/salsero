<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { focusAfterRemoval } from '$lib/focus';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Stars from '$lib/components/ui/Stars.svelte';
	import { GROUP, iconButton } from '$lib/components/ui/styles';
	import { setMeta, setTitle } from '$lib/exercises/exercise-page';
	import { timeOfDay } from '$lib/day/day';
	import type { HistorySet } from '$lib/types';

	interface Props {
		sets: HistorySet[];
		timezone: string;
		/** The set is gone; `snapshot` puts it back (`restoreSet`). */
		ondeleted: (snapshot: string) => void;
		/** The delete was refused; the row is shown again. */
		onfailed: (message: string) => void;
	}

	let { sets, timezone, ondeleted, onfailed }: Props = $props();

	/** Rows deleted but not yet reloaded away: they go at the tap, not after the round trip. */
	let hiding = $state<number[]>([]);
	const shown = $derived(sets.filter((s) => !hiding.includes(s.id)));
</script>

<ul class={GROUP}>
	{#each shown as s (s.id)}
		{@const title = setTitle(s)}
		{@const time = timeOfDay(s.doneAt, timezone)}
		<li class="flex min-h-[60px] items-center gap-3 pr-1.5 pl-4">
			<div class="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
				<span class="text-[16px] leading-tight font-bold text-ink"
					>{title.text}{#if title.rating !== null}{title.text ? ' · ' : ''}<Stars
							rating={title.rating}
							size={14}
						/>{/if}</span
				>
				<span class="truncate text-[13px] text-muted">{setMeta(s, timezone)}</span>
			</div>
			<form
				method="POST"
				action="?/deleteSet"
				use:enhance={() => {
					const keys = sets.map((x) => `set-${x.id}`);
					hiding = [...hiding, s.id];
					return async ({ update, result }) => {
						await update();
						if (result.type === 'success') {
							ondeleted(String(result.data?.snapshot ?? ''));
							await focusAfterRemoval(keys, `set-${s.id}`, 'sets-add');
							return;
						}
						// A refusal ("already removed") reloads: the list shows what the server has.
						if (result.type === 'failure') await invalidateAll();
						hiding = hiding.filter((id) => id !== s.id);
						const m =
							result.type === 'failure'
								? (result.data as { message?: unknown } | undefined)?.message
								: undefined;
						onfailed(typeof m === 'string' ? m : 'Could not delete the set.');
					};
				}}
			>
				<input type="hidden" name="setId" value={s.id} />
				<button
					data-focus="set-{s.id}"
					type="submit"
					class={iconButton('bare', 'muted')}
					aria-label="Delete set logged at {time}"
				>
					<Icon name="trash" size={20} />
				</button>
			</form>
		</li>
	{/each}
</ul>
