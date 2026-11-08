<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { linkRowView } from '$lib/figures/page';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { button, iconButton } from '$lib/components/ui/styles';
	import type { LinkRow } from '$lib/types';
	import { t } from '$lib/i18n/catalog';

	/**
	 * A link as a row of the figure page's Recordings card (rework plan 3,
	 * option B). The text part opens the link in a new tab; the control at the
	 * end is a sibling: Save (a YouTube link an editor can save), Retry (its save
	 * failed), else the external icon; while editing, Remove.
	 */
	let {
		link,
		canSave,
		editing,
		onremove
	}: {
		link: LinkRow;
		/** An editor's: Save video and Retry. */
		canSave: boolean;
		editing: boolean;
		/** The page's removal handler, which moves focus to the next row. */
		onremove: SubmitFunction;
	} = $props();

	const view = $derived(linkRowView(link, canSave));
	let posting = $state(false);
	const busy: SubmitFunction = () => {
		posting = true;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				posting = false;
			}
		};
	};
</script>

{#snippet body()}
	{#if view.youtube}
		<span
			class="grid h-10 w-14 flex-none place-items-center rounded-[9px] bg-band text-band-small"
			aria-hidden="true"><Icon name="play" size={16} filled /></span
		>
	{:else}
		<span
			class="grid size-10 flex-none place-items-center rounded-full bg-chip text-ink-2"
			aria-hidden="true"><Icon name="link" size={20} /></span
		>
	{/if}
	<span class="min-w-0 py-2">
		<span class="block truncate text-[16px] font-bold">{view.title}</span>
		<span class="block truncate text-[13px] {view.failed ? 'font-bold text-danger' : 'text-muted'}"
			>{view.meta}</span
		>
	</span>
{/snippet}

<div class="flex min-h-[60px] items-center pr-1.5 pl-4">
	{#if view.href}
		<a
			href={view.href}
			target="_blank"
			rel="external noopener noreferrer"
			class="flex min-h-[60px] min-w-0 flex-1 items-center gap-3">{@render body()}</a
		>
	{:else}
		<!-- A stored URL parseLink does not accept is shown, never linked. -->
		<div class="flex min-h-[60px] min-w-0 flex-1 items-center gap-3">{@render body()}</div>
	{/if}
	{#if editing}
		<form method="POST" action="?/deleteLink" use:enhance={onremove}>
			<input type="hidden" name="linkId" value={link.id} />
			<button
				data-focus="link-{link.id}"
				type="submit"
				class={iconButton('bare', 'danger')}
				aria-label={t().figure.links.remove(view.title)}><Icon name="trash" size={22} /></button
			>
		</form>
	{:else if view.end === 'save' || view.end === 'retry'}
		<form
			method="POST"
			action={view.end === 'save' ? '?/saveVideo' : '?/retryVideo'}
			use:enhance={busy}
		>
			<input type="hidden" name="linkId" value={link.id} />
			<button
				type="submit"
				class={button(view.end === 'save' ? 'secondary' : 'tertiary', 'sm')}
				aria-busy={posting}
				disabled={posting}
				aria-label={view.end === 'save'
					? t().figure.links.saveLabel(view.title)
					: t().figure.links.retryLabel(view.title)}
			>
				<!-- Both in one cell: the label keeps the width while the spinner shows. -->
				<span class="grid place-items-center">
					<span class="col-start-1 row-start-1 flex items-center gap-1.5" class:invisible={posting}
						><Icon name={view.end === 'save' ? 'download' : 'refresh'} size={18} />{view.end ===
						'save'
							? t().common.save
							: t().figure.links.retry}</span
					>
					{#if posting}<span class="col-start-1 row-start-1"><Spinner size={18} /></span>{/if}
				</span>
			</button>
		</form>
	{:else if view.end === 'open'}
		<span class="flex size-11 flex-none items-center justify-center text-chevron" aria-hidden="true"
			><Icon name="external" size={20} /></span
		>
	{/if}
</div>
