<script lang="ts">
	import { enhance } from '$app/forms';
	import { gotoWhenSettled, refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ChoiceSheet from '$lib/components/system/ChoiceSheet.svelte';
	import PositionFields from './PositionFields.svelte';
	import { LABEL, button } from '$lib/components/ui/styles';
	import { SHEET, editTitle, pictureLine, spotVideoLabel } from '$lib/positions/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { LinkedSpot, PositionSummary } from '$lib/types';

	/**
	 * New position and Edit <name>: the fields, then (edit) the picture and
	 * Archive. The form posts to `action`; a refusal stays in the sheet (under
	 * its field, or a Banner) with the button back, and a save that goes to a
	 * page (New) closes the sheet first.
	 */
	let {
		open,
		onclose,
		mode,
		action,
		dance,
		position,
		points = [],
		defaultStyle,
		seen
	}: {
		open: boolean;
		onclose: () => void;
		mode: 'new' | 'edit';
		/** Where the form posts: `?/create` on the list, `?/update` on a position's page. */
		action: string;
		dance: DanceSlug;
		/** Edit's position. */
		position?: PositionSummary & { notes: string | null; pictureSpotId: number | null };
		/** Edit's Picture: the points linked to the position. */
		points?: LinkedSpot[];
		/** New's type: Settings' "New figures" type. */
		defaultStyle: string;
		/** A group's position: what the editor saw, for the clash check. */
		seen?: Record<string, string | number | null>;
	} = $props();

	const formId = $props.id();
	let busy = $state(false);
	let archiving = $state(false);
	let errors = $state<Partial<Record<'name' | 'notes', string>>>({});
	let refused = $state<string | null>(null);
	let choosing = $state(false);
	// svelte-ignore state_referenced_locally
	let pictureId = $state<number | null>(position?.pictureSpotId ?? null);
	const picture = $derived(
		points.find((p) => p.spot.id === pictureId) ?? points.find((p) => p.point) ?? null
	);
	const pointChoices = $derived(
		points
			.filter((p) => p.point)
			.map((p) => ({
				value: String(p.spot.id),
				label: pictureLine(spotVideoLabel(p.video), p.spot.startMs)
			}))
	);

	/** A refusal's words, wherever they show: under the field it names, else a Banner. */
	function refuse(data: unknown) {
		const d = data as { field?: unknown; message?: unknown; clash?: unknown } | undefined;
		// A clash opens its own sheet (`guarded`); nothing to show here.
		if (d?.clash) return;
		const message = typeof d?.message === 'string' ? d.message : 'That did not save. Try again.';
		if (d?.field === 'name' || d?.field === 'notes') errors = { [d.field]: message };
		else refused = message;
	}
</script>

<Sheet
	title={mode === 'new' ? SHEET.newTitle : editTitle(position?.name ?? '')}
	sub={mode === 'new' ? SHEET.newSub : undefined}
	{open}
	{onclose}
>
	<form
		id={formId}
		method="POST"
		{action}
		class="flex flex-col gap-3.5"
		use:guarded={{
			label: mode === 'new' ? SHEET.newTitle : editTitle(position?.name ?? ''),
			submit: ({ cancel }) => {
				// One save per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				errors = {};
				refused = null;
				return async ({ result }) => {
					try {
						if (result.type === 'redirect') {
							// New: the position's page opens once the sheet's Back has landed.
							onclose();
							await gotoWhenSettled(result.location);
						} else if (result.type === 'failure') {
							refuse(result.data);
						} else if (result.type === 'error') {
							refused = 'That did not save. Try again.';
						} else {
							onclose();
							await refreshWhenSettled();
						}
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		{#if seen}<input type="hidden" name="seen" value={JSON.stringify(seen)} />{/if}
		<PositionFields
			{dance}
			name={position?.name ?? ''}
			styleTag={mode === 'new' ? defaultStyle : (position?.styleTag ?? null)}
			hold={position?.hold}
			notes={position?.notes ?? ''}
			{errors}
			autofocus={mode === 'new'}
		/>

		{#if mode === 'edit' && picture}
			<div>
				<span class={LABEL}>{SHEET.picture}</span>
				<input type="hidden" name="pictureSpotId" value={picture.spot.id} />
				<div class="flex items-center gap-2 pl-1">
					<p class="min-w-0 flex-1 text-[14px] leading-[1.4] text-ink-2">
						{pictureLine(spotVideoLabel(picture.video), picture.spot.startMs)}
					</p>
					{#if pointChoices.length > 1}
						<button type="button" class={button('tertiary', 'sm')} onclick={() => (choosing = true)}
							>{SHEET.change}</button
						>
					{/if}
				</div>
			</div>
		{/if}
	</form>

	{#if mode === 'edit'}
		<div class="mt-5 flex flex-col gap-1.5 border-t border-hairline pt-4">
			<form
				method="POST"
				action="?/archive"
				use:enhance={({ cancel }) => {
					if (archiving) return cancel();
					archiving = true;
					refused = null;
					return async ({ result }) => {
						try {
							if (result.type === 'redirect') {
								onclose();
								await gotoWhenSettled(result.location, { replaceState: true });
							} else if (result.type === 'failure' || result.type === 'error') {
								refused =
									result.type === 'failure' &&
									typeof (result.data as { message?: unknown })?.message === 'string'
										? (result.data as { message: string }).message
										: 'That did not archive. Try again.';
							} else {
								onclose();
								await refreshWhenSettled();
							}
						} finally {
							archiving = false;
						}
					};
				}}
			>
				<button
					type="submit"
					class={button('danger-text', 'md')}
					aria-busy={archiving}
					aria-label={archiving ? 'Archiving position' : undefined}
				>
					{#if archiving}<Spinner />{:else}<Icon name="trash" size={20} />{SHEET.archive}{/if}
				</button>
			</form>
			<p class="px-3.5 text-[13px] leading-[1.4] text-muted">{SHEET.archiveBody}</p>
		</div>
	{/if}

	{#snippet footer()}
		<button
			type="submit"
			form={formId}
			class={button('primary', 'md', true)}
			aria-busy={busy}
			aria-label={busy ? (mode === 'new' ? 'Adding position' : 'Saving') : undefined}
		>
			{#if busy}<Spinner />{:else}{mode === 'new' ? SHEET.add : SHEET.save}{/if}
		</button>
	{/snippet}
</Sheet>

{#if choosing}
	<ChoiceSheet
		open={true}
		title={SHEET.picture}
		legend={SHEET.pictureLegend}
		options={pointChoices}
		value={picture ? String(picture.spot.id) : ''}
		onpick={(v) => {
			pictureId = Number(v);
			choosing = false;
		}}
		onclose={() => (choosing = false)}
	/>
{/if}
