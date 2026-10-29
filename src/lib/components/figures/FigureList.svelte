<script lang="ts">
	import type { MoveTarget } from '$lib/types';

	/**
	 * A search and the dance's live figures, each with its variations' names, as
	 * radios posting the figure's id under `name`. Shared by "Move to…" (joining
	 * a figure) and a lesson's "Variation of a figure". The caller says what an
	 * empty dance looks like.
	 */
	interface Props {
		figures: MoveTarget[];
		/** The radio group's form name. */
		name: string;
		/** The picked radio's value — a figure's id as a string — or anything else for none. */
		selected: string;
		required?: boolean;
	}

	let { figures, name, selected = $bindable(), required = false }: Props = $props();

	let query = $state('');

	const chosen = $derived(figures.find((t) => String(t.id) === selected) ?? null);
	const q = $derived(query.trim().toLowerCase());
	// A figure matches by its own name or any of its variations'. The picked one
	// stays listed whatever the search says, so its radio is always there to post.
	const listed = $derived(
		figures.filter(
			(t) =>
				t === chosen ||
				!q ||
				t.name.toLowerCase().includes(q) ||
				t.variations.some((v) => v.toLowerCase().includes(q))
		)
	);

	const row = (on: boolean) =>
		`flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-accent ${
			on ? 'border-[1.5px] border-accent bg-accent/10' : 'border border-line bg-raised'
		}`;
	const dot = (on: boolean) =>
		`size-[18px] shrink-0 rounded-full ${on ? 'border-[6px] border-accent bg-raised' : 'border-2 border-rule'}`;
</script>

<label
	class="flex h-11 items-center gap-2 rounded-[10px] border border-rule bg-raised px-3 focus-within:border-accent"
>
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.2"
		stroke-linecap="round"
		class="shrink-0 text-muted"
		aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg
	>
	<span class="sr-only">Search figures</span>
	<!-- No name: it filters, it is not posted. Enter must not submit the form. -->
	<input
		type="search"
		bind:value={query}
		placeholder="Search figures"
		onkeydown={(e) => {
			if (e.key === 'Enter') e.preventDefault();
		}}
		class="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
	/>
</label>
<div class="max-h-[40dvh] space-y-1.5 overflow-y-auto">
	{#each listed as t (t.id)}
		<label class={row(selected === String(t.id))}>
			<input
				type="radio"
				{name}
				value={String(t.id)}
				bind:group={selected}
				{required}
				class="sr-only"
			/>
			<span class="flex min-w-0 flex-1 flex-col gap-px">
				<span class="text-[15px] font-semibold text-ink">{t.name}</span>
				<span class="text-[12px] text-muted">{t.variations.join(' · ')}</span>
			</span>
			<span class={dot(selected === String(t.id))} aria-hidden="true"></span>
		</label>
	{:else}
		<p class="py-2 text-[13px] text-muted">No figures match.</p>
	{/each}
</div>
