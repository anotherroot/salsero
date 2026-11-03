<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { gotoWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { COPY_NOTE, MAKE_COPY, copyItems, copyLine } from '$lib/teams/view';
	import type { CopySummary } from '$lib/types';

	/**
	 * Make my own copy: what it costs, what becomes the person's, and one
	 * button. A copy that does not fit says so here, with the person's use and
	 * limit and a way to Ask for more; one that lands opens the new lesson.
	 */
	let {
		open,
		onclose,
		summary,
		action
	}: {
		open: boolean;
		onclose: () => void;
		summary: CopySummary;
		/** Where the form posts, e.g. `?/copy`. */
		action: string;
	} = $props();

	let busy = $state(false);
	let refused = $state<{ message: string; askForMore: boolean } | null>(null);

	const items = $derived(copyItems(summary));
</script>

<Sheet title={MAKE_COPY} sub={copyLine(summary.bytes)} {open} {onclose}>
	<div class="flex flex-col gap-2">
		{#if refused}
			{@const r = refused}
			{#if r.askForMore}
				<Banner kind="error">
					{r.message}
					{#snippet action()}
						<a href={resolve('/settings/storage')} class={button('tertiary', 'sm')}>Ask for more</a>
					{/snippet}
				</Banner>
			{:else}
				<Banner kind="error">{r.message}</Banner>
			{/if}
		{/if}
		<h3 class={SECTION_LABEL}>Becomes yours</h3>
		<ul class={GROUP}>
			{#each items as line (line)}
				<li class="flex min-h-12 items-center px-4 py-2 text-[16px] font-bold text-ink">{line}</li>
			{/each}
		</ul>
		<p class="px-4 text-[13px] text-muted">{COPY_NOTE}</p>
	</div>

	{#snippet footer()}
		<form
			method="POST"
			{action}
			use:enhance={({ cancel }) => {
				// One copy per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				refused = null;
				return async ({ result, update }) => {
					try {
						if (result.type === 'redirect') {
							// The new lesson opens over this page, once the sheet's Back has landed.
							onclose();
							await gotoWhenSettled(result.location);
						} else if (result.type === 'failure') {
							const data = result.data as { message?: unknown; askForMore?: unknown } | undefined;
							refused = {
								message:
									typeof data?.message === 'string' ? data.message : 'That copy could not be made.',
								askForMore: data?.askForMore === true
							};
						} else if (result.type === 'error') {
							refused = { message: 'That copy could not be made. Try again.', askForMore: false };
						} else {
							await update();
						}
					} finally {
						busy = false;
					}
				};
			}}
		>
			<button
				type="submit"
				class={button('primary', 'md', true)}
				aria-busy={busy}
				aria-label={busy ? 'Copying' : undefined}
			>
				{#if busy}<Spinner />{:else}{MAKE_COPY}{/if}
			</button>
		</form>
	{/snippet}
</Sheet>
