<!-- src/lib/components/links/LinksEditor.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import LinkList from './LinkList.svelte';
	import { FIELD } from '$lib/components/ui/styles';
	import type { LinkRow } from '$lib/types';

	interface Props {
		links: LinkRow[];
		/** The last addLink failure, if any. */
		message: string | null;
		/** What was typed, handed back by a failed addLink. */
		entered: string;
	}

	let { links, message, entered }: Props = $props();
</script>

<LinkList {links}>
	{#snippet actions(link)}
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
	use:enhance={() =>
		async ({ update, result }) => {
			// Keep the typed text on a failure so the bad line can be fixed in place.
			await update({ reset: result.type === 'success' });
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
