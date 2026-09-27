<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let creating = $state(false);
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form?.message) creating = true;
	});
	let busy = $state(false);

	const label = 'mb-1 block text-[13px] text-muted';
	const field =
		'w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent';
	const hint = 'rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger';
</script>

<svelte:head><title>Routines · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 pb-3 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
>
	<div class="flex items-center justify-between">
		<h1 class="text-[17px] font-semibold">Routines</h1>
		<button
			type="button"
			class="h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
			onclick={() => (creating = true)}>+ New</button
		>
	</div>
</header>

<div class="px-4 py-4">
	{#if data.routines.length === 0}
		<p class="mt-10 text-center text-[15px] text-muted">
			No routines yet. String some figures together into one you can call as a single set.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each data.routines as routine (routine.id)}
				<li class="overflow-hidden rounded-xl border border-line bg-raised px-4 py-3">
					<div class="flex items-start justify-between gap-3">
						<a
							class="min-w-0 flex-1"
							href={resolve('/[dance]/routines/[id]', {
								dance: data.dance.slug,
								id: String(routine.id)
							})}
						>
							<span class="block truncate text-[15px] font-medium">{routine.name}</span>
							<span
								class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted"
							>
								<span>{routine.slots} {routine.slots === 1 ? 'slot' : 'slots'}</span>
								{#if routine.breaks > 0}
									<span class={hint}>{routine.breaks} break{routine.breaks === 1 ? '' : 's'}</span>
								{/if}
								{#if !routine.loops && routine.slots > 0}
									<span class={hint}>does not loop</span>
								{/if}
							</span>
						</a>
						<form method="POST" action="?/archive" use:enhance>
							<input type="hidden" name="id" value={routine.id} />
							<button type="submit" class="h-8 shrink-0 px-2 text-[13px] text-danger">Remove</button
							>
						</form>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<Sheet title="New routine" open={creating} onclose={() => (creating = false)}>
	<form
		method="POST"
		action="?/create"
		class="space-y-3"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		{#if form?.message}
			<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger">{form.message}</p>
		{/if}

		<label class="block">
			<span class={label}>Name</span>
			<input
				name="name"
				required
				maxlength="200"
				value={form?.name ?? ''}
				placeholder="Basic combo"
				class={field}
			/>
		</label>

		<label class="block">
			<span class={label}>Notes</span>
			<textarea
				name="notes"
				rows="5"
				maxlength="2000"
				placeholder="What this is for, when to reach for it…"
				class={field}>{form?.notes ?? ''}</textarea
			>
		</label>

		<button
			type="submit"
			disabled={busy}
			class="h-11 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-50"
			>Create routine</button
		>
	</form>
</Sheet>
