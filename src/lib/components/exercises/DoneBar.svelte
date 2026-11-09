<script lang="ts">
	import type { Snippet } from 'svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button, rowButton } from '$lib/components/ui/styles';
	import { doneBar } from '$lib/exercises/done-view';
	import { t } from '$lib/i18n/catalog';

	/*
	 * The exercise page's pinned ✓ Done (Done today once the day has an entry).
	 * On the desktop it pins to the pane. `left`
	 * goes beside it (plan 3's Skip, as wide as its word): Done takes the rest.
	 */
	interface Props {
		doneToday: boolean;
		/** A save without the sheet (a fixed rhythm) is out. */
		busy?: boolean;
		/** Done opens the sheet (false: a fixed rhythm saves at once). */
		sheet: boolean;
		/** In a run: Done · next (not once done today). */
		inRun?: boolean;
		onclick: () => void;
		left?: Snippet;
	}

	let { doneToday, busy = false, sheet, inRun = false, onclick, left }: Props = $props();

	const view = $derived(doneBar({ doneToday, inRun }));
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
			disabled={busy}
			{onclick}
		>
			{#if busy}<Spinner /><span class="sr-only">{t().exercise.log.saving}</span>{:else}<Icon
					name="check"
					size={20}
					stroke={2.5}
				/>{view.label}{/if}
		</button>
	</div>
</BottomBar>
