<script lang="ts">
	import { guarded } from '$lib/unsaved/guard.svelte';
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Banner from '$lib/components/ui/Banner.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import {
		addItemIcon,
		addItemKind,
		addSections,
		figuresCaption,
		holdsLine,
		newLine
	} from '$lib/teams/add';
	import type { AddItem, AddOffer } from '$lib/types';

	/**
	 * Add a group lesson to one's own (option A). What the lesson holds, then
	 * what goes on Today — the lesson, its routines and drills, all ticked —
	 * then its figures, unticked: a tick only decides Today, never what is
	 * visible. With `fresh`, it lists only what came in since the person added
	 * the lesson. Confirming marks the lesson seen either way.
	 */
	let {
		open,
		onclose,
		title,
		lessonId,
		offer,
		action,
		fresh = false
	}: {
		open: boolean;
		onclose: () => void;
		/** The lesson's title. */
		title: string;
		lessonId: number;
		offer: AddOffer;
		/** Where the form posts, e.g. `?/add`. */
		action: string;
		fresh?: boolean;
	} = $props();

	let busy = $state(false);
	let failed = $state<string | null>(null);

	const sections = $derived(addSections(offer.items));
	const formId = $derived(`add-lesson-${lessonId}`);
	const w = $derived(t().groups.add);

	function fieldOf(item: AddItem): { name: string; value: string } {
		if (item.kind === 'lesson') return { name: 'lesson', value: 'on' };
		const name =
			item.kind === 'routine' ? 'routineIds' : item.kind === 'drill' ? 'drillIds' : 'figureIds';
		return { name, value: String(item.id) };
	}
</script>

{#snippet rows(items: AddItem[])}
	<ul class={GROUP}>
		{#each items as item (`${item.kind}:${item.id}`)}
			{@const field = fieldOf(item)}
			<li>
				<label class="flex min-h-[60px] cursor-pointer items-center gap-3 py-2 pr-4 pl-4">
					<span
						aria-hidden="true"
						class="grid size-10 flex-none place-items-center rounded-xl bg-accent-soft text-accent-text"
						><Icon name={addItemIcon(item.kind)} size={20} /></span
					>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="text-[16px] leading-tight font-bold break-words text-ink">{item.name}</span
						>
						<span class="text-[13px] text-muted">{addItemKind(item.kind)}</span>
					</span>
					<input
						type="checkbox"
						name={field.name}
						value={field.value}
						checked={item.ticked}
						class="size-6 flex-none cursor-pointer accent-accent"
					/>
				</label>
			</li>
		{/each}
	</ul>
{/snippet}

<Sheet {title} sub={fresh ? newLine(offer.items) : holdsLine(offer.counts)} {open} {onclose} tall>
	<form
		id={formId}
		method="POST"
		{action}
		class="flex flex-col gap-2"
		use:guarded={{
			label: w.label(title),
			submit: ({ cancel }) => {
				// One Add per tap: a second tap while the first is out is dropped.
				if (busy) return cancel();
				busy = true;
				failed = null;
				return async ({ update, result }) => {
					try {
						// A refused Add (the lesson archived or left meanwhile) says so here,
						// rather than replacing the page with the error page.
						if (result.type === 'error') failed = t().groups.add.refused;
						else await update();
					} finally {
						busy = false;
					}
					if (result.type === 'success') onclose();
				};
			}
		}}
	>
		<input type="hidden" name="lessonId" value={lessonId} />
		{#if failed}<Banner kind="error">{failed}</Banner>{/if}
		{#if sections.today.length > 0}
			<h3 class={SECTION_LABEL}>{w.onToday}</h3>
			{@render rows(sections.today)}
		{/if}
		{#if sections.figures.length > 0}
			<h3 class="{SECTION_LABEL} pt-2">{w.alsoFigures}</h3>
			{@render rows(sections.figures)}
			<p class="px-4 text-[13px] text-muted">{figuresCaption()}</p>
		{/if}
	</form>

	{#snippet footer()}
		<button
			type="submit"
			form={formId}
			class={button('primary', 'md', true)}
			aria-busy={busy}
			aria-label={busy ? w.adding : undefined}
		>
			{#if busy}<Spinner />{:else}{t().common.add}{/if}
		</button>
	{/snippet}
</Sheet>
