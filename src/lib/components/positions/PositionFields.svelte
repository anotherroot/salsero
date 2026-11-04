<script lang="ts">
	import { DANCES, type DanceSlug } from '$lib/dances/dances';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { CHIP, FIELD, LABEL, TEXTAREA } from '$lib/components/ui/styles';
	import { EMPTY_HOLD, FACING, FACING_LABEL, FRAME, FRAME_LABEL } from '$lib/positions/hold';
	import { SHEET } from '$lib/positions/view';
	import type { Facing, Frame, Hands, Hold } from '$lib/types';

	/**
	 * A position's fields, for New position, Edit and the figure picker's
	 * create step: Name, Type (one), the hold (Hands, Crossed, Facing, Frame)
	 * and Notes. Each hold part may stay unknown: a tap on the picked one
	 * clears it, and the form sends nothing for it.
	 */
	interface Props {
		dance: DanceSlug;
		name?: string;
		/** The picked type; null picks none (an untyped position reads as Other). */
		styleTag?: string | null;
		hold?: Hold;
		notes?: string | null;
		/** Refusals, each shown under its own field. */
		errors?: Partial<Record<'name' | 'notes', string>>;
		/** Whether Name takes focus on mount: New position wants it, Edit does not. */
		autofocus?: boolean;
	}

	let {
		dance,
		name = '',
		styleTag = null,
		hold = EMPTY_HOLD,
		notes = '',
		errors = {},
		autofocus = false
	}: Props = $props();

	const d = $derived(DANCES[dance]);
	// The form owns these from here: the props only seed them.
	// svelte-ignore state_referenced_locally
	let hands = $state<Hands | null>(hold.hands);
	// svelte-ignore state_referenced_locally
	let crossed = $state(hold.crossed === true);
	// svelte-ignore state_referenced_locally
	let facing = $state<Facing | null>(hold.facing);
	// svelte-ignore state_referenced_locally
	let frame = $state<Frame | null>(hold.frame);

	const HANDS_ITEMS: { value: Hands; label: string }[] = [
		{ value: 'two', label: 'Two' },
		{ value: 'one', label: 'One' },
		{ value: 'none', label: 'None' }
	];
	const FACING_ITEMS = FACING.map((f) => ({ value: f, label: FACING_LABEL[f] }));
	const FRAME_ITEMS = FRAME.map((f) => ({ value: f, label: FRAME_LABEL[f] }));

	// A sheet and the picker's create step can be open at once: ids per instance.
	const uid = $props.id();
	const invalid = (k: 'name' | 'notes') => (errors[k] ? 'true' : undefined);
	const describe = (k: 'name' | 'notes') => (errors[k] ? `${uid}-${k}-error` : undefined);
</script>

<div>
	<label class={LABEL} for="{uid}-name">Name</label>
	<!-- svelte-ignore a11y_autofocus -->
	<input
		id="{uid}-name"
		name="name"
		required
		{autofocus}
		maxlength="200"
		placeholder="e.g. Cerrada, Manos cruzadas"
		value={name}
		class={FIELD}
		aria-invalid={invalid('name')}
		aria-describedby={describe('name')}
	/>
	{#if errors.name}<FieldError id="{uid}-name-error" message={errors.name} />{/if}
</div>

<fieldset>
	<legend class={LABEL}>Type</legend>
	<div class="flex flex-wrap gap-2" aria-describedby="{uid}-type-help">
		{#each d.styles as s (s)}
			<label class={CHIP}>
				<input type="radio" name="styleTag" value={s} checked={styleTag === s} class="sr-only" />
				{d.styleLabel[s]}
			</label>
		{/each}
	</div>
	<p id="{uid}-type-help" class="mt-1.5 pl-1 text-[13px] text-muted">{SHEET.typeHelp}</p>
</fieldset>

<div>
	<span class={LABEL}>Hands</span>
	<Segmented name="hands" label="Hands" items={HANDS_ITEMS} bind:value={hands} clearable />
</div>

<div class="flex min-h-[52px] items-center gap-3">
	<span class="flex flex-1 flex-col gap-px">
		<span class="text-[16px] font-bold text-ink">Crossed</span>
		<span class="text-[13px] text-muted">{SHEET.crossed}</span>
	</span>
	<!-- The Switch posts nothing itself: `crossed` is '1' when on, absent (unknown) when off. -->
	<Switch label="Crossed" bind:checked={crossed} />
	{#if crossed}<input type="hidden" name="crossed" value="1" />{/if}
</div>

<div>
	<span class={LABEL}>Facing</span>
	<Segmented name="facing" label="Facing" items={FACING_ITEMS} bind:value={facing} clearable />
</div>

<div>
	<span class={LABEL}>Frame</span>
	<Segmented name="frame" label="Frame" items={FRAME_ITEMS} bind:value={frame} clearable />
</div>

<div>
	<label class={LABEL} for="{uid}-notes">Notes</label>
	<textarea
		id="{uid}-notes"
		name="notes"
		rows="3"
		maxlength="2000"
		placeholder="How the hands meet, where the weight is…"
		class={TEXTAREA}
		aria-invalid={invalid('notes')}
		aria-describedby={describe('notes')}>{notes ?? ''}</textarea
	>
	{#if errors.notes}<FieldError id="{uid}-notes-error" message={errors.notes} />{/if}
</div>
