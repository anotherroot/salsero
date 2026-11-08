<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { gotoWhenSettled, refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import { memberRoute } from '$lib/clones/pages';
	import { separateLabel, versionsTitle } from '$lib/clones/view';
	import { syncMenu, keepLine } from '$lib/clones/step-view';
	import type { VersionLine } from '$lib/clones/versions';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { CloneKind, SyncSettings } from '$lib/types';

	/**
	 * Versions (spec 2026-11-06): every version of the item the person can
	 * open, what each is against this one, and the copies "Copies you can see"
	 * listed. A version opens in place of this page, as a tab did. Separate (for
	 * twins) and Sync… close the list first: Separate can leave one version,
	 * and the row with its list would go while open. Under the list, one quiet
	 * line says how this copy keeps in step (spec 2026-11-07, 4b A); it opens
	 * Keep in step as a level over the list (`onkeep`).
	 */
	let {
		open,
		onclose,
		lines,
		title,
		kind,
		dance,
		mineId,
		onsync,
		keep = null,
		onkeep
	}: {
		open: boolean;
		onclose: () => void;
		lines: VersionLine[];
		/** The item's name, under the sheet's title. */
		title: string;
		kind: CloneKind;
		dance: DanceSlug;
		/** The person's own member of the family, or null. */
		mineId: number | null;
		/** Sync…, when the page offers it; called once the list has closed. */
		onsync?: () => void;
		/** This copy's Keep in step settings: the line under the list. */
		keep?: SyncSettings | null;
		/** The line's tap: Keep in step opens over the list. */
		onkeep?: () => void;
	} = $props();

	function href(l: VersionLine): string {
		const page = resolve(memberRoute(kind), { dance, id: String(l.id) });
		// A twin is another family: nothing of it is taken into yours.
		return !l.twin && mineId !== null && l.id !== mineId ? `${page}?vs=${mineId}` : page;
	}

	function openVersion(e: MouseEvent, l: VersionLine) {
		e.preventDefault();
		// Close-then-go: the list's Back lands first, then the version replaces this page.
		onclose();
		void gotoWhenSettled(href(l), { replaceState: true, keepFocus: true, noScroll: true });
	}

	const twins = $derived(lines.some((l) => l.twin));
</script>

<Sheet
	title={versionsTitle()}
	sub={title}
	size="small"
	{open}
	{onclose}
	footer={onsync ? syncFooter : undefined}
>
	<ul class={GROUP}>
		{#each lines as l (l.id)}
			<li>
				{#if l.current}
					<div class="flex min-h-16 items-center gap-3 py-2 pr-3.5 pl-4" aria-current="page">
						{@render lead(l)}
						<span class="flex-none text-accent-text"><Icon name="check" size={22} /></span>
					</div>
				{:else}
					<a
						href={href(l)}
						class="flex min-h-16 items-center gap-3 py-2 pr-3.5 pl-4"
						onclick={(e) => openVersion(e, l)}
					>
						{@render lead(l)}
						{#if l.chip}<Badge tone={l.chip.tone}>{l.chip.text}</Badge>{/if}
						<span class="flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
					</a>
				{/if}
			</li>
		{/each}
	</ul>
	{#if keep && onkeep}
		<button
			type="button"
			class="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 text-left text-muted active:bg-step"
			aria-haspopup="dialog"
			onclick={onkeep}
		>
			<span class="flex-none"><Icon name="refresh" size={16} /></span>
			<span class="min-w-0 flex-1 text-[13px] leading-snug">{keepLine(keep)}</span>
			<span class="flex-none text-chevron"><Icon name="chevron-right" size={16} /></span>
		</button>
	{/if}
	{#if twins}
		<form
			method="POST"
			action="?/separate"
			class="pt-1 text-center"
			use:enhance={() => {
				onclose();
				return async () => {
					await refreshWhenSettled();
				};
			}}
		>
			<button type="submit" class={button('tertiary', 'sm')}>{separateLabel()}</button>
		</form>
	{/if}
</Sheet>

{#snippet syncFooter()}
	<button
		type="button"
		class={button('secondary', 'md', true)}
		aria-haspopup="dialog"
		onclick={() => {
			onclose();
			onsync?.();
		}}><Icon name="refresh" size={20} />{syncMenu()}</button
	>
{/snippet}

{#snippet lead(l: VersionLine)}
	<span
		class="flex size-10 flex-none items-center justify-center rounded-xl bg-accent-soft text-accent-text"
		aria-hidden="true"><Icon name={l.icon} size={22} /></span
	>
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="text-[16px] leading-tight font-bold text-ink">{l.label}</span>
		<span class="text-[13px] text-muted">{l.meta}</span>
	</span>
{/snippet}
