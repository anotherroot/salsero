<script lang="ts">
	/**
	 * A form field that takes any number of values from a list (a figure's
	 * "Starts in"). The opener shows the chosen labels as wrapping chips, or
	 * `empty`, and a chevron; it opens the picker on top of the form (a stacked
	 * level: Back, no ×). A tap toggles a row and the sheet stays open; the
	 * optional `clear` row clears all; Done · N, Back, Escape and the backdrop
	 * close and keep the values (rule 8: the form is never cleared).
	 *
	 * Posts one `<input type="hidden" name={name}>` per value.
	 *
	 * `oncreate` makes the row for what was typed and resolves to it (the
	 * caller adds it to `groups`), or to null when refused: the new row is then
	 * chosen and the sheet stays open. While it is pending the create button is
	 * busy; it re-enables when it settles, and a refusal shows in the sheet.
	 */
	import Picker from './Picker.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import FieldError from '$lib/components/ui/FieldError.svelte';
	import { LABEL, SELECT_WRAP, SELECT_WRAP_INVALID } from '$lib/components/ui/styles';
	import { isHeading, type PickGroup, type PickRow } from '$lib/picker/model';

	interface Props {
		/** Each value is posted under this name. */
		name: string;
		label: string;
		/** The picker's title. */
		title: string;
		sub?: string;
		/** The picker's search placeholder. */
		placeholder: string;
		/** The opener's text while nothing is chosen: "No position · fits anywhere". */
		empty: string;
		groups: PickGroup[];
		/** The clearing row ("No position" / "Fits anywhere · the default"). */
		clear?: { label: string; meta: string };
		/** The chosen rows' `value`s, in the order they were chosen. */
		values: number[];
		/** The create button ("Position"); `key` is the picker's. Needs `oncreate`. */
		create?: { label: string; key: string };
		oncreate?: (query: string) => Promise<PickRow | { message: string } | null>;
		nothingLeft: string;
		/** A refusal about this field, shown under it. */
		error?: string | null;
		/** Bindable, so a host can tie it to history. */
		open?: boolean;
	}

	let {
		name,
		label,
		title,
		sub,
		placeholder,
		empty,
		groups,
		clear,
		values = $bindable(),
		create,
		oncreate,
		nothingLeft,
		error = null,
		open = $bindable(false)
	}: Props = $props();

	const id = $props.id();

	/** Rows made here, until the caller's `groups` list them. */
	let made = $state<PickRow[]>([]);
	let creating = $state(false);
	/** Why the last create was refused (the server's words, else a generic line); null: nothing to show. */
	let createMessage = $state<string | null>(null);
	/** Bumped when the sheet closes, so a create that lands after is ignored. */
	let sheetEpoch = 0;

	$effect(() => {
		if (open) createMessage = null;
	});

	const rowOf = (v: number): PickRow | null => {
		for (const g of groups) {
			for (const e of g.entries) {
				const rows = isHeading(e) ? e.rows : [e];
				const hit = rows.find((r) => r.value === v);
				if (hit) return hit;
			}
		}
		return made.find((r) => r.value === v) ?? null;
	};

	/** Every value has a key: its row's, else a stand-in, so Done counts them all. */
	const keyOf = (v: number) => rowOf(v)?.key ?? `value:${v}`;
	const chosenKeys = $derived(new Set(values.map(keyOf)));
	const chips = $derived(values.map((v) => ({ v, text: rowOf(v)?.label ?? '…' })));

	function toggle(row: PickRow) {
		values = values.includes(row.value)
			? values.filter((v) => v !== row.value)
			: [...values, row.value];
	}

	const GENERIC = 'Try it again.';

	async function make(_key: string, query: string) {
		if (creating || !oncreate) return;
		creating = true;
		createMessage = null;
		const epoch = sheetEpoch;
		try {
			const row = await oncreate(query);
			if (epoch !== sheetEpoch) return;
			if (row && 'message' in row) createMessage = row.message;
			else if (row) {
				if (!made.some((r) => r.value === row.value)) made = [...made, row];
				if (!values.includes(row.value)) values = [...values, row.value];
			} else createMessage = GENERIC;
		} catch {
			if (epoch === sheetEpoch) createMessage = GENERIC;
		} finally {
			creating = false;
		}
	}
</script>

<div>
	<span id="{id}-label" class={LABEL}>{label}</span>
	<button
		type="button"
		class={error ? SELECT_WRAP_INVALID : SELECT_WRAP}
		aria-labelledby="{id}-label {id}-value"
		aria-haspopup="dialog"
		aria-describedby={error ? `${id}-error` : undefined}
		onclick={() => (open = true)}
	>
		<span id="{id}-value" class="min-w-0 flex-1">
			{#if chips.length}
				<span class="flex flex-wrap gap-1.5">
					{#each chips as c (c.v)}
						<span
							class="max-w-full truncate rounded-full bg-chip px-3 py-1 text-[14px] font-semibold text-chip-ink"
							>{c.text}</span
						>
					{/each}
				</span>
			{:else}
				<span class="block truncate text-[16px] font-medium text-muted">{empty}</span>
			{/if}
		</span>
		<span class="flex flex-none text-muted"><Icon name="chevron-down" size={20} /></span>
	</button>
	{#each values as v (v)}<input type="hidden" {name} value={v} />{/each}
	{#if error}<FieldError id="{id}-error" message={error} />{/if}
</div>

<Picker
	{open}
	{title}
	{sub}
	{placeholder}
	{groups}
	kind="field"
	multi
	chosen={chosenKeys}
	{clear}
	onclear={() => (values = [])}
	create={create ? [{ key: create.key, label: create.label }] : undefined}
	oncreate={make}
	{creating}
	{nothingLeft}
	back
	onpick={toggle}
	onclose={() => {
		sheetEpoch++;
		createMessage = null;
		open = false;
	}}
>
	{#snippet top()}
		{#if createMessage}
			<Banner kind="error" title="That could not be created.">{createMessage}</Banner>
		{/if}
	{/snippet}
</Picker>
