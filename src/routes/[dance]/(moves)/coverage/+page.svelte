<script lang="ts">
	import { fromTags } from '$lib/clones/from-tag';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import { resolve } from '$app/paths';
	import Screen from '$lib/components/ui/Screen.svelte';
	import BackButton from '$lib/components/shell/BackButton.svelte';
	import BandButton from '$lib/components/ui/BandButton.svelte';
	import { desk } from '$lib/nav/desk.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { FIELD, GROUP, LABEL, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { PAGE_WIDTH } from '$lib/nav/frame';
	import { claimBottom } from '$lib/nav/chrome.svelte';
	import { longPress } from '$lib/longpress';
	import { plural } from '$lib/format';
	import { groupHeading, pickNumber, pickedRows, togglePick } from '$lib/moves/picks';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const refusal = $derived(
		(form ?? null) as { field?: string; message?: string; name?: string } | null
	);
	const nameError = $derived(refusal?.field === 'name' ? refusal.message : undefined);
	const bannerError = $derived(refusal?.field ? undefined : refusal?.message);

	/** Picked version ids, in tap order — the new routine's slot order. */
	let picked = $state<number[]>([]);
	let selecting = $state(false);
	// The selection bar takes the bottom edge; the tab bar steps aside while it shows.
	claimBottom(() => selecting);
	let naming = $state(false);
	let busy = $state(false);
	// The `form` that was there when the sheet opened: an older refusal is not this sheet's.
	let seen: unknown = $state(null);
	// A failed create re-renders with the message; keep the sheet open to show it.
	$effect(() => {
		if (form !== seen && refusal?.message) naming = true;
	});

	const rows = $derived(pickedRows(data.groups, picked));
	const hasRows = $derived(data.groups.some((g) => g.rows.length > 0));
	// Two versions with one label: a copy says where it came from.
	const tags = $derived(
		fromTags(
			data.groups.flatMap((g) =>
				g.rows.map((r) => ({ id: r.id, name: r.label, from: r.from ?? null }))
			)
		)
	);

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
		picked = togglePick(picked, id);
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
		resolve('/[dance]/(moves)/figures/[id]', { dance: data.dance.slug, id: String(id) });
</script>

<svelte:head><title>Coverage · {data.dance.label}</title></svelte:head>

<!-- On the desktop the selecting header reads "N selected" with a ×, as a routine's does; the phone keeps its title and Back. -->
<Screen
	title={selecting && desk.current ? `${picked.length} selected` : 'Coverage'}
	subtitle="Versions by how many routines use them"
	deskSubtitle={selecting ? 'Coverage' : 'Versions by how many routines use them'}
>
	{#snippet left()}
		{#if selecting && desk.current}
			<BandButton
				focusKey="stop-selecting"
				icon="close"
				label="Stop selecting"
				onclick={stopSelecting}
			/>
		{:else}
			<BackButton
				fallback={{
					href: resolve('/[dance]/(moves)/figures', { dance: data.dance.slug }),
					label: 'Back to Moves'
				}}
			/>
		{/if}
	{/snippet}
	{#snippet right()}
		{#if !selecting && hasRows}
			<span class="hidden desk:contents"
				><button type="button" class={button('tertiary', 'sm')} onclick={() => (selecting = true)}
					>Select</button
				></span
			>
			<span class="contents desk:hidden"
				><button
					type="button"
					class="h-11 flex-none cursor-pointer px-2.5 text-[16px] font-extrabold text-band-small"
					onclick={() => (selecting = true)}>Select</button
				></span
			>
		{/if}
	{/snippet}

	<div
		class="flex flex-col gap-2"
		style={selecting ? 'padding-bottom: calc(5.5rem + var(--safe-bottom))' : undefined}
	>
		{#if selecting}
			<p class="px-4 text-[13px] text-muted desk:hidden">
				Tap in the order the routine should call them.
			</p>
		{/if}
		{#if !hasRows}
			<EmptyState icon="moves" title="No figures yet" />
		{/if}
		{#each data.groups as group (group.key)}
			<h2
				id="g-{group.key}"
				class="{SECTION_LABEL} pt-3.5 {group.key === 'none' ? 'text-status' : ''}"
			>
				{groupHeading(group)}
			</h2>
			<ul class={GROUP} aria-labelledby="g-{group.key}">
				{#each group.rows as row (row.id)}
					{@const n = pickNumber(picked, row.id)}
					{@const meta = row.routines.map((r) => r.name).join(', ')}
					<li class={n ? 'bg-accent-soft' : ''}>
						<a
							href={href(row.id)}
							class="flex w-full items-center gap-3 py-[9px] pr-3.5 pl-4 select-none [-webkit-touch-callout:none] active:bg-step {meta
								? 'min-h-16'
								: 'min-h-[52px]'}"
							onpointerdown={(e) => press.down(row.id, e.clientX, e.clientY)}
							onpointermove={(e) => press.move(e.clientX, e.clientY)}
							onpointerup={() => press.up()}
							onpointercancel={() => press.up()}
							oncontextmenu={(e) => e.preventDefault()}
							onclick={(e) => rowClick(e, row.id)}
						>
							{#if selecting}
								<span
									class="flex size-[26px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold {n
										? 'bg-accent text-on-accent'
										: 'border-2 border-muted'}"
									aria-hidden="true">{n ?? ''}</span
								>
								<span class="sr-only">{n ? 'Selected,' : 'Not selected,'}</span>
							{/if}
							<span class="flex min-w-0 flex-1 flex-col gap-0.5">
								<span class="text-[16px] leading-[1.3] font-bold break-words text-ink"
									>{row.label}{#if tags.get(row.id)}<span class="ml-1 font-normal text-muted"
											>{tags.get(row.id)}</span
										>{/if}</span
								>
								{#if meta}
									<!-- muted is under 4.5:1 on a picked row's tint; ink-2 clears it. -->
									<span
										class="truncate text-[13px] leading-[1.35] {n ? 'text-ink-2' : 'text-muted'}"
										>{meta}</span
									>
								{/if}
							</span>
							{#if !selecting}
								<span class="flex flex-none text-chevron"
									><Icon name="chevron-right" size={20} /></span
								>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/each}
	</div>
</Screen>

{#if selecting}
	<div
		class="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[560px] border-t border-tab-line bg-tab-bg pt-3 pr-4 pl-5 desk:left-(--pane-left) desk:max-w-none"
		style="padding-bottom: calc(12px + var(--safe-bottom)); --bar-w: {PAGE_WIDTH.one}px"
	>
		<!-- On the desk the content is centred in the pane, as wide as the page. -->
		<div class="mx-auto flex items-center gap-1 desk:max-w-(--bar-w)">
			<span role="status" class="flex-1 text-[16px] font-bold text-ink desk:sr-only"
				>{picked.length} selected</span
			>
			<span class="hidden flex-1 text-[13px] text-muted desk:inline"
				>Tap in the order the routine should call them.</span
			>
			<button type="button" class={button('tertiary', 'sm')} onclick={stopSelecting}>Cancel</button>
			<button
				type="button"
				disabled={picked.length === 0}
				class={button('primary', 'sm')}
				onclick={() => {
					seen = form;
					naming = true;
				}}><Icon name="plus" size={20} /> Create routine</button
			>
		</div>
	</div>
{/if}

{#if naming}
	<Sheet title="New routine" open={true} onclose={() => (naming = false)}>
		<form
			id="cover-routine"
			method="POST"
			action="?/create"
			class="flex flex-col gap-3.5"
			use:guarded={{
				label: 'New routine',
				submit: ({ cancel }) => {
					if (busy) return cancel();
					busy = true;
					// `update` follows the redirect to the new routine page.
					return async ({ update }) => {
						await update();
						busy = false;
					};
				}
			}}
		>
			{#if bannerError}<Banner kind="error">{bannerError}</Banner>{/if}
			{#each picked as id (id)}
				<input type="hidden" name="figureIds" value={id} />
			{/each}
			<div>
				<label class={LABEL} for="cover-routine-name">Name</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="cover-routine-name"
					name="name"
					required
					autofocus
					maxlength="200"
					value={refusal?.name ?? ''}
					placeholder="Basic combo"
					class={FIELD}
					aria-invalid={nameError ? 'true' : undefined}
					aria-describedby={nameError ? 'cover-routine-name-error' : undefined}
				/>
				{#if nameError}<FieldError id="cover-routine-name-error" message={nameError} />{/if}
			</div>
			<ul class={GROUP} aria-label="Picked versions">
				{#each rows as r, i (r.id)}
					<li class="flex min-h-12 items-center gap-3 px-4 py-2">
						<span
							class="flex size-[26px] flex-none items-center justify-center rounded-full bg-accent text-[13px] font-extrabold text-on-accent"
							aria-hidden="true">{i + 1}</span
						>
						<span class="min-w-0 flex-1 text-[16px] font-bold break-words text-ink">{r.label}</span>
					</li>
				{/each}
			</ul>
			<p class="px-1 text-[13px] leading-[1.4] text-muted">
				{plural(picked.length, 'figure', 'figures')}, in the order you picked them. Put them in
				order on the routine page.
			</p>
		</form>

		{#snippet footer()}
			<button
				type="submit"
				form="cover-routine"
				class={button('primary', 'md', true)}
				aria-busy={busy}
				aria-label={busy ? 'Creating routine' : undefined}
			>
				{#if busy}<Spinner />{:else}Create routine{/if}
			</button>
		{/snippet}
	</Sheet>
{/if}
