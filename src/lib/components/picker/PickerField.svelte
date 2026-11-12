<script lang="ts">
	/**
	 * A form field whose value is picked from a list: it shows the current row
	 * (or a muted placeholder) and a chevron, opens the picker on top of the
	 * form (a stacked level: Back, no ×), and posts the chosen row's `value`
	 * under `name`. Picking fills the field and returns to the form; nothing
	 * else in the form is touched.
	 */
	import type { ComponentProps } from 'svelte';
	import Picker from './Picker.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { LABEL, SELECT, SELECT_INVALID } from '$lib/components/ui/styles';
	import { isHeading, type PickGroup, type PickRow } from '$lib/picker/model';
	import { moveFromQuery } from '$lib/figures/move-field';

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
		/**
		 * A create row: the search becomes a new row ("Create “Setenta” as + Move"),
		 * or the row whose name folds to the same (`moveFromQuery`). `label` is the
		 * button's noun, `tag` what the field shows after the new name, `name` what
		 * the new name posts as (the picked `name` then posts empty).
		 */
		create?: { label: string; tag: string; name: string };
		/** The new row's name while one is held; a pick clears it. Bindable. */
		newName?: string | null;
		/**
		 * Link from other places (a group's field): the person's other places
		 * while a search is typed (`Picker`'s `elsewhere`); a tap on one of
		 * their rows is `onelsewhere`. `query` is the search, bindable.
		 */
		elsewhere?: ComponentProps<typeof Picker>['elsewhere'];
		onelsewhere?: (row: PickRow) => void;
		query?: string;
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
		open = $bindable(false),
		create,
		newName = $bindable(null),
		elsewhere = null,
		onelsewhere,
		query = $bindable('')
	}: Props = $props();

	const id = $props.id();

	/** Every row as a name, for the create row's "same name" rule. */
	const named = $derived(
		groups.flatMap((g) =>
			g.entries
				.flatMap((e) => (isHeading(e) ? e.rows : [e]))
				.map((r) => ({ id: r.value, name: r.label }))
		)
	);

	function createFrom(query: string) {
		const choice = moveFromQuery(query, named);
		if (choice === null) return;
		if ('groupId' in choice) {
			value = choice.groupId;
			newName = null;
		} else {
			value = null;
			newName = choice.newName;
		}
		open = false;
	}

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
			The button stands in for a field. A button cannot carry aria-invalid,
			so the red border comes from `error` itself; aria-describedby still
			points a screen reader at the refusal.
		-->
		<button
			type="button"
			class={error ? SELECT_INVALID : SELECT}
			aria-labelledby="{id}-label {id}-value"
			aria-haspopup="dialog"
			aria-describedby={error ? `${id}-error` : undefined}
			onclick={() => (open = true)}
		>
			{#if newName && create}
				<span id="{id}-value" class="flex min-w-0 flex-1 items-baseline gap-2">
					<span class="min-w-0 truncate text-[16px] font-semibold text-ink">{newName}</span>
					<span class="flex-none text-[13px] font-bold text-accent-text">{create.tag}</span>
				</span>
			{:else}
				<span
					id="{id}-value"
					class="min-w-0 flex-1 truncate text-[16px] {current
						? 'font-semibold text-ink'
						: 'font-medium text-muted'}">{current ? current.label : placeholder}</span
				>
			{/if}
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
			required={required && !newName}
			tabindex="-1"
			aria-hidden="true"
			inputmode="none"
			autocomplete="off"
			oninput={(e) => (e.currentTarget.value = value == null ? '' : String(value))}
			class="pointer-events-none absolute bottom-0 left-3 size-px opacity-0"
		/>
		{#if newName && create}<input type="hidden" name={create.name} value={newName} />{/if}
	</div>
	{#if error}<FieldError id="{id}-error" message={error} />{/if}
</div>

<Picker
	{open}
	{title}
	placeholder={search}
	{groups}
	kind="field"
	chosen={newName ? null : (current?.key ?? null)}
	{nothingLeft}
	{theme}
	back
	create={create ? [{ key: 'create', label: create.label }] : undefined}
	oncreate={(_key, typed) => createFrom(typed)}
	bind:query
	{elsewhere}
	onelsewhere={(row) => onelsewhere?.(row)}
	onpick={(row) => {
		value = row.value;
		newName = null;
		open = false;
	}}
	onclose={() => (open = false)}
/>
