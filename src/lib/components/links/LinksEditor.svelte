<!-- src/lib/components/links/LinksEditor.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import LinkList from './LinkList.svelte';
	import { FIELD } from '$lib/components/ui/styles';
	import { parseLink } from '$lib/links';
	import type { LinkRow } from '$lib/types';

	interface Props {
		links: LinkRow[];
		/** The last addLink failure, if any. */
		message: string | null;
		/** What was typed, handed back by a failed addLink. */
		entered: string;
		/**
		 * Offer Save video on YouTube links — the figure and lesson pages. A drill
		 * has no stored videos, so its links stay links.
		 */
		canSave?: boolean;
	}

	let { links, message, entered, canSave = false }: Props = $props();
</script>

<LinkList {links}>
	{#snippet actions(link)}
		{#if canSave && parseLink(link.url)?.kind === 'youtube'}
			{#if link.saving?.status === 'queued'}
				<span class="mr-auto self-center px-2 text-[13px] text-muted"
					>Saving — the home worker picks it up within a few minutes</span
				>
			{:else if link.saving?.status === 'failed'}
				<span class="mr-auto min-w-0 self-center px-2 py-1 text-[13px] break-words text-danger"
					>Couldn't save: {link.saving.error ?? 'unknown error'}</span
				>
				<form method="POST" action="?/retryVideo" use:enhance>
					<input type="hidden" name="linkId" value={link.id} />
					<button type="submit" class="h-9 px-2 text-[13px]">Retry</button>
				</form>
			{:else}
				<form method="POST" action="?/saveVideo" use:enhance class="mr-auto">
					<input type="hidden" name="linkId" value={link.id} />
					<button type="submit" class="h-9 px-2 text-[13px]">Save video</button>
				</form>
			{/if}
		{/if}
		<form method="POST" action="?/deleteLink" use:enhance>
			<input type="hidden" name="linkId" value={link.id} />
			<button type="submit" class="h-9 px-2 text-[13px] text-danger">Remove</button>
		</form>
	{/snippet}
</LinkList>

<form
	method="POST"
	action="?/addLink"
	class="mt-3 space-y-2"
	use:guarded={{
		label: 'A link',
		submit:
			() =>
			async ({ update, result }) => {
				// Keep the typed text on a failure so the bad line can be fixed in place.
				await update({ reset: result.type === 'success' });
			}
	}}
>
	<textarea
		name="urls"
		rows="2"
		placeholder="Paste YouTube or other links, one per line"
		class={FIELD}>{entered}</textarea
	>
	<input name="title" maxlength="200" placeholder="Title (optional, for one link)" class={FIELD} />
	{#if message}
		<p class="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">{message}</p>
	{/if}
	<button type="submit" class="h-11 w-full rounded-xl border border-rule text-[14px] font-medium"
		>Add link</button
	>
</form>
