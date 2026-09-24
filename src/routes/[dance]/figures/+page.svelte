<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import FigureFields from '$lib/components/figures/FigureFields.svelte';
	import { PARTNER, PARTNER_LABEL } from '$lib/labels';
	import { DEFAULT_EVERY_DAYS, FREQUENCIES } from '$lib/frequency';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// `?new=1` (from the empty Today page) opens the sheet straight away.
	let creating = $state(page.url.searchParams.get('new') === '1');
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form?.message) creating = true;
	});
	let busy = $state(false);

	function filterUrl(change: Record<string, string | undefined>) {
		const next = { ...data.filter, ...change };
		const qs = Object.entries(next)
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
			.join('&');
		return qs
			? resolve(`/${data.dance.slug}/figures?${qs}`)
			: resolve('/[dance]/figures', { dance: data.dance.slug });
	}

	const pill = (on: boolean) =>
		`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${on ? 'border-accent bg-accent text-accent-ink' : 'border-rule bg-raised text-ink-2'}`;

	// A figure's style_tag can be null (or, in principle, unknown to this
	// dance); render nothing rather than "undefined".
	const styleLabel = (s: string | null) => (s ? data.dance.styleLabel[s] : undefined);
</script>

<svelte:head><title>Figures · {data.dance.label}</title></svelte:head>

<header
	class="sticky top-0 z-20 border-b border-line bg-plane/95 px-4 pb-3 backdrop-blur"
	style="padding-top: max(env(safe-area-inset-top), 0.75rem)"
>
	<div class="flex items-center justify-between">
		<h1 class="text-[17px] font-semibold">Figures</h1>
		<button
			type="button"
			class="h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
			onclick={() => (creating = true)}>+ New</button
		>
	</div>
	<form
		class="mt-3"
		onsubmit={(e) => {
			e.preventDefault();
			const q = String(new FormData(e.currentTarget).get('q') ?? '');
			goto(filterUrl({ q }), { keepFocus: true, replaceState: true });
		}}
	>
		<input
			type="search"
			name="q"
			value={data.filter.q}
			placeholder="Search figures"
			aria-label="Search figures"
			class="w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px] outline-none focus:border-accent"
		/>
	</form>
	<div class="mt-2 flex gap-2 overflow-x-auto pb-1">
		{#each data.dance.styles as s (s)}
			<a
				class={pill(data.filter.style === s)}
				href={filterUrl({ style: data.filter.style === s ? undefined : s })}
				>{data.dance.styleLabel[s]}</a
			>
		{/each}
		{#each PARTNER as p (p)}
			<a
				class={pill(data.filter.partner === p)}
				href={filterUrl({ partner: data.filter.partner === p ? undefined : p })}
				>{PARTNER_LABEL[p]}</a
			>
		{/each}
	</div>
</header>

<main class="px-4 pt-4 pb-4">
	{#if data.figures.length === 0}
		<p class="mt-10 text-center text-[14px] text-muted">
			{data.filter.q || data.filter.style || data.filter.partner
				? 'No figures match.'
				: 'No figures yet. Add the first one you learned.'}
		</p>
	{/if}
	<ul class="space-y-2">
		{#each data.figures as f (f.id)}
			<li>
				<a
					href={resolve('/[dance]/figures/[id]', { dance: data.dance.slug, id: String(f.id) })}
					class="flex items-center justify-between gap-3 rounded-xl border border-line bg-raised px-4 py-3"
				>
					<span class="min-w-0">
						<span class="block truncate text-[15px] font-medium">{f.name}</span>
						<span class="text-[12px] text-muted"
							>{#if styleLabel(f.style)}{styleLabel(f.style)} ·
							{/if}{PARTNER_LABEL[f.partner]}</span
						>
					</span>
					{#if f.recordings > 0}
						<span class="shrink-0 text-[12px] text-muted"
							>{f.recordings} {f.recordings === 1 ? 'recording' : 'recordings'}</span
						>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</main>

{#if creating}
	<Sheet title="New figure" open={true} onclose={() => (creating = false)}>
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
			<FigureFields dance={data.dance} name={form?.name} notes={form?.notes} />
			<label class="block">
				<span class="mb-1 block text-[12px] font-medium text-ink-2">Practise it</span>
				<select
					name="everyDays"
					value={DEFAULT_EVERY_DAYS}
					class="w-full rounded-lg border border-rule bg-raised px-3 py-2.5 text-[15px]"
				>
					{#each FREQUENCIES as f (f.days)}
						<option value={f.days}>{f.label}</option>
					{/each}
				</select>
			</label>
			{#if form?.message}
				<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
					{form.message}
				</p>
			{/if}
			<button
				type="submit"
				disabled={busy}
				class="h-12 w-full rounded-xl bg-accent text-[15px] font-semibold text-accent-ink disabled:opacity-60"
				>Add figure</button
			>
			<p class="text-[12px] text-muted">
				An exercise to practise it is added to Today automatically. You can add recordings next.
			</p>
		</form>
	</Sheet>
{/if}
