<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { longPress } from '$lib/longpress';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Picked version ids, in tap order — the new routine's slot order. */
	let picked = $state<number[]>([]);
	let selecting = $state(false);
	let naming = $state(false);
	let busy = $state(false);
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form?.message) naming = true;
	});

	const press = longPress({
		ms: 500,
		tolerancePx: 10,
		enabled: () => !selecting,
		onLongPress: (id) => {
			selecting = true;
			picked = [id];
		}
	});

	function toggle(id: number) {
		picked = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id];
		if (picked.length === 0) selecting = false;
	}

	function rowClick(e: MouseEvent, id: number) {
		if (press.swallow()) {
			e.preventDefault();
			return;
		}
		if (selecting) {
			e.preventDefault();
			toggle(id);
		}
	}

	function stopSelecting() {
		selecting = false;
		picked = [];
	}

	const href = (id: number) =>
		resolve('/[dance]/figures/[id]', { dance: data.dance.slug, id: String(id) });

	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
</script>

<svelte:head><title>Coverage · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-plane/95 px-2 py-2 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.5rem)"
>
	<a
		href={resolve('/[dance]/figures', { dance: data.dance.slug })}
		class="grid size-11 place-items-center rounded-full text-[22px] text-ink-2"
		aria-label="Back to Figures">‹</a
	>
	<h1 class="min-w-0 flex-1 truncate text-[17px] font-semibold">Routine coverage</h1>
	{#if !selecting}
		<button
			type="button"
			class="h-10 rounded-xl px-3 text-[14px] text-accent"
			onclick={() => (selecting = true)}>Select</button
		>
	{/if}
</header>

<main class="space-y-5 px-4 pt-4 {selecting ? 'pb-20' : 'pb-4'}">
	{#if data.groups.length === 0}
		<p class="mt-10 text-center text-[14px] text-muted">No figures yet.</p>
	{/if}
	{#each data.groups as group (group.key)}
		<section aria-labelledby="g-{group.key}">
			<h2
				id="g-{group.key}"
				class="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase"
			>
				{group.title} ({group.rows.length})
			</h2>
			<ul class="space-y-2">
				{#each group.rows as row (row.id)}
					{@const on = picked.includes(row.id)}
					<li>
						<a
							href={href(row.id)}
							class="flex items-center gap-3 rounded-xl border bg-raised px-4 py-3 select-none [-webkit-touch-callout:none] {on
								? 'border-accent'
								: 'border-line'}"
							onpointerdown={(e) => press.down(row.id, e.clientX, e.clientY)}
							onpointermove={(e) => press.move(e.clientX, e.clientY)}
							onpointerup={() => press.up()}
							onpointercancel={() => press.up()}
							oncontextmenu={(e) => e.preventDefault()}
							onclick={(e) => rowClick(e, row.id)}
						>
							{#if selecting}
								<span
									class="grid size-6 shrink-0 place-items-center rounded-full border text-[13px] {on
										? 'border-accent bg-accent text-accent-ink'
										: 'border-rule'}"
									aria-hidden="true">{on ? picked.indexOf(row.id) + 1 : ''}</span
								>
								<span class="sr-only">{on ? 'Selected,' : 'Not selected,'}</span>
							{/if}
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[15px] font-medium">{row.label}</span>
								{#if row.routines.length > 0}
									<span class="block truncate text-[12px] text-muted">
										{row.routines.map((r) => r.name).join(', ')}
									</span>
								{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</main>

{#if selecting}
	<div
		class="fixed inset-x-0 z-30 mx-auto flex max-w-[560px] items-center gap-3 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur"
		style="bottom: calc(4.5rem + env(safe-area-inset-bottom))"
	>
		<span class="flex-1 text-[14px] text-ink-2">{picked.length} selected</span>
		<button type="button" class="h-10 px-3 text-[14px] text-ink-2" onclick={stopSelecting}
			>Cancel</button
		>
		<button
			type="button"
			disabled={picked.length === 0}
			class="h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink disabled:opacity-50"
			onclick={() => (naming = true)}>Create routine</button
		>
	</div>
{/if}

<Sheet title="New routine" open={naming} onclose={() => (naming = false)}>
	<form
		method="POST"
		action="?/create"
		class="space-y-3"
		use:guarded={{
			label: 'New routine',
			submit: () => {
				busy = true;
				// `update` follows the redirect to the new routine page.
				return async ({ update }) => {
					await update();
					busy = false;
				};
			}
		}}
	>
		{#if form?.message}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
				{form.message}
			</p>
		{/if}
		{#each picked as id (id)}
			<input type="hidden" name="figureIds" value={id} />
		{/each}
		<label class="block">
			<span class="mb-1 block text-[12px] font-medium text-ink-2">Name</span>
			<input
				name="name"
				required
				maxlength="200"
				value={form?.name ?? ''}
				placeholder="Basic combo"
				class={field}
			/>
		</label>
		<p class="text-[12px] text-muted">
			{picked.length}
			{picked.length === 1 ? 'figure' : 'figures'}, in the order you picked them. Put them in order
			on the routine page.
		</p>
		<button
			type="submit"
			disabled={busy}
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50"
			>Create routine</button
		>
	</form>
</Sheet>
