<script lang="ts">
	import { resolve } from '$app/paths';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { variationNav } from '$lib/figures/page';
	import { plural } from '$lib/moves/plural';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { button, iconButton, FIELD, GROUP, LABEL } from '$lib/components/ui/styles';
	import type { SiblingSummary } from '$lib/types';

	/**
	 * The figure's variations, pinned to the bottom edge: ‹ and › step through
	 * them, the middle opens the list, and the list's footer makes a new one.
	 * Every step is a link, so a variation is a URL of its own. Shown with a
	 * single variation too — that is where "New variation" lives.
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
	let busy = $state(false);
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

	const nav = $derived(variationNav(siblings, currentId));
	const current = $derived(siblings[nav.index]);
	const byId = (id: number | null) => siblings.find((s) => s.id === id);
	const prev = $derived(byId(nav.prev));
	const next = $derived(byId(nav.next));

	const href = (id: number) => resolve('/[dance]/figures/[id]', { dance: slug, id: String(id) });
	const recordings = (n: number) =>
		n === 0 ? 'no recordings' : plural(n, 'recording', 'recordings');
</script>

{#snippet step(
	to: SiblingSummary | undefined,
	label: string,
	icon: 'chevron-left' | 'chevron-right'
)}
	{#if to}
		<a href={href(to.id)} class="{iconButton('step')} !h-12 !w-12" aria-label="{label}: {to.name}"
			><Icon name={icon} size={22} /></a
		>
	{:else}
		<!-- Nowhere to step to; kept so the bar does not change shape. -->
		<button type="button" disabled aria-label={label} class="{iconButton('step')} !h-12 !w-12"
			><Icon name={icon} size={22} /></button
		>
	{/if}
{/snippet}

<!--
	A pushed screen has no tab bar, so the bar sits on the bottom edge, over the
	safe area. The page ends in a spacer of its own so its last line clears this.
-->
<nav
	aria-label="Variations of {figureName}"
	class="fixed inset-x-0 bottom-0 z-30 border-t border-tab-line bg-tab-bg px-3 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]"
>
	<div class="mx-auto flex max-w-[560px] items-center gap-2">
		{@render step(prev, 'Previous variation', 'chevron-left')}
		<button
			type="button"
			aria-haspopup="dialog"
			onclick={() => (listing = true)}
			class="flex h-[52px] min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent-soft px-4"
		>
			<span class="flex min-w-0 flex-col items-center">
				<span class="max-w-full truncate text-[16px] leading-tight font-extrabold text-ink"
					>{current.name}</span
				>
				<span class="text-[12px] leading-tight font-bold text-accent-text">{nav.position}</span>
			</span>
			<span class="flex-none text-accent-text"><Icon name="chevron-up" size={18} /></span>
		</button>
		{@render step(next, 'Next variation', 'chevron-right')}
	</div>
</nav>

<Sheet title="Variations of {figureName}" open={listing} onclose={() => (listing = false)}>
	<ul class={GROUP} aria-label="Variations">
		{#each siblings as s (s.id)}
			{@const here = s.id === currentId}
			<li>
				<a
					href={href(s.id)}
					aria-current={here ? 'page' : undefined}
					onclick={() => (listing = false)}
					class="flex min-h-[72px] items-center gap-3 px-4 py-3 {here ? 'bg-accent-soft' : ''}"
				>
					{#if here}
						<span class="flex flex-none text-accent" style="--icon-knockout: var(--color-on-accent)"
							><Icon name="check-circle" size={22} filled /></span
						>
					{/if}
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-[16px] leading-tight font-bold text-ink">{s.name}</span>
						<span class="text-[13px] text-muted">{s.holds}</span>
						<span class="text-[13px] text-muted">{s.timing} · {recordings(s.videos)}</span>
					</span>
				</a>
			</li>
		{/each}
	</ul>
	{#snippet footer()}
		<button type="button" class={button('secondary', 'md', true)} onclick={() => (adding = true)}
			><Icon name="plus" size={20} />New variation</button
		>
	{/snippet}
</Sheet>

<Sheet
	title="New variation"
	sub="of {figureName}"
	back
	open={adding}
	onclose={() => (adding = false)}
>
	<!-- A success redirects to the new variation, which closes this (see above). -->
	<form
		id="new-variation"
		method="POST"
		action="?/createVariation"
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: 'New variation',
			submit: () => {
				busy = true;
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}
		}}
	>
		<div>
			<label for="new-variation-name" class={LABEL}>Name</label>
			<input
				id="new-variation-name"
				name="name"
				required
				maxlength="200"
				placeholder="e.g. Doble, From cross"
				class={FIELD}
				aria-invalid={shown ? 'true' : undefined}
				aria-describedby={shown ? 'new-variation-error' : undefined}
			/>
			{#if shown}<FieldError id="new-variation-error" message={shown} />{/if}
		</div>
		<p class="px-1 text-[14px] leading-[1.45] text-muted">
			It starts as a copy of {current.name} — handholds, timing and notes, not its recordings. Change
			them with Edit.
		</p>
	</form>
	{#snippet footer()}
		<button
			type="submit"
			form="new-variation"
			class={button('primary', 'md', true)}
			aria-busy={busy}
			disabled={busy}
		>
			{#if busy}<Spinner size={18} />{:else}<Icon name="plus" size={20} />{/if}Add variation
		</button>
	{/snippet}
</Sheet>
