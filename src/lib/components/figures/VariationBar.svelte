<script lang="ts">
	import { resolve } from '$app/paths';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import type { SiblingSummary } from '$lib/types';

	/**
	 * The figure's variations, pinned above the tabs: ‹ and › step through them,
	 * the middle opens the list, and the list's last row makes a new one. Every
	 * step is a link, so a variation is a URL of its own. Shown with a single
	 * variation too — that is where "+ New variation" lives.
	 */
	interface Props {
		figureName: string;
		/** Live variations, id order, the current one included. */
		siblings: SiblingSummary[];
		currentId: number;
		slug: string;
		/** `createVariation`'s refusal, if the last post was one. */
		failed: string | null;
	}

	let { figureName, siblings, currentId, slug, failed }: Props = $props();

	let listing = $state(false);
	let adding = $state(false);
	// By value, so a refresh of the page data does not re-run the effect below.
	const stepId = $derived(currentId);

	/*
	 * Stepping to another variation is a same-route navigation, so SvelteKit
	 * keeps this component — and both sheets with it. A new id closes them: a
	 * row picked in the list, and the redirect a new variation lands on.
	 */
	$effect(() => {
		void stepId;
		listing = false;
		adding = false;
	});
	// A refusal shows only while the sheet has stayed open since it arrived.
	let shown = $derived(failed);
	let wasAdding = false;
	$effect(() => {
		const now = adding;
		if (wasAdding && !now) shown = null;
		wasAdding = now;
	});
	// A refused name re-renders with the message; keep its sheet open to show it.
	$effect(() => {
		if (failed) adding = true;
	});

	const index = $derived(
		Math.max(
			0,
			siblings.findIndex((s) => s.id === currentId)
		)
	);
	const count = $derived(siblings.length);
	const current = $derived(siblings[index]);
	// They wrap: › on the last goes back to the first.
	const prev = $derived(siblings[(index + count - 1) % count]);
	const next = $derived(siblings[(index + 1) % count]);

	const href = (id: number) => resolve('/[dance]/figures/[id]', { dance: slug, id: String(id) });
	const recordings = (n: number) =>
		n === 0 ? 'no recordings' : `${n} ${n === 1 ? 'recording' : 'recordings'}`;

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const label = 'mb-1 block text-[12px] font-medium text-ink-2';
	const stepClass =
		'grid h-13 w-12 shrink-0 place-items-center rounded-[14px] border border-line bg-raised text-ink-2';
</script>

{#snippet chevron(path: string)}
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.4"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"><path d={path} /></svg
	>
{/snippet}

{#snippet step(to: SiblingSummary, label: string, path: string)}
	{#if count > 1}
		<a href={href(to.id)} class={stepClass} aria-label="{label}: {to.name}"
			>{@render chevron(path)}</a
		>
	{:else}
		<!-- Nowhere to step to; kept so the bar does not change shape. -->
		<span class="{stepClass} opacity-40" aria-hidden="true">{@render chevron(path)}</span>
	{/if}
{/snippet}

<!--
	1rem above the bottom tabs, as the selection bars are (4.5rem plus the safe
	area). The page pads its own bottom so the end of it clears this.
-->
<nav
	aria-label="Variations of {figureName}"
	class="fixed inset-x-0 z-30 mx-auto flex max-w-[560px] items-center gap-2 border-t border-line bg-surface px-3 py-2.5 shadow-[0_-4px_16px_rgb(0_0_0/0.06)]"
	style="bottom: calc(4.5rem + env(safe-area-inset-bottom))"
>
	{@render step(prev, 'Previous variation', 'M15 6l-6 6 6 6')}
	<button
		type="button"
		aria-haspopup="dialog"
		onclick={() => (listing = true)}
		class="flex h-13 min-w-0 flex-1 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-accent bg-accent/10 px-2"
	>
		<span class="flex min-w-0 flex-col items-center">
			<span class="max-w-full truncate text-[15px] font-semibold text-ink">{current.name}</span>
			<span class="text-[12px] text-muted"
				>{index + 1} of {count} {count === 1 ? 'variation' : 'variations'}</span
			>
		</span>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.6"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			class="shrink-0 text-accent"><path d="M6 15l6-6 6 6" /></svg
		>
	</button>
	{@render step(next, 'Next variation', 'M9 6l6 6-6 6')}
</nav>

<Sheet title="Variations of {figureName}" open={listing} onclose={() => (listing = false)}>
	<ul class="space-y-1.5">
		{#each siblings as s (s.id)}
			{@const here = s.id === currentId}
			<li>
				<a
					href={href(s.id)}
					aria-current={here ? 'page' : undefined}
					onclick={() => (listing = false)}
					class="flex items-center gap-3 rounded-xl p-3 {here
						? 'border-[1.5px] border-accent bg-accent/10'
						: 'border border-line bg-raised'}"
				>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-[15px] font-semibold text-ink">{s.name}</span>
						<span class="text-[12px] text-muted">{s.holds}</span>
						<span class="text-[12px] text-muted">{s.timing} · {recordings(s.videos)}</span>
					</span>
					{#if here}
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.6"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="shrink-0 text-accent"
							aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg
						>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
	<button
		type="button"
		class="mt-2.5 h-12 w-full rounded-xl border border-dashed border-rule text-[14px] font-semibold text-accent"
		onclick={() => {
			listing = false;
			adding = true;
		}}>+ New variation</button
	>
</Sheet>

<Sheet title="New variation of {figureName}" open={adding} onclose={() => (adding = false)}>
	<!-- A success redirects to the new variation, which closes this (see above). -->
	<form
		method="POST"
		action="?/createVariation"
		class="space-y-3"
		use:guarded={{ label: 'New variation' }}
	>
		{#if shown}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{shown}
			</p>
		{/if}
		<label class="block">
			<span class={label}>Name</span>
			<input
				name="name"
				required
				maxlength="200"
				placeholder="e.g. Doble, From cross"
				class={field}
			/>
		</label>
		<p class="text-[12px] text-muted">
			It starts as a copy of {current.name} — handholds, timing and notes, not its recordings. Change
			them with Edit.
		</p>
		<button
			type="submit"
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink"
			>Add variation</button
		>
	</form>
</Sheet>
