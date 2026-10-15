<!-- src/lib/components/exercises/kinds/drill/Content.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import LinkSectionSheet from '$lib/components/ui/LinkSectionSheet.svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import type { ContentProps } from '../index';

	// `editLinks` is honoured here only: a drill is the one type whose links and
	// sections are its own. The other types' are edited on their owner's page.
	let { content, editLinks }: ContentProps = $props();

	let linking = $state(false);
	$effect(() => {
		if (editLinks?.sectionMessage) linking = true;
	});
</script>

{#if content.type === 'drill'}
	<div class="space-y-3">
		{#if content.notes}
			<LinkedText text={content.notes} class="text-[15px] whitespace-pre-line" />
		{/if}
		{#each content.sections as s (s.linkId)}
			<SectionCard section={s}>
				{#snippet unlink()}
					{#if editLinks}
						<form method="POST" action="?/unlinkSection" use:enhance>
							<input type="hidden" name="linkId" value={s.linkId} />
							<button
								type="submit"
								class="grid size-9 place-items-center text-muted"
								aria-label="Unlink this section">×</button
							>
						</form>
					{/if}
				{/snippet}
			</SectionCard>
		{/each}
		{#if editLinks}
			<button
				type="button"
				class="text-[13px] font-medium text-accent"
				onclick={() => (linking = true)}>+ Link a section</button
			>
			<LinksEditor links={content.links} message={editLinks.message} entered={editLinks.entered} />
			<LinkSectionSheet
				open={linking}
				onclose={() => (linking = false)}
				groups={editLinks.linkable ?? []}
				hidden={{}}
				message={editLinks.sectionMessage ?? null}
			/>
		{:else}
			<LinkList links={content.links} />
		{/if}
	</div>
{/if}
