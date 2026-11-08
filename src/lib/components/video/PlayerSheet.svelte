<!-- src/lib/components/video/PlayerSheet.svelte -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '$lib/i18n/catalog';
	import { MAX_SPOT_LABEL } from '$lib/limits';
	import { spotLabel } from '$lib/video/spots';
	import type { PlayerSheet } from '$lib/video/screens';
	import type { Spot } from '$lib/types';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import PlayerLayer from '$lib/components/ui/PlayerLayer.svelte';
	import { button, FIELD, LABEL } from '$lib/components/ui/styles';
	import {
		KEY_CAP,
		SHEET_DANGER as FLEX_DANGER,
		SHEET_PRIMARY as FLEX_PRIMARY,
		SHEET_SECONDARY as FLEX_SECONDARY
	} from './styles';
	import { deleteCopy, spotLine } from '$lib/video/chrome';

	/**
	 * A bottom sheet inside the player's stage — not a second `<dialog>`: one
	 * opened inside browser fullscreen is not reliably drawn above it. Nothing
	 * here takes focus by itself, so the phone's keyboard opens only when the
	 * name field is tapped.
	 */
	interface Props {
		kind: Exclude<PlayerSheet, 'list'>;
		spot: Spot | null;
		/** Rename: a name to offer in place of the section's own (the Link popup's first link). */
		name?: string;
		/** A refusal from the server (a 409 on delete), shown in the sheet. */
		message: string | null;
		oncancel: () => void;
		onrename: (label: string) => void;
		ondelete: () => void;
	}

	let { kind, spot, name, message, oncancel, onrename, ondelete }: Props = $props();

	let label = $state(untrack(() => name ?? spot?.label ?? ''));

	const w = $derived(t().video);
	/** The keys as printed on them, and what each does. */
	const KEYS = $derived<[string, string][]>([
		['Space', w.keys.toggle],
		['← →', w.keys.second],
		[', .', w.keys.tenth],
		['M', w.keys.mark],
		['S', w.keys.section],
		['I O', w.keys.edges],
		['[ ]', w.keys.jump],
		['L', w.keys.loop],
		['Esc', w.keys.back],
		['?', w.keys.help]
	]);
</script>

{#if kind === 'rename' && spot}
	<PlayerLayer
		shape="sheet"
		size="small"
		title={w.editor.rename}
		sub={spotLine(spot)}
		z="z-40"
		onclose={oncancel}
	>
		<form
			id="spot-rename"
			onsubmit={(e) => {
				e.preventDefault();
				onrename(label);
			}}
		>
			<label for="spot-name" class={LABEL}>{w.sheet.name}</label>
			<input
				id="spot-name"
				type="text"
				maxlength={MAX_SPOT_LABEL}
				placeholder={spotLabel({ ...spot, label: null })}
				aria-describedby="spot-name-help"
				bind:value={label}
				class={FIELD}
			/>
			<p id="spot-name-help" class="mt-1.5 pl-1 text-[13px] text-muted">
				{w.sheet.nameHelp}
			</p>
		</form>
		{#snippet footer()}
			<div class="flex gap-2">
				<button type="button" class={FLEX_SECONDARY} onclick={oncancel}>{t().common.cancel}</button>
				<button type="submit" form="spot-rename" class={FLEX_PRIMARY}>{t().common.save}</button>
			</div>
		{/snippet}
	</PlayerLayer>
{:else if kind === 'delete' && spot}
	{@const copy = deleteCopy(spot)}
	<PlayerLayer shape="sheet" title={copy.title} sub={copy.sub} z="z-40" onclose={oncancel}>
		<div class="flex flex-col gap-3">
			{#if message}<Banner kind="error" title={message} />{/if}
			{#if copy.blocked}
				<Banner kind="warning" title={copy.blocked.title}>{copy.blocked.body}</Banner>
			{:else}
				<p class="text-[15px] leading-[1.45] text-ink-2">{copy.body}</p>
			{/if}
		</div>
		{#snippet footer()}
			<div class="flex gap-2">
				<button type="button" class={FLEX_SECONDARY} onclick={oncancel}>{w.sheet.keep}</button>
				<button type="button" class={FLEX_DANGER} disabled={!!copy.blocked} onclick={ondelete}
					><Icon name="trash" size={20} />{t().common.delete}</button
				>
			</div>
		{/snippet}
	</PlayerLayer>
{:else if kind === 'keys'}
	<PlayerLayer shape="sheet" title={w.keys.title} z="z-40" onclose={oncancel}>
		<dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
			{#each KEYS as [k, what] (k)}
				<dt>
					<kbd class={KEY_CAP}>{k}</kbd>
				</dt>
				<dd class="text-[14px] text-ink-2">{what}</dd>
			{/each}
		</dl>
		{#snippet footer()}
			<button type="button" class={button('secondary', 'md', true)} onclick={oncancel}
				>{t().common.close}</button
			>
		{/snippet}
	</PlayerLayer>
{/if}
