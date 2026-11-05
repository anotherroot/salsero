<script lang="ts">
	import { actAt } from '$lib/act';
	import { refusalMessage } from '$lib/act-toast';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import type { DanceSlug } from '$lib/dances/dances';

	/**
	 * "+ Next 5", the last row of Today's list card (boards "1 left", "All
	 * done"): picks the next `daily` in line for today. Busy while it posts, so a
	 * second tap sends nothing; a refusal goes to `onrefused` (the layout's toast:
	 * this row may be gone once the list reloads).
	 */
	let {
		dance,
		daily,
		onrefused
	}: {
		dance: DanceSlug;
		/** The person's daily number: what the row says and how many it picks. */
		daily: number;
		onrefused: (message: string) => void;
	} = $props();

	let busy = $state(false);

	async function next() {
		if (busy) return;
		busy = true;
		try {
			const result = await actAt(`/${dance}`, 'next', {});
			const message = refusalMessage(result, 'Could not add more. Try again.');
			if (message) onrefused(message);
		} finally {
			busy = false;
		}
	}
</script>

<li>
	<button
		type="button"
		class="flex min-h-14 w-full cursor-pointer items-center justify-center gap-1.5 px-4 text-[15px] font-extrabold text-accent-text disabled:cursor-default"
		disabled={busy}
		aria-busy={busy}
		onclick={next}
	>
		{#if busy}<Spinner size={20} />{:else}<Icon name="plus" size={20} />{/if}Next {daily}
	</button>
</li>
