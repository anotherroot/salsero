<script lang="ts">
	import { enhance } from '$app/forms';
	import { gotoWhenSettled, refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ChoiceSheet from '$lib/components/system/ChoiceSheet.svelte';
	import PositionFields from './PositionFields.svelte';
	import PointStill from './PointStill.svelte';
	import { CLIP, LABEL, button } from '$lib/components/ui/styles';
	import {
		BUSY,
		SHEET,
		SHEET_FAILED,
		editTitle,
		pictureLine,
		spotVideoLabel
	} from '$lib/positions/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { LinkedSpot, PositionSummary } from '$lib/types';

	/**
	 * New position's and Edit <name>'s form: the fields, then (edit) the picture
	 * and Archive. The form posts to `action`; a refusal stays in the form (under
	 * its field, or a Banner) with the button back. A save or an archive that
	 * lands calls `onsaved` first (the sheet closes, the pane leaves edit mode),
	 * then the page refreshes or goes where the answer says.
	 *
	 * The Save button is the caller's (a sheet's footer, a pinned bar): it posts
	 * this form by `formId` and reads `busy`.
	 *
	 * `columns` (a position edited in its pane, desktop spec "Editing a position"):
	 * from `two:` (its own `cols` container) Name, Type and the hold on the left;
	 * Notes, the picture and Archive on the right. One column, in the sheet's
	 * order, below that. Without it the form is the sheet's, as it always was.
	 */
	let {
		onsaved,
		formId,
		busy = $bindable(false),
		columns = false,
		mode,
		action,
		dance,
		position,
		points = [],
		defaultStyle,
		seen
	}: {
		/** A save (or an archive) landed: close the sheet, or leave edit mode. */
		onsaved: () => void;
		/** The form's id, for the caller's Save button. */
		formId: string;
		/** A save is out. */
		busy?: boolean;
		/** Two columns from `two:`: the pane's edit mode. */
		columns?: boolean;
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
		const message = typeof d?.message === 'string' ? d.message : SHEET_FAILED.save;
		if (d?.field === 'name' || d?.field === 'notes') errors = { [d.field]: message };
		else refused = message;
	}

	/** A half of the two-column form: no box below `two:`, a column of the form's gap from it. */
	const HALF = 'contents two:flex two:min-w-0 two:flex-col two:gap-3.5';
</script>

{#snippet form()}
	<form
		id={formId}
		method="POST"
		{action}
		class={columns ? 'contents' : 'flex flex-col gap-3.5'}
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
							onsaved();
							await gotoWhenSettled(result.location, { invalidateAll: true });
						} else if (result.type === 'failure') {
							refuse(result.data);
						} else if (result.type === 'error') {
							refused = SHEET_FAILED.save;
						} else {
							onsaved();
							await refreshWhenSettled();
						}
					} finally {
						busy = false;
					}
				};
			}
		}}
	>
		{#if refused}
			{#if columns}
				<div class="two:col-span-2"><Banner kind="error">{refused}</Banner></div>
			{:else}
				<Banner kind="error">{refused}</Banner>
			{/if}
		{/if}
		{#if seen}<input type="hidden" name="seen" value={JSON.stringify(seen)} />{/if}
		{#if columns}
			<div class="{HALF} two:col-start-1 two:row-span-2">
				{@render fields('about')}
			</div>
			<div class="{HALF} two:col-start-2">
				{@render fields('notes')}
				{@render pictureField()}
			</div>
		{:else}
			{@render fields('all')}
			{@render pictureField()}
		{/if}
	</form>

	{#if mode === 'edit'}
		<div
			class={columns
				? 'flex flex-col gap-1.5 two:col-start-2'
				: 'mt-5 flex flex-col gap-1.5 border-t border-hairline pt-4'}
		>
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
								onsaved();
								await gotoWhenSettled(result.location, { replaceState: true, invalidateAll: true });
							} else if (result.type === 'failure' || result.type === 'error') {
								refused =
									result.type === 'failure' &&
									typeof (result.data as { message?: unknown })?.message === 'string'
										? (result.data as { message: string }).message
										: SHEET_FAILED.archive;
							} else {
								onsaved();
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
					aria-label={archiving ? BUSY.archiving : undefined}
				>
					{#if archiving}<Spinner />{:else}<Icon name="trash" size={20} />{SHEET.archive}{/if}
				</button>
			</form>
			<p class="px-3.5 text-[13px] leading-[1.4] text-muted">{SHEET.archiveBody}</p>
		</div>
	{/if}
{/snippet}

{#snippet fields(part: 'all' | 'about' | 'notes')}
	<PositionFields
		{dance}
		name={position?.name ?? ''}
		styleTag={mode === 'new' ? defaultStyle : (position?.styleTag ?? null)}
		hold={position?.hold}
		notes={position?.notes ?? ''}
		{errors}
		autofocus={mode === 'new'}
		{part}
	/>
{/snippet}

{#snippet pictureField()}
	{#if mode === 'edit' && picture}
		<div>
			<span class={LABEL}>{SHEET.picture}</span>
			<input type="hidden" name="pictureSpotId" value={picture.spot.id} />
			{#if columns}
				<!-- In the pane the picture shows as on the page: its still over the line. -->
				<div class="{CLIP} rounded-2xl bg-surface">
					<PointStill src={picture.video.src} ms={picture.spot.startMs} />
					<div class="flex min-h-11 items-center gap-2 py-1 pr-1.5 pl-3.5">
						<span class="flex-none text-muted"><Icon name="bookmark" size={18} /></span>
						<span class="min-w-0 flex-1 text-[13px] text-muted"
							>{pictureLine(spotVideoLabel(picture.video), picture.spot.startMs)}</span
						>
						{#if pointChoices.length > 1}
							<button
								type="button"
								class={button('tertiary', 'sm')}
								aria-haspopup="dialog"
								onclick={() => (choosing = true)}>{SHEET.change}</button
							>
						{/if}
					</div>
				</div>
			{:else}
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
			{/if}
		</div>
	{/if}
{/snippet}

{#if columns}
	<!--
		Its own `cols` container (`two:`, as PaneColumns'): the form's two halves and
		Archive in a 1 : 1 grid, 32 px apart, the left half spanning the last two rows
		so Archive follows the right half directly: the last row is flexible, and an
		item spanning a flexible track does not size the auto row (as in PaneColumns).
		A refusal's Banner, when there is one, is a first row across both. Nothing
		pinned inside: the Save bar and the picture's choice sheet are outside it.
	-->
	<div class="@container/cols">
		<div
			class="flex flex-col gap-3.5 two:grid two:grid-cols-[1fr_1fr] {refused
				? 'two:grid-rows-[auto_auto_1fr]'
				: 'two:grid-rows-[auto_1fr]'} two:items-start two:gap-x-8"
		>
			{@render form()}
		</div>
	</div>
{:else}
	{@render form()}
{/if}

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
