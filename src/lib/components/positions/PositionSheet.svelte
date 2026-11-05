<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import PositionForm from './PositionForm.svelte';
	import { button } from '$lib/components/ui/styles';
	import { BUSY, SHEET, editTitle } from '$lib/positions/view';
	import type { DanceSlug } from '$lib/dances/dances';
	import type { LinkedSpot, PositionSummary } from '$lib/types';

	/**
	 * New position and Edit <name> in a sheet: `PositionForm` (the fields, then
	 * (edit) the picture and Archive), and the Save in the sheet's footer. A
	 * refusal stays in the sheet with the button back, and a save that goes to a
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
</script>

<Sheet
	title={mode === 'new' ? SHEET.newTitle : editTitle(position?.name ?? '')}
	sub={mode === 'new' ? SHEET.newSub : undefined}
	{open}
	{onclose}
>
	<PositionForm
		onsaved={onclose}
		{formId}
		bind:busy
		{mode}
		{action}
		{dance}
		{position}
		{points}
		{defaultStyle}
		{seen}
	/>

	{#snippet footer()}
		<button
			type="submit"
			form={formId}
			class={button('primary', 'md', true)}
			aria-busy={busy}
			aria-label={busy ? (mode === 'new' ? BUSY.adding : BUSY.saving) : undefined}
		>
			{#if busy}<Spinner />{:else}{mode === 'new' ? SHEET.add : SHEET.save}{/if}
		</button>
	{/snippet}
</Sheet>
