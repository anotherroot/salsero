<!-- src/lib/components/video/SpotList.svelte -->
<script lang="ts">
	import { spotLabel } from '$lib/video/spots';
	import { listMeta } from '$lib/video/chrome';
	import type { Snippet } from 'svelte';
	import type { Spot } from '$lib/types';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { iconButton, SECTION_LABEL } from '$lib/components/ui/styles';
	import { playerButton } from './styles';

	/**
	 * The player's list of sections and points, with its own header. `sheet` is
	 * portrait's All sheet, `panel` landscape's side panel (Edit on every card);
	 * `sidebar` is the desktop's (tighter rows, Edit on the open card).
	 */
	interface Props {
		spots: Spot[];
		/** The section whose view is open: highlighted. */
		activeId: number | null;
		loadFailed: boolean;
		variant: 'sheet' | 'panel' | 'sidebar';
		onopen: (spot: Spot) => void;
		onedit?: (spot: Spot) => void;
		onclose?: () => void;
		/** The desktop sidebar: the open spot's card expanded in place into its editor. */
		expanded?: Snippet<[Spot]>;
	}

	let { spots, activeId, loadFailed, variant, onopen, onedit, onclose, expanded }: Props = $props();

	const sidebar = $derived(variant === 'sidebar');
	// The 36 px pill sits in a 44 px button (the cell), so the hit area holds.
	const EDIT = playerButton('neutral', 'sm').replace('px-3', 'pr-3 pl-2.5');
	const EDIT_ACCENT = playerButton('accent', 'sm').replace('px-3', 'pr-3 pl-2.5');
</script>

{#snippet linkedLine(s: Spot)}
	<span class="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
		<Icon name="link" size={13} />Linked to {s.linkedTo.join(', ')}
	</span>
{/snippet}

{#snippet close()}
	<button type="button" class={iconButton('bare')} aria-label="Close list" onclick={onclose}>
		<Icon name="close" size={22} />
	</button>
{/snippet}

{#if variant === 'sheet'}
	<div class="mx-auto h-[5px] w-10 flex-none rounded-full bg-hairline"></div>
	<div class="-mr-1.5 flex min-h-11 flex-none items-center pl-1">
		<h3 class="flex-1 font-display text-[22px] font-extrabold">Sections and points</h3>
		<span class="mr-1 text-[14px] font-bold text-muted tabular-nums">{spots.length}</span>
		{@render close()}
	</div>
{:else if variant === 'panel'}
	<div class="flex h-[52px] flex-none items-center pr-1 pl-4">
		<h3 class="flex-1 text-[16px] font-bold">Sections and points · {spots.length}</h3>
		{@render close()}
	</div>
{:else}
	<h3 class="{SECTION_LABEL} flex-none pt-3 pb-1.5">Sections and points · {spots.length}</h3>
{/if}

{#if loadFailed}
	<p
		role="alert"
		class="flex flex-none items-center gap-2 px-5 py-1 text-[13px] font-bold text-danger"
	>
		<Icon name="warning" size={16} />Couldn't load spots
	</p>
{:else if spots.length === 0}
	<p class="flex-none px-5 py-1 text-[13px] leading-[1.45] text-muted">
		Nothing marked yet. <b class="font-bold text-ink-2">Mark point</b> saves this moment;
		<b class="font-bold text-ink-2">Start section</b> saves a stretch to loop.
	</p>
{/if}
<ul
	class="min-h-0 flex-1 overflow-y-auto rounded-2xl {sidebar
		? 'mb-4'
		: variant === 'panel'
			? 'mx-3 mb-3 bg-surface'
			: 'bg-surface'}"
>
	{#each spots as s, i (s.id)}
		{@const active = s.id === activeId}
		{@const last = i === spots.length - 1}
		{@const rule = last ? '' : 'border-b border-hairline'}
		{#if sidebar && active && expanded}
			<li class="px-3 py-1.5">{@render expanded(s)}</li>
		{:else if sidebar}
			<li class="flex items-center gap-2 pr-3 pl-1.5">
				<button
					type="button"
					class="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl px-3 py-1.5 text-left hover:bg-surface {active
						? 'bg-surface'
						: ''}"
					aria-current={active ? 'true' : undefined}
					onclick={() => onopen(s)}
				>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="truncate text-[15px] font-bold">{spotLabel(s)}</span>
						<span class="text-[13px] text-muted tabular-nums">{listMeta(s)}</span>
						{#if s.linkedTo.length > 0}
							{@render linkedLine(s)}
						{/if}
					</span>
				</button>
				{#if active && onedit}
					<button
						type="button"
						class="flex h-11 flex-none cursor-pointer items-center"
						aria-label="Edit {spotLabel(s)}"
						onclick={() => onedit?.(s)}
					>
						<span class={EDIT_ACCENT}><Icon name="edit" size={15} />Edit</span>
					</button>
				{/if}
			</li>
		{:else}
			{@const sheet = variant === 'sheet'}
			<li class="flex items-center {sheet ? 'pl-3.5' : 'pl-3'}">
				<button
					type="button"
					class="flex min-w-0 flex-1 cursor-pointer items-center py-2 text-left {rule} {sheet
						? 'min-h-[62px] gap-3'
						: 'min-h-[52px] gap-2.5 py-1.5'} {active ? 'bg-step' : ''}"
					aria-current={active ? 'true' : undefined}
					onclick={() => onopen(s)}
				>
					{#if sheet}
						<span class="grid size-10 flex-none place-items-center rounded-xl bg-step text-ink-2">
							<Icon name={s.endMs === null ? 'flag' : 'repeat'} size={20} />
						</span>
					{:else}
						<span class="flex flex-none text-ink-2">
							<Icon name={s.endMs === null ? 'flag' : 'repeat'} size={20} />
						</span>
					{/if}
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="truncate font-bold {sheet ? 'text-[16px]' : 'text-[15px]'}"
							>{spotLabel(s)}</span
						>
						{#if sheet}
							<span class="text-[13px] text-muted tabular-nums">{listMeta(s)}</span>
							{#if s.linkedTo.length > 0}
								{@render linkedLine(s)}
							{/if}
						{:else}
							<span class="truncate text-[12.5px] text-muted tabular-nums"
								>{listMeta(s)}{#if s.linkedTo.length > 0}
									· <span class="text-ink-2">linked</span>{/if}</span
							>
						{/if}
					</span>
				</button>
				{#if onedit}
					<button
						type="button"
						class="flex min-h-11 flex-none cursor-pointer items-center self-stretch pr-2 pl-1 {rule}"
						aria-label="Edit {spotLabel(s)}"
						onclick={() => onedit?.(s)}
					>
						<span class={EDIT}><Icon name="edit" size={15} />Edit</span>
					</button>
				{/if}
			</li>
		{/if}
	{/each}
</ul>
