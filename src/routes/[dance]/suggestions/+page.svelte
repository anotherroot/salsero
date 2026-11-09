<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { act, type Field } from '$lib/act';
	import { offlineRefusal, refusalMessage, undoToast, type ToastState } from '$lib/act-toast';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BottomBar from '$lib/components/ui/BottomBar.svelte';
	import Screen from '$lib/components/ui/Screen.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { button } from '$lib/components/ui/styles';
	import SuggestionCard from '$lib/components/suggestions/SuggestionCard.svelte';
	import { focusAfterRemoval } from '$lib/focus';
	import { t } from '$lib/i18n/catalog';
	import type { ActionResult } from '@sveltejs/kit';

	let { data } = $props();
	const w = $derived(t().suggestions);
	const view = $derived(data.view);
	const actions = $derived(view.groups.flatMap((g) => g.actions));
	/** What the page shows, sent with every run: a card the AI changed since is refused. */
	const versions = $derived(
		JSON.stringify(Object.fromEntries(actions.map((a) => [a.id, a.version])))
	);

	let busy = $state(false);
	let toast = $state<ToastState | null>(null);
	let seq = 0;
	/** Drop asked about what needs it: the action, and their numbers. */
	let asking = $state<{ id: number; numbers: number[] } | null>(null);

	function failed(result: ActionResult): boolean {
		const message = refusalMessage(result, w.refusals.failed);
		if (message === null) return false;
		if (!offlineRefusal(result)) toast = { id: ++seq, message };
		return true;
	}

	async function post(name: string, fields: Record<string, Field>) {
		busy = true;
		try {
			const result = await act(name, fields);
			return failed(result) ? null : ((result as { data?: Record<string, unknown> }).data ?? {});
		} finally {
			busy = false;
		}
	}

	/** Run, then a toast with Undo for exactly what ran. */
	async function run(name: string, fields: Record<string, Field>) {
		const r = await post(name, { ...fields, versions });
		if (!r) return;
		const done = (r.done as number[]) ?? [];
		const refused = Number(r.refused ?? 0);
		if (!done.length && !refused) return;
		toast = done.length
			? undoToast(
					++seq,
					w.ran(done.length),
					() => (toast = null),
					() => undo(done)
				)
			: { id: ++seq, message: w.refusals.failed };
	}

	async function drop(id: number, withDependents = false) {
		const keys = actions.map((a) => `suggestion-${a.id}`);
		const r = await post('drop', { id, ...(withDependents ? { withDependents: '1' } : {}) });
		if (!r) return;
		const numbers = (r.dependents as number[]) ?? [];
		if (numbers.length) {
			asking = { id, numbers };
			return;
		}
		asking = null;
		await focusAfterRemoval(keys, `suggestion-${id}`, ['suggestions-top']);
	}

	/** Undo, and when it was refused, why (someone changed it since, or it is too late). */
	async function undo(lineIds: number[]) {
		const r = await post('undo', { lineIds: JSON.stringify(lineIds) });
		const reasons = (r?.reasons as (string | null)[] | undefined) ?? [];
		if (r && Number(r.refused ?? 0) > 0)
			toast = { id: ++seq, message: reasons[0] ?? w.refusals.failed };
	}

	// While the page is in sight it follows the AI: a desktop tab fills as it works.
	onMount(() => {
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible' && !busy && !asking) void invalidateAll();
		}, 5000);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><title>{w.title} · {data.dance.label}</title></svelte:head>

<Screen title={w.title} subtitle={w.subtitle(view.who, view.waiting)} width="narrow">
	{#snippet left()}
		<BandButton
			icon="back"
			label={t().shell.backTo(t().shell.tabs.you)}
			href="/{data.dance.slug}/you"
		/>
	{/snippet}

	<div class="flex flex-col gap-3 px-4 pb-28" data-focus="suggestions-top" tabindex="-1">
		{#if !view.groups.length}
			<p class="px-1 py-6 text-center text-[15px] text-muted">{w.empty}</p>
		{/if}
		{#each view.groups as g (g.id)}
			<div class="mt-2 flex items-center gap-2 px-1">
				<h2 class="min-w-0 flex-1 font-display text-[20px] font-extrabold text-ink">{g.title}</h2>
				{#if g.pending.length > 1}
					<button
						type="button"
						class={button('secondary', 'sm')}
						disabled={busy}
						onclick={() => run('runGroup', { id: g.id })}>{w.runGroup}</button
					>
				{/if}
			</div>
			{#each g.actions as a (a.id)}
				<div class="flex" class:pl-6={a.waitsFor.length > 0}>
					<div class="min-w-0 flex-1">
						<SuggestionCard
							action={a}
							{busy}
							onrun={() => run('run', { ids: JSON.stringify([a.id]) })}
							onupto={() => run('runUpTo', { id: a.id })}
							ondrop={() => drop(a.id)}
							ontoggle={(lineId) => post('toggleLine', { lineId })}
							onundo={(lineIds) => undo(lineIds)}
						/>
					</div>
				</div>
			{/each}
		{/each}
	</div>

	{#if view.waiting > 0}
		<BottomBar width="narrow">
			<div class="flex gap-2.5">
				<button
					type="button"
					class={button('secondary', 'lg')}
					disabled={busy}
					onclick={() => post('dropAll', {})}>{w.dropAll}</button
				>
				<button
					type="button"
					class="{button('primary', 'lg')} min-w-0 flex-1"
					disabled={busy}
					onclick={() => run('runAll', {})}>{w.runAll(view.waiting)}</button
				>
			</div>
		</BottomBar>
	{/if}
</Screen>

<Sheet title={w.drop} open={asking !== null} onclose={() => (asking = null)} size="small">
	<p class="px-1 text-[15px] text-ink">{asking ? w.alsoDrop(asking.numbers.length) : ''}</p>
	{#snippet footer()}
		<div class="flex gap-2.5">
			<button type="button" class={button('secondary', 'md', true)} onclick={() => (asking = null)}>
				{w.cancel}
			</button>
			<button
				type="button"
				class={button('danger', 'md', true)}
				disabled={busy}
				onclick={() => asking && drop(asking.id, true)}>{w.dropThemToo}</button
			>
		</div>
	{/snippet}
</Sheet>

<Toast
	toast={toast && {
		id: toast.id,
		message: toast.message,
		action: toast.action,
		icon: toast.icon,
		tone: toast.tone
	}}
	onaction={() => toast?.undo?.()}
	ondismiss={() => (toast = null)}
	bottom="calc(5.75rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)))"
/>
