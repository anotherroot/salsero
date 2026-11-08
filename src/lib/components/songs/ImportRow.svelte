<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { t } from '$lib/i18n/catalog';
	import { importRowView } from '$lib/songs/imports';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { button } from '$lib/components/ui/styles';
	import type { SongImportRow } from '$lib/types';

	/**
	 * A pasted playlist in Music: a read one links to its pick list (To pick); one
	 * being read has Cancel, a failed one Retry and Dismiss (Being added). The
	 * forms post to the list route by name: beside an open song a bare `?/x` would
	 * post to the song.
	 */
	let {
		row,
		dance,
		href,
		current = false,
		onremoved
	}: {
		row: SongImportRow;
		dance: string;
		/** The pick list's resolved path. */
		href: string;
		/** Its pick list is open beside the list. */
		current?: boolean;
		/** Cancel or Dismiss landed: where focus goes next is the list's to say. */
		onremoved?: () => void;
	} = $props();

	const w = $derived(t().songs.imports);
	const view = $derived(importRowView(row));
	const spotify = $derived(row.kind.startsWith('spotify'));
	const removal: SubmitFunction =
		() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') onremoved?.();
		};
</script>

{#snippet tile()}
	<span
		class="flex size-10 flex-none items-center justify-center rounded-full {row.status === 'reading'
			? 'bg-chip text-muted'
			: spotify
				? 'bg-done-soft text-done'
				: 'bg-danger-soft text-danger'}"
	>
		<Icon name={spotify ? 'music' : 'youtube'} size={20} />
	</span>
{/snippet}

{#snippet text()}
	<span class="flex min-w-0 flex-1 flex-col gap-0.5">
		<span class="truncate text-[16px] leading-[1.3] font-bold text-ink">{view.title}</span>
		<span
			class="truncate text-[13px] leading-[1.35] {view.tone === 'danger'
				? 'font-bold text-danger'
				: 'text-muted'}">{view.meta}</span
		>
	</span>
{/snippet}

<li class="flex min-h-16 items-center gap-3 py-[9px] pr-3 pl-4" class:bg-accent-soft={current}>
	{#if view.action === 'pick'}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- the caller passes a resolved href -->
		<a
			{href}
			aria-current={current ? 'page' : undefined}
			data-focus="import-{row.id}"
			class="flex min-w-0 flex-1 items-center gap-3"
		>
			{@render tile()}
			{@render text()}
			<Badge tone="accent">{w.pickSongs}</Badge>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{:else}
		{@render tile()}
		{@render text()}
		{#if view.action === 'retry-dismiss'}
			<form method="POST" action="/{dance}/songs?/retryImport" use:enhance>
				<input type="hidden" name="id" value={row.id} />
				<button
					type="submit"
					class={button('tertiary', 'sm')}
					data-focus="import-{row.id}"
					aria-label={w.actionOf(w.retry, view.title)}>{w.retry}</button
				>
			</form>
		{/if}
		<form method="POST" action="/{dance}/songs?/dismissImport" use:enhance={removal}>
			<input type="hidden" name="id" value={row.id} />
			<button
				type="submit"
				class={button('tertiary', 'sm')}
				data-focus={view.action === 'cancel' ? `import-${row.id}` : undefined}
				aria-label={w.actionOf(view.action === 'cancel' ? w.cancel : w.dismiss, view.title)}
				>{view.action === 'cancel' ? w.cancel : w.dismiss}</button
			>
		</form>
	{/if}
</li>
