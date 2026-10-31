<!-- src/lib/components/links/LinksEditor.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { guarded } from '$lib/unsaved/guard.svelte';
	import LinkList from './LinkList.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import {
		FIELD,
		FIELD_ERROR,
		LABEL,
		TEXTAREA,
		button,
		iconButton
	} from '$lib/components/ui/styles';
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
	const uid = $props.id();
	const webHost = (url: string) => {
		const p = parseLink(url);
		return p?.kind === 'web' ? p.host : url;
	};
</script>

<LinkList {links}>
	{#snippet actions(link, kind)}
		{#if kind === 'youtube'}
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
			<form method="POST" action="?/deleteLink" use:enhance class="ml-auto">
				<input type="hidden" name="linkId" value={link.id} />
				<button type="submit" class={button('danger-text', 'sm')}
					><Icon name="trash" size={18} />Remove</button
				>
			</form>
		{:else}
			<form method="POST" action="?/deleteLink" use:enhance>
				<input type="hidden" name="linkId" value={link.id} />
				<button
					type="submit"
					class="{iconButton('bare')} text-muted"
					aria-label="Remove {link.title ?? webHost(link.url)}"
					><Icon name="trash" size={20} /></button
				>
			</form>
		{/if}
	{/snippet}
</LinkList>

<form
	method="POST"
	action="?/addLink"
	class="mt-3 flex flex-col gap-3.5"
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
	<div>
		<label class={LABEL} for="{uid}-urls">Add links</label>
		<textarea
			id="{uid}-urls"
			name="urls"
			rows="2"
			placeholder="Paste YouTube or other links, one per line"
			aria-invalid={message ? 'true' : undefined}
			aria-describedby={message ? `${uid}-error` : undefined}
			class={TEXTAREA}>{entered}</textarea
		>
		{#if message}
			<p id="{uid}-error" class={FIELD_ERROR} role="alert">
				<Icon name="warning" size={16} filled />{message}
			</p>
		{/if}
	</div>
	<div>
		<label class={LABEL} for="{uid}-title"
			>Title <span class="font-medium text-muted">(optional)</span></label
		>
		<input
			id="{uid}-title"
			name="title"
			maxlength="200"
			placeholder="For a single link"
			class={FIELD}
		/>
	</div>
	<button type="submit" class={button('secondary', 'md', true)}
		><Icon name="plus" size={20} />Add link</button
	>
</form>
