<script lang="ts">
	import { untrack } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import RemoveWarning from './RemoveWarning.svelte';
	import type { MoveTarget } from '$lib/types';

	/**
	 * "Move <variation> to…": a new figure of its own, or another figure of the
	 * dance. Posts `?/move` with `target` (`new` or the figure's id) and, for a
	 * new one, `figureName`. The variation keeps its id, so a move lands back on
	 * this same page.
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
		open: boolean;
		onclose: () => void;
	}

	let { variation, figure, targets, last, failed, open, onclose }: Props = $props();

	/** `'new'`, or a target figure's id as the radio posts it. */
	let target = $state('new');
	let query = $state('');

	// Each opening starts fresh. A refused move keeps the sheet open, so what was
	// picked survives the message.
	$effect(() => {
		if (open) {
			untrack(() => {
				target = 'new';
				query = '';
			});
		}
	});

	const chosen = $derived(targets.find((t) => String(t.id) === target) ?? null);
	const q = $derived(query.trim().toLowerCase());
	// A figure matches by its own name or any of its variations'. The picked one
	// stays listed whatever the search says, so its radio is always there to post.
	const shown = $derived(
		targets.filter(
			(t) =>
				t === chosen ||
				!q ||
				t.name.toLowerCase().includes(q) ||
				t.variations.some((v) => v.toLowerCase().includes(q))
		)
	);
	const cta = $derived(
		last ? 'Move and remove figure' : chosen ? `Move to ${chosen.name}` : 'Make it its own figure'
	);

	/** The move redirects to this same URL, so SvelteKit keeps the sheet: close it. */
	const closeOnMove: SubmitFunction =
		() =>
		async ({ update, result }) => {
			await update();
			if (result.type === 'redirect') onclose();
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
					<input
						name="figureName"
						required
						maxlength="200"
						value="{figure} {variation}"
						class={field}
					/>
				</label>
			{/if}
		</div>

		<div class="space-y-1.5">
			<h3 class="text-[12px] font-medium tracking-wide text-muted uppercase">Or join a figure</h3>
			{#if targets.length === 0}
				<p class="text-[13px] text-muted">There are no other figures yet.</p>
			{:else}
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
					<!-- No name: it filters, it is not posted. Enter must not submit the move. -->
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
					{#each shown as t (t.id)}
						<label class={row(target === String(t.id))}>
							<input
								type="radio"
								name="target"
								value={String(t.id)}
								bind:group={target}
								class="sr-only"
							/>
							<span class="flex min-w-0 flex-1 flex-col gap-px">
								<span class="text-[15px] font-semibold text-ink">{t.name}</span>
								<span class="text-[12px] text-muted">{t.variations.join(' · ')}</span>
							</span>
							<span class={dot(target === String(t.id))} aria-hidden="true"></span>
						</label>
					{:else}
						<p class="py-2 text-[13px] text-muted">No figures match.</p>
					{/each}
				</div>
			{/if}
		</div>

		{#if failed}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{failed}
			</p>
		{/if}
		{#if last}
			<RemoveWarning {figure} {variation} />
		{/if}
		<button
			type="submit"
			class="h-12 w-full rounded-xl text-[15px] font-semibold {last
				? 'bg-danger text-white'
				: 'bg-accent text-accent-ink'}">{cta}</button
		>
	</form>
</Sheet>
