<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const failure = $derived(form && 'message' in form ? form.message : null);
</script>

<header class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 py-3 backdrop-blur">
	<h1 class="text-[17px] font-semibold">Positions</h1>
	<p class="text-[12px] text-muted">
		Where a figure's hands are before and after it. A figure with none tagged is assumed to start
		and end at the neutral hold.
	</p>
</header>

<main class="space-y-6 px-4 pt-4 pb-4">
	{#if failure}
		<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
			{failure}
		</p>
	{/if}

	<ul class="space-y-2">
		{#each data.positions as position (position.id)}
			<li class="rounded-xl border border-line bg-raised p-3 {position.unused ? 'opacity-60' : ''}">
				<form method="POST" action="?/rename" class="flex items-center gap-2" use:enhance>
					<input type="hidden" name="id" value={position.id} />
					<input
						name="name"
						value={position.name}
						maxlength="80"
						class="min-w-0 flex-1 rounded-lg border border-line bg-plane px-2 py-1 text-[15px]"
					/>
					<button type="submit" class="h-9 px-2 text-[13px] font-medium text-accent">Save</button>
				</form>

				<div class="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
					<span>{position.inCount} in · {position.outCount} out</span>
					{#if position.neutral}
						<span class="rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent"
							>neutral</span
						>
					{/if}
					{#if position.deadEnd}
						<span class="rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger"
							>dead end — nothing you know leaves here</span
						>
					{/if}
					{#if position.orphan}
						<span class="rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger"
							>orphan — nothing you know gets you here</span
						>
					{/if}
					{#if !position.neutral}
						<form method="POST" action="?/archive" class="ml-auto" use:enhance>
							<input type="hidden" name="id" value={position.id} />
							<button type="submit" class="h-8 px-2 text-danger">Remove</button>
						</form>
					{/if}
				</div>
			</li>
		{/each}
	</ul>

	<form method="POST" action="?/create" class="flex items-center gap-2" use:enhance>
		<input
			name="name"
			placeholder="Add a position"
			maxlength="80"
			class="min-w-0 flex-1 rounded-xl border border-line bg-raised px-3 py-2 text-[15px]"
		/>
		<button type="submit" class="h-11 rounded-xl border border-line px-4 text-[14px] font-semibold"
			>Add</button
		>
	</form>
</main>
