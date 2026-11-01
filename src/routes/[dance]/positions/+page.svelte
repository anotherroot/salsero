<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import { focusAfterRemoval } from '$lib/focus';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { act } from '$lib/act';
	import { FIELD, GROUP, LABEL, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { plural } from '$lib/format';
	import { gapsTitle, positionBadges, positionMeta } from '$lib/moves/positions';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	// What a refusal carries, whichever action it came from.
	const refusal = $derived(
		(form ?? null) as {
			action?: string;
			field?: string;
			message?: string;
			id?: number;
			name?: string;
		} | null
	);

	/** The position whose sheet is open, by id, so a reload does not close it. */
	// The `form` that was there when a sheet opened: an older refusal is not this sheet's.
	let seen: unknown = $state(null);
	let selectedId = $state<number | null>(null);
	let creating = $state(false);
	let busy = $state(false);
	let removing = $state(false);
	// `undo` is there only while there is something to undo; a failed Undo leaves a plain message.
	let toast = $state<{ id: number; message: string; undo?: () => Promise<unknown> } | null>(null);
	let toastSeq = 0;

	const selected = $derived(data.positions.find((p) => p.id === selectedId) ?? null);
	const title = $derived(gapsTitle(data.positions));

	const renameRefusal = $derived(
		form !== seen && refusal?.action === 'rename' && refusal.id === selectedId ? refusal : null
	);
	const archiveRefusal = $derived(
		form !== seen && refusal?.action === 'archive' && refusal.id === selectedId && refusal.message
			? refusal.message
			: null
	);
	const createRefusal = $derived(form !== seen && refusal?.action === 'create' ? refusal : null);

	// A failed create re-renders with the message; keep its sheet open to show it.
	$effect(() => {
		if (form !== seen && refusal?.action === 'create' && refusal.message) creating = true;
	});

	function removed(name: string, id: number) {
		toast = {
			id: ++toastSeq,
			message: `${name} removed`,
			undo: () => act('restore', { id })
		};
	}

	/** Undo a removal; when that fails, say why instead of losing it. */
	async function undoRemoval() {
		const t = toast;
		toast = null;
		if (!t?.undo) return;
		const result = (await t.undo()) as { type: string; data?: { message?: string } };
		if (result.type !== 'success') {
			toast = { id: ++toastSeq, message: result.data?.message ?? 'Could not undo.' };
		}
	}
</script>

<svelte:head><title>Positions · {data.dance.label}</title></svelte:head>

<Screen title="Positions" subtitle="Hands before and after a figure">
	{#snippet left()}
		<BackButton
			fallback={{
				href: resolve('/[dance]/figures', { dance: data.dance.slug }),
				label: 'Back to Moves'
			}}
		/>
	{/snippet}
	{#snippet right()}
		<BandButton
			icon="plus"
			focusKey="new-position"
			label="New position"
			onclick={() => {
				seen = form;
				creating = true;
			}}
		/>
	{/snippet}

	<p class="px-1 text-[14px] leading-[1.45] text-ink-2">
		<b class="font-bold text-ink">{data.tagged.done} of {data.tagged.total} figures tagged.</b>
		A figure with none tagged starts and ends at the neutral hold.
	</p>

	{#if title}
		<Banner kind="warning" {title}>
			Dead end: nothing you know leaves it. Orphan: nothing you know gets you there.
		</Banner>
	{/if}

	<h2 class="{SECTION_LABEL} pt-1.5">{plural(data.positions.length, 'position', 'positions')}</h2>
	<div class={GROUP}>
		{#each data.positions as p (p.id)}
			{@const meta = positionMeta(p)}
			<button
				data-focus="position-{p.id}"
				type="button"
				class="flex min-h-16 w-full cursor-pointer items-center gap-2.5 py-[9px] pr-3.5 pl-4 text-left active:bg-step"
				onclick={() => {
					seen = form;
					selectedId = p.id;
				}}
			>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span
						class="text-[16px] leading-[1.3] font-bold break-words {meta.mutedTitle
							? 'text-muted'
							: 'text-ink'}">{p.name}</span
					>
					<span
						class="text-[13px] leading-[1.35] {meta.tone ? 'font-bold text-danger' : 'text-muted'}"
						>{meta.text}</span
					>
				</span>
				{#if p.neutral}<Badge tone="accent">neutral</Badge>{/if}
				<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
			</button>
		{/each}
	</div>
</Screen>

{#if selected}
	<Sheet title={selected.name} sub="Position" open={true} onclose={() => (selectedId = null)}>
		{#if archiveRefusal}<div class="mb-3.5">
				<Banner kind="error">{archiveRefusal}</Banner>
			</div>{/if}
		<form
			id="rename-position"
			method="POST"
			action="?/rename"
			class="flex flex-col gap-3.5"
			use:guarded={{
				label: 'Position name',
				submit: () => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') selectedId = null;
					};
				}
			}}
		>
			<input type="hidden" name="id" value={selected.id} />
			<div>
				<label class={LABEL} for="position-name">Name</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="position-name"
					name="name"
					required
					autofocus
					maxlength="80"
					value={renameRefusal?.name ?? selected.name}
					class={FIELD}
					aria-invalid={renameRefusal?.message ? 'true' : undefined}
					aria-describedby={renameRefusal?.message ? 'position-name-error' : undefined}
				/>
				{#if renameRefusal?.message}<FieldError
						id="position-name-error"
						message={renameRefusal.message}
					/>{/if}
			</div>
			<div class="flex flex-wrap gap-2">
				{#each positionBadges(selected) as b (b.text)}
					<Badge tone={b.tone}
						>{#if b.icon}<Icon name={b.icon} size={14} filled />{/if}{b.text}</Badge
					>
				{/each}
			</div>
		</form>

		{#snippet footer()}
			<button type="submit" form="rename-position" class={button('primary', 'md', true)}
				>Save</button
			>
			{#if !selected.neutral}
				<form
					method="POST"
					action="?/archive"
					use:enhance={({ cancel }) => {
						// One removal per tap: a second tap while the first is out is dropped.
						if (removing) return cancel();
						removing = true;
						const { id, name } = selected;
						const keys = data.positions.map((p) => `position-${p.id}`);
						return async ({ result, update }) => {
							if (result.type !== 'success') {
								removing = false;
								return update();
							}
							// Reload the list BEFORE the sheet goes: closing it pops its history
							// entry, and that navigation can land over a reload still in flight.
							await invalidateAll();
							selectedId = null;
							removed(name, id);
							removing = false;
							await focusAfterRemoval(keys, `position-${id}`, 'new-position');
						};
					}}
				>
					<input type="hidden" name="id" value={selected.id} />
					<button
						type="submit"
						class={button('danger-text', 'md', true)}
						aria-busy={removing}
						aria-label={removing ? 'Removing position' : undefined}
					>
						{#if removing}<Spinner />{:else}<Icon name="trash" size={20} /> Remove position{/if}
					</button>
				</form>
			{/if}
		{/snippet}
	</Sheet>
{/if}

{#if creating}
	<Sheet title="New position" open={true} onclose={() => (creating = false)}>
		<form
			id="new-position"
			method="POST"
			action="?/create"
			class="flex flex-col gap-3.5"
			use:guarded={{
				label: 'New position',
				submit: ({ cancel }) => {
					// One position per tap: a second tap while the first is out is dropped.
					if (busy) return cancel();
					busy = true;
					return async ({ result, update }) => {
						await update();
						busy = false;
						if (result.type === 'success') creating = false;
					};
				}
			}}
		>
			<div>
				<label class={LABEL} for="new-position-name">Name</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="new-position-name"
					name="name"
					required
					autofocus
					maxlength="80"
					value={createRefusal?.name ?? ''}
					class={FIELD}
					aria-invalid={createRefusal?.message ? 'true' : undefined}
					aria-describedby={createRefusal?.message ? 'new-position-name-error' : undefined}
				/>
				{#if createRefusal?.message}<FieldError
						id="new-position-name-error"
						message={createRefusal.message}
					/>{/if}
			</div>
		</form>

		{#snippet footer()}
			<button
				type="submit"
				form="new-position"
				class={button('primary', 'md', true)}
				aria-busy={busy}
				aria-label={busy ? 'Adding position' : undefined}
			>
				{#if busy}<Spinner />{:else}Add position{/if}
			</button>
		{/snippet}
	</Sheet>
{/if}

<Toast
	toast={toast && {
		id: toast.id,
		message: toast.message,
		action: toast.undo ? 'Undo' : undefined
	}}
	bottom="calc(1rem + var(--pin-bottom, 0px) + var(--pin-safe, var(--safe-bottom)))"
	onaction={undoRemoval}
	ondismiss={() => (toast = null)}
/>
