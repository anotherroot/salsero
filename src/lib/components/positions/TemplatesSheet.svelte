<script lang="ts">
	import { enhance } from '$app/forms';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, button } from '$lib/components/ui/styles';
	import { DANCES, type DanceSlug } from '$lib/dances/dances';
	import { fold } from '$lib/fold';
	import { TEMPLATES, firstTemplateType, templateTypes } from '$lib/positions/templates';
	import {
		BUSY,
		SHEET_FAILED,
		TEMPLATE_PICK,
		TEMPLATES_TITLE,
		YOU_HAVE_IT,
		addLabel,
		templatesNote
	} from '$lib/positions/view';

	/**
	 * Start from a template: a type at a time, its rough positions ticked,
	 * the ones the space already has by name marked "You have it" and left
	 * out. Posts `action` (`?/templates` by default; the Positions list names its
	 * route's, since it sits beside an item too); a picker's Add, so `use:enhance`.
	 */
	let {
		action = '?/templates',
		open,
		onclose,
		dance,
		owned,
		defaultStyle = null
	}: {
		/** Where the form posts. */
		action?: string;
		open: boolean;
		onclose: () => void;
		dance: DanceSlug;
		/** The space's own position names, folded. */
		owned: string[];
		/** Settings' "New figures" type: the type it opens on, when that type has templates. */
		defaultStyle?: string | null;
	} = $props();

	const formId = $props.id();
	const types = $derived(templateTypes(dance));
	const labels = $derived(DANCES[dance].styleLabel);
	// svelte-ignore state_referenced_locally
	let type = $state<string | null>(firstTemplateType(dance, defaultStyle));
	const have = $derived(new Set(owned));
	const rows = $derived(
		(type ? (TEMPLATES[dance][type] ?? []) : []).map((t) => ({ ...t, had: have.has(fold(t.name)) }))
	);
	/** Unticked by hand, per type: every template starts ticked. */
	let unticked = $state<Record<string, string[]>>({});
	const picked = $derived(
		rows.filter((r) => !r.had && !(unticked[type ?? ''] ?? []).includes(r.name))
	);
	let busy = $state(false);
	let refused = $state<string | null>(null);

	function toggle(name: string, on: boolean) {
		const key = type ?? '';
		const off = unticked[key] ?? [];
		unticked = { ...unticked, [key]: on ? off.filter((n) => n !== name) : [...off, name] };
	}
</script>

<Sheet title={TEMPLATES_TITLE} {open} {onclose}>
	<form
		id={formId}
		method="POST"
		{action}
		class="flex flex-col gap-3.5"
		use:enhance={({ cancel }) => {
			// One add per tap: a second tap while the first is out is dropped.
			if (busy || picked.length === 0) return cancel();
			busy = true;
			refused = null;
			return async ({ result }) => {
				try {
					if (result.type === 'success') {
						onclose();
						await refreshWhenSettled();
					} else if (result.type === 'failure') {
						const m = (result.data as { message?: unknown } | undefined)?.message;
						refused = typeof m === 'string' ? m : SHEET_FAILED.templates;
					} else {
						refused = SHEET_FAILED.templates;
					}
				} finally {
					busy = false;
				}
			};
		}}
	>
		{#if refused}<Banner kind="error">{refused}</Banner>{/if}
		{#if types.length > 1}
			<Segmented
				name="type"
				label={TEMPLATE_PICK}
				items={types.map((t) => ({ value: t, label: labels[t] ?? t }))}
				bind:value={type}
			/>
		{:else if type}
			<input type="hidden" name="type" value={type} />
		{/if}

		<fieldset class={GROUP}>
			<legend class="sr-only">{type ? (labels[type] ?? type) : ''}</legend>
			{#each rows as r (r.name)}
				<label class="flex min-h-[60px] cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4">
					<span class="flex min-w-0 flex-1 flex-col gap-px">
						<span class="text-[16px] font-bold {r.had ? 'text-muted' : 'text-ink'}">{r.name}</span>
						<span class="text-[13px] text-muted">{r.description}</span>
					</span>
					{#if r.had}
						<Badge>{YOU_HAVE_IT}</Badge>
					{:else}
						<input
							type="checkbox"
							name="names"
							value={r.name}
							checked={picked.some((p) => p.name === r.name)}
							onchange={(e) => toggle(r.name, e.currentTarget.checked)}
							class="size-[22px] flex-none cursor-pointer"
							style="accent-color: var(--color-accent)"
						/>
					{/if}
				</label>
			{/each}
		</fieldset>

		{#if type}
			<p class="px-1 text-[13px] leading-[1.45] text-muted">
				{templatesNote(labels[type] ?? type)}
			</p>
		{/if}
	</form>

	{#snippet footer()}
		<button
			type="submit"
			form={formId}
			class={button('primary', 'md', true)}
			disabled={picked.length === 0}
			aria-busy={busy}
			aria-label={busy ? BUSY.addingMany : undefined}
		>
			{#if busy}<Spinner />{:else}{addLabel(picked.length)}{/if}
		</button>
	{/snippet}
</Sheet>
