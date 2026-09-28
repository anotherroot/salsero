<!-- src/lib/components/exercises/kinds/drill/Content.svelte -->
<script lang="ts">
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinksEditor from '$lib/components/links/LinksEditor.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import type { ContentProps } from '../index';

	// `editLinks` is honoured here only: a drill is the one type whose links are
	// its own. The other types' links are edited on their owner's page.
	let { content, editLinks }: ContentProps = $props();
</script>

{#if content.type === 'drill'}
	<div class="space-y-3">
		{#if content.notes}
			<LinkedText text={content.notes} class="text-[15px] whitespace-pre-line" />
		{/if}
		{#if editLinks}
			<LinksEditor links={content.links} message={editLinks.message} entered={editLinks.entered} />
		{:else}
			<LinkList links={content.links} />
		{/if}
	</div>
{/if}
