<script lang="ts">
	/**
	 * A form field whose value is picked from a list: it shows the current row
	 * (or a muted placeholder) and a chevron, opens the picker on top of the
	 * form (a stacked level: Back, no ×), and posts the chosen row's `value`
	 * under `name`. Picking fills the field and returns to the form; nothing
	 * else in the form is touched.
	 */
	import Picker from './Picker.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { LABEL, SELECT } from '$lib/components/ui/styles';
	import { isHeading, type PickGroup, type PickRow } from '$lib/picker/model';

	interface Props {
		/** Hidden input's name; posts the chosen row's `value`. */
		name: string;
		label: string;
		/** "Choose a figure…" */
		placeholder: string;
		/** The picker's title. */
		title: string;
		/** The picker's search placeholder. */
		search: string;
		groups: PickGroup[];
		nothingLeft: string;
		/** A row's `value`. */
		value: number | null;
		required?: boolean;
		/** A refusal about this field, shown under it. */
		error?: string | null;
		/** 'dark': the picker opens as a layer inside the player (its `.theme-media` colours it). */
		theme?: 'light' | 'dark';
		/** Bindable, so a host (the player) can tie it to history. */
		open?: boolean;
	}

	let {
		name,
		label,
		placeholder,
		title,
		search,
		groups,
		nothingLeft,
		value = $bindable(),
		required = false,
		error = null,
		theme = 'light',
		open = $bindable(false)
	}: Props = $props();

	const id = $props.id();

	/** The first row holding `value`: the near group's copy when a row is in two groups. */
	const current = $derived.by((): PickRow | null => {
		if (value == null) return null;
		for (const g of groups) {
			for (const e of g.entries) {
				const rows = isHeading(e) ? e.rows : [e];
				const hit = rows.find((r) => r.value === value);
				if (hit) return hit;
			}
		}
		return null;
	});
</script>

<div>
	<span id="{id}-label" class={LABEL}>{label}</span>
	<div class="relative">
		<!--
			The button stands in for a field: aria-invalid is what SELECT's red
			border keys on, and what tells a screen reader the refusal is about it.
		-->
		<!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
		<button
			type="button"
			class={SELECT}
			aria-labelledby="{id}-label {id}-value"
			aria-haspopup="dialog"
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-error` : undefined}
			onclick={() => (open = true)}
		>
			<span
				id="{id}-value"
				class="min-w-0 flex-1 truncate text-[16px] {current
					? 'font-semibold text-ink'
					: 'font-medium text-muted'}">{current ? current.label : placeholder}</span
			>
			<span class="flex flex-none text-muted"><Icon name="chevron-down" size={20} /></span>
		</button>
		<!--
			What the form posts. Not type="hidden": a hidden input is never validated,
			so `required` would do nothing. Out of reach and invisible, under the field,
			where the browser's "fill out this field" bubble then points. The browser
			focuses it then, so typing is undone: only a pick sets it.
		-->
		<input
			{name}
			value={value ?? ''}
			{required}
			tabindex="-1"
			aria-hidden="true"
			inputmode="none"
			autocomplete="off"
			oninput={(e) => (e.currentTarget.value = value == null ? '' : String(value))}
			class="pointer-events-none absolute bottom-0 left-3 size-px opacity-0"
		/>
	</div>
	{#if error}<FieldError id="{id}-error" message={error} />{/if}
</div>

<Picker
	{open}
	{title}
	placeholder={search}
	{groups}
	kind="field"
	chosen={current?.key ?? null}
	{nothingLeft}
	{theme}
	back
	onpick={(row) => {
		value = row.value;
		open = false;
	}}
	onclose={() => (open = false)}
/>
