<script lang="ts">
	import { PARTNER, type Partner } from '$lib/labels';
	import { styleLabelsOf } from '$lib/moves/figures';
	import { t } from '$lib/i18n/catalog';
	import type { Dance } from '$lib/dances/dances';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { CHIP, FIELD, LABEL, TEXTAREA } from '$lib/components/ui/styles';

	interface Props {
		/** Whose styles the picker offers. The form is only ever inside one dance. */
		dance: Dance;
		/** The variation this form describes — "Doble". */
		name?: string;
		partner?: Partner;
		style?: string;
		notes?: string | null;
		/** Refusals, each shown under its own field. */
		errors?: Partial<Record<'name' | 'notes', string>>;
	}

	let { dance, name = '', partner = 'partner', style, notes = '', errors = {} }: Props = $props();

	// A new figure's page passes the user's default (Settings); without one it
	// starts on the dance's. 'salsa' is not a style bachata has, so the
	// fallback cannot be a literal.
	const checkedStyle = $derived(style ?? dance.defaultStyle);
	/** The style chips' words in the reader's language. */
	const styleLabel = $derived(styleLabelsOf(dance.styleLabel));

	// The lesson page renders two of these at once, so the ids are per instance.
	const uid = $props.id();
	const invalid = (k: 'name' | 'notes') => (errors[k] ? 'true' : undefined);
	const describe = (k: 'name' | 'notes') => (errors[k] ? `${uid}-${k}-error` : undefined);
</script>

<div>
	<label class={LABEL} for="{uid}-name">{t().moves.move.figureName}</label>
	<input
		id="{uid}-name"
		name="name"
		required
		maxlength="200"
		placeholder={t().figure.fields.figurePlaceholder}
		value={name}
		class={FIELD}
		aria-invalid={invalid('name')}
		aria-describedby={describe('name')}
	/>
	{#if errors.name}<FieldError id="{uid}-name-error" message={errors.name} />{/if}
</div>

<fieldset>
	<legend class={LABEL}>{t().figure.fields.danced}</legend>
	<div class="flex flex-wrap gap-2">
		{#each PARTNER as p (p)}
			<label class={CHIP}>
				<input type="radio" name="partner" value={p} checked={partner === p} class="sr-only" />
				{t().moves.chips[p]}
			</label>
		{/each}
	</div>
</fieldset>

<fieldset>
	<legend class={LABEL}>{t().figure.fields.style}</legend>
	<div class="flex flex-wrap gap-2">
		{#each dance.styles as s (s)}
			<label class={CHIP}>
				<input type="radio" name="style" value={s} checked={checkedStyle === s} class="sr-only" />
				{styleLabel[s]}
			</label>
		{/each}
	</div>
</fieldset>

<div>
	<label class={LABEL} for="{uid}-notes">{t().moves.routines.notes}</label>
	<textarea
		id="{uid}-notes"
		name="notes"
		rows="2"
		maxlength="2000"
		placeholder={t().figure.notes.placeholder}
		class={TEXTAREA}
		aria-invalid={invalid('notes')}
		aria-describedby={describe('notes')}>{notes ?? ''}</textarea
	>
	{#if errors.notes}<FieldError id="{uid}-notes-error" message={errors.notes} />{/if}
</div>
