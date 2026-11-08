<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import Segmented from '$lib/components/ui/Segmented.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { FIELD, SECTION_LABEL, SHORTCUT, button, iconButton } from '$lib/components/ui/styles';
	import type { ToastState } from '$lib/act-toast';
	import { clock } from '$lib/format';
	import { t } from '$lib/i18n/catalog';
	import { editAct, type UndoOf } from '$lib/songs/edit-act';
	import { SECTION_NAME_MAX, parseSections, sectionName, type Placed } from '$lib/songs/sections';
	import { guarded } from '$lib/unsaved/guard.svelte';

	/*
	 * A section's sheet (spec 2026-11-08, "The section sheet"): its name, where
	 * it starts, whether it is counted, Remove. Each change saves when made,
	 * with Undo; the Other… name is the one thing typed, saved on Done or Enter.
	 */
	let {
		section,
		sectionsJson,
		seen,
		onclose,
		pageToast
	}: {
		/** The section, or null when the sheet is closed. */
		section: Placed | null;
		/** The stored list, for Undo. */
		sectionsJson: string;
		seen: () => string;
		onclose: () => void;
		/** A toast on the page, for Remove (the sheet closes). */
		pageToast: (t: ToastState | null) => void;
	} = $props();

	const w = $derived(t().songs.page.section);
	let sheetToast = $state<ToastState | null>(null);
	let typing = $state(false);
	let typed = $state('');
	const undo = (): UndoOf => ({ field: 'sections', value: parseSections(sectionsJson) });
	const chips = $derived(t().songs.page.section.chips());
	const custom = $derived(section !== null && section.name !== '' && !chips.includes(section.name));
	let countValue = $derived(section?.countOff ? 'off' : 'on');

	function edit(fields: Record<string, string | number>) {
		if (!section) return;
		return editAct({
			name: 'sectionEdit',
			fields: { index: section.index, ...fields },
			seen,
			message: w.saved,
			undo: undo(),
			toast: (x) => (sheetToast = x)
		});
	}

	function move(dir: -1 | 1) {
		if (!section) return;
		void editAct({
			name: 'sectionMove',
			fields: { index: section.index, dir },
			seen,
			message: w.saved,
			undo: undo(),
			toast: (x) => (sheetToast = x)
		});
	}

	function remove() {
		if (!section) return;
		const name = sectionName(section);
		const index = section.index;
		onclose();
		void editAct({
			name: 'sectionRemove',
			fields: { index },
			seen,
			message: w.removed(name),
			undo: undo(),
			toast: pageToast
		});
	}

	function close() {
		typing = false;
		sheetToast = null;
		onclose();
	}
</script>

<Sheet title={w.title} sub={w.saving} open={section !== null} onclose={close}>
	{#if section}
		<div class="flex flex-col gap-3">
			<h3 class={SECTION_LABEL}>{w.name}</h3>
			<div class="flex flex-wrap gap-2">
				{#each chips as chip (chip)}
					<button
						type="button"
						class={SHORTCUT}
						aria-pressed={section.name === chip}
						onclick={() => edit({ name: chip })}>{chip}</button
					>
				{/each}
				<button
					type="button"
					class={SHORTCUT}
					aria-pressed={custom || typing}
					onclick={() => {
						typing = true;
						typed = custom ? section!.name : '';
					}}>{custom ? section.name : w.other}</button
				>
			</div>
			{#if typing}
				<form
					method="POST"
					action="?/sectionEdit"
					class="flex gap-2"
					use:guarded={{
						label: w.unsavedLabel,
						submit: ({ formData }) => {
							const s = seen();
							if (s) formData.set('seen', s);
							return async ({ result, update }) => {
								await update({ reset: false });
								if (result.type === 'success') typing = false;
							};
						}
					}}
				>
					<input type="hidden" name="index" value={section.index} />
					<!-- svelte-ignore a11y_autofocus -->
					<input
						name="name"
						aria-label={w.otherLabel}
						maxlength={SECTION_NAME_MAX}
						required
						autofocus
						autocomplete="off"
						bind:value={typed}
						class="{FIELD} min-w-0 flex-1"
					/>
					<button type="submit" class={button('primary', 'md')}>{t().common.done}</button>
				</form>
			{/if}

			<h3 class="{SECTION_LABEL} pt-2">{w.starts}</h3>
			<div class="flex items-center gap-2 px-1">
				<span class="flex-1 text-[16px] font-bold text-ink tabular-nums"
					>{w.onOne(clock(section.t))}</span
				>
				<button
					type="button"
					class={iconButton('tonal')}
					aria-label={w.earlier}
					onclick={() => move(-1)}><Icon name="chevron-left" size={20} /></button
				>
				<span class="text-[13px] font-bold text-muted">8</span>
				<button
					type="button"
					class={iconButton('tonal')}
					aria-label={w.later}
					onclick={() => move(1)}><Icon name="chevron-right" size={20} /></button
				>
			</div>

			<h3 class="{SECTION_LABEL} pt-2">{w.count}</h3>
			<Segmented
				name="count"
				label={w.count}
				items={[
					{ value: 'on', label: w.on },
					{ value: 'off', label: w.off }
				]}
				bind:value={countValue}
				onchange={(v) => edit({ countOff: v === 'off' ? '1' : '0' })}
			/>
			<p class="px-3 text-[13px] leading-[1.45] text-muted">{w.offHelp}</p>

			<div class="flex items-center justify-between pt-2">
				<button type="button" class={button('danger-text', 'md')} onclick={remove}
					>{w.remove}</button
				>
				{#if !typing}
					<button type="button" class={button('primary', 'md')} onclick={close}
						>{t().common.done}</button
					>
				{/if}
			</div>
		</div>
	{/if}
	{#snippet toast()}
		<Toast
			contained
			toast={sheetToast && {
				id: sheetToast.id,
				message: sheetToast.message,
				action: sheetToast.action
			}}
			onaction={() => sheetToast?.undo?.()}
			ondismiss={() => (sheetToast = null)}
		/>
	{/snippet}
</Sheet>
