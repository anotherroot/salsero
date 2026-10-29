<script lang="ts">
	import { untrack } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import FigureList from './FigureList.svelte';
	import RemoveWarning from './RemoveWarning.svelte';
	import type { MoveTarget } from '$lib/types';

	/**
	 * "Move <variation> to…": a new figure of its own, or another figure of the
	 * dance. Posts `?/move` with `target` (`new` or the figure's id) and, for a
	 * new one, `figureName`; for an existing one, `name` — what the variation is
	 * called there, so a clash can be renamed away on the way in. The variation
	 * keeps its id, so a move lands back on this same page.
	 */
	interface Props {
		variation: string;
		figure: string;
		/** The other live figures of this dance. */
		targets: MoveTarget[];
		/** This is the figure's only variation: moving it removes the figure. */
		last: boolean;
		/** `move`'s refusal, if the last post was one. */
		failed: string | null;
		/** The "Name in <figure>" the refused move posted, so it survives the message. */
		typedName: string | null;
		open: boolean;
		onclose: () => void;
	}

	let { variation, figure, targets, last, failed, typedName, open, onclose }: Props = $props();

	/** `'new'`, or a target figure's id as the radio posts it. */
	let target = $state('new');
	// Kept in state so they survive picking another destination and coming back.
	let newName = $state('');
	let joinName = $state('');

	// Each opening starts fresh. A refused move keeps the sheet open, so what was
	// picked survives the message.
	$effect(() => {
		if (open) {
			untrack(() => {
				target = 'new';
				newName = figure.trim().toLowerCase().endsWith(variation.trim().toLowerCase())
					? figure
					: `${figure} ${variation}`;
				joinName = variation;
			});
		}
	});

	// A refusal shows only while the sheet has stayed open since it arrived: a
	// reopened sheet starts clean even though the page still holds the old one.
	let shown = $derived(failed);
	let wasOpen = false;
	$effect(() => {
		const now = open;
		if (wasOpen && !now) shown = null;
		wasOpen = now;
	});

	const chosen = $derived(targets.find((t) => String(t.id) === target) ?? null);
	// Compared the way the server compares: trimmed, case-insensitive.
	const wanted = $derived(joinName.trim().toLowerCase());
	const clash = $derived(
		chosen !== null && chosen.variations.some((v) => v.trim().toLowerCase() === wanted)
	);
	const blocked = $derived(chosen !== null && (wanted === '' || clash));
	const cta = $derived(
		last ? 'Move and remove figure' : chosen ? `Move to ${chosen.name}` : 'Make it its own figure'
	);

	/** The move redirects to this same URL, so SvelteKit keeps the sheet: close it. */
	const closeOnMove: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update();
			if (result.type === 'redirect') onclose();
			else if (result.type === 'failure') {
				// The same message twice in a row changes nothing the effect can see.
				shown = failed;
				// What was posted under "Name in <figure>", kept for another try.
				if (typedName) joinName = typedName;
			}
		};

	const row = (on: boolean) =>
		`flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-accent ${
			on ? 'border-[1.5px] border-accent bg-accent/10' : 'border border-line bg-raised'
		}`;
	const dot = (on: boolean) =>
		`size-[18px] shrink-0 rounded-full ${on ? 'border-[6px] border-accent bg-raised' : 'border-2 border-rule'}`;
	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
</script>

<Sheet title="Move “{variation}” to…" {open} {onclose}>
	<form
		method="POST"
		action="?/move"
		class="space-y-3"
		use:guarded={{ label: `Moving ${variation}`, submit: closeOnMove }}
	>
		<div class="space-y-1.5">
			<label class={row(target === 'new')}>
				<input type="radio" name="target" value="new" bind:group={target} class="sr-only" />
				<span class="flex min-w-0 flex-1 flex-col gap-px">
					<span class="text-[15px] font-semibold text-ink">A new figure of its own</span>
					<span class="text-[12px] text-muted">{variation} becomes its first variation</span>
				</span>
				<span class={dot(target === 'new')} aria-hidden="true"></span>
			</label>
			{#if target === 'new'}
				<label class="block px-0.5 pb-1.5">
					<span class="mb-1 block text-[12px] font-medium text-ink-2">New figure's name</span>
					<input name="figureName" required maxlength="200" bind:value={newName} class={field} />
				</label>
			{/if}
		</div>

		<div class="space-y-1.5">
			<h3 class="text-[12px] font-medium tracking-wide text-muted uppercase">Or join a figure</h3>
			{#if targets.length === 0}
				<p class="text-[13px] text-muted">There are no other figures yet.</p>
			{:else}
				<FigureList figures={targets} name="target" bind:selected={target} />
			{/if}
			{#if chosen}
				<label class="block px-0.5 pt-1.5">
					<span class="mb-1 block text-[12px] font-medium text-ink-2">Name in {chosen.name}</span>
					<input
						name="name"
						required
						maxlength="200"
						bind:value={joinName}
						aria-invalid={clash}
						class={field}
					/>
				</label>
				{#if clash}
					<p class="text-[13px] text-danger" role="alert">
						{chosen.name} already has a {joinName.trim()}. Pick another name.
					</p>
				{/if}
			{/if}
		</div>

		{#if shown}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{shown}
			</p>
		{/if}
		{#if last}
			<RemoveWarning {figure} {variation} />
		{/if}
		<button
			type="submit"
			disabled={blocked}
			class="h-12 w-full rounded-xl text-[15px] font-semibold disabled:opacity-50 {last
				? 'bg-danger text-white'
				: 'bg-accent text-accent-ink'}">{cta}</button
		>
	</form>
</Sheet>
