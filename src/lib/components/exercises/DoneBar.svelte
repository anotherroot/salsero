<script lang="ts">
	import type { Snippet } from 'svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button, rowButton } from '$lib/components/ui/styles';
	import { doneBar } from '$lib/exercises/done-view';
	import { t } from '$lib/i18n/catalog';

	/*
	 * The exercise page's pinned ✓ Done (Done today once the day has an entry),
	 * waiting while a count plays. On the desktop it pins to the pane. `left`
	 * goes beside it (plan 3's Skip): then both are equal row buttons.
	 */
	interface Props {
		doneToday: boolean;
		/** A count or a song is playing: Done waits, and says so. */
		playing: boolean;
		/** A save without the sheet (a fixed rhythm) is out. */
		busy?: boolean;
		/** Done opens the sheet (false: a fixed rhythm saves at once). */
		sheet: boolean;
		/** A fixed rhythm in a run: the green Done · next (not once done today). */
		fixedInRun?: boolean;
		onclick: () => void;
		left?: Snippet;
	}

	let {
		doneToday,
		playing,
		busy = false,
		sheet,
		fixedInRun = false,
		onclick,
		left
	}: Props = $props();

	const view = $derived(doneBar({ doneToday, playing, fixedInRun }));
</script>

<BottomBar width="two">
	<div class="flex gap-2.5">
		{@render left?.()}
		<button
			type="button"
			data-focus="exercise-done"
			class={left ? rowButton(view.kind) : button(view.kind, 'md', true)}
			aria-haspopup={sheet ? 'dialog' : undefined}
			aria-busy={busy}
			disabled={view.disabled || busy}
			{onclick}
		>
			{#if busy}<Spinner /><span class="sr-only">{t().exercise.log.saving}</span>{:else}<Icon
					name="check"
					size={20}
					stroke={2.5}
				/>{view.label}{/if}
		</button>
	</div>
	{#if view.hint}
		<p class="pt-1.5 text-center text-[13px] font-semibold text-muted" role="status">
			{view.hint}
		</p>
	{/if}
</BottomBar>
