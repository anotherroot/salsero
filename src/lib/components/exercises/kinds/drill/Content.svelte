<!-- src/lib/components/exercises/kinds/drill/Content.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import LinkSectionSheet from '$lib/components/ui/LinkSectionSheet.svelte';
	import SectionCard from '$lib/components/ui/SectionCard.svelte';
	import { FIELD_ERROR, iconButton } from '$lib/components/ui/styles';
	import { PROSE, SECTION_HEAD } from '../prose';
	import type { ContentProps } from '../index';

	// `editLinks` is honoured here only: a drill is the one type whose links and
	// sections are its own. The other types' are edited on their owner's page.
	let { content, editLinks, onPage = false }: ContentProps = $props();

	let linking = $state(false);
</script>

{#if content.type === 'drill'}
	<div class="flex flex-col gap-3">
		{#if content.notes}
			{#if onPage}<h2 class={SECTION_HEAD}>Description</h2>{/if}
			<LinkedText text={content.notes} class={PROSE} />
		{/if}
		{#if !onPage}
			<LinkList links={content.links} />
		{/if}
		{#if onPage && (content.sections.length > 0 || editLinks)}
			<h2 class={SECTION_HEAD}>Sections</h2>
		{/if}
		{#each content.sections as s (s.linkId)}
			{#if editLinks}
				<SectionCard section={s}>
					{#snippet unlink()}
						<form method="POST" action="?/unlinkSection" use:enhance class="flex-none">
							<input type="hidden" name="linkId" value={s.linkId} />
							<button type="submit" class={iconButton('bare')} aria-label="Unlink this section">
								<span class="text-muted"><Icon name="close" size={20} /></span>
							</button>
						</form>
					{/snippet}
				</SectionCard>
			{:else}
				<SectionCard section={s} />
			{/if}
		{/each}
		{#if editLinks?.unlinkMessage}
			<p class={FIELD_ERROR} role="alert">
				<Icon name="warning" size={16} filled />{editLinks.unlinkMessage}
			</p>
		{/if}
		{#if editLinks}
			<button
				type="button"
				class="flex h-12 w-full cursor-pointer items-center gap-2.5 rounded-2xl bg-surface px-4 text-left text-[15px] font-extrabold text-accent-text"
				aria-haspopup="dialog"
				onclick={() => (linking = true)}
			>
				<Icon name="link" size={20} />Link a section…
			</button>
			<h2 class={SECTION_HEAD}>Links</h2>
			<LinksEditor links={content.links} message={editLinks.message} entered={editLinks.entered} />
			<LinkSectionSheet
				open={linking}
				onclose={() => (linking = false)}
				groups={editLinks.linkable ?? []}
				hidden={{}}
			/>
		{:else if onPage}
			<LinkList links={content.links} />
		{/if}
	</div>
{/if}
