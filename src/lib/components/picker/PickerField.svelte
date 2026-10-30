<script lang="ts">
	/**
	 * A form field whose value is picked from a list: it shows the current row
	 * (or a muted placeholder) and a ›, opens the picker on top of the form, and
	 * posts the chosen row's `value` under `name`. Picking fills the field and
	 * returns to the form; nothing else in the form is touched.
	 */
	import Picker from './Picker.svelte';
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

	const dark = $derived(theme === 'dark');
	const labelClass = $derived(
		`mb-1 block text-[12px] font-medium ${dark ? 'text-(--pl-muted)' : 'text-ink-2'}`
	);
	const fieldClass = $derived(
		dark ? 'border-(--pl-hover) bg-(--pl-raised) text-(--pl-ink)' : 'border-rule bg-raised text-ink'
	);
	const muted = $derived(dark ? 'text-(--pl-muted)' : 'text-muted');
</script>

<div class="relative">
	<span id="{id}-label" class={labelClass}>{label}</span>
	<button
		type="button"
		class="flex h-11 w-full cursor-pointer items-center gap-2 rounded-[10px] border px-3 text-left text-[15px] {fieldClass}"
		aria-labelledby="{id}-label {id}-value"
		aria-haspopup="dialog"
		onclick={() => (open = true)}
	>
		<span id="{id}-value" class="min-w-0 flex-1 truncate {current ? '' : muted}"
			>{current ? current.label : placeholder}</span
		>
		<span class="text-[20px] leading-none {muted}" aria-hidden="true">›</span>
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
		autocomplete="off"
		oninput={(e) => (e.currentTarget.value = value == null ? '' : String(value))}
		class="pointer-events-none absolute bottom-0 left-3 size-px opacity-0"
	/>
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
	onpick={(row) => {
		value = row.value;
		open = false;
	}}
	onclose={() => (open = false)}
/>
