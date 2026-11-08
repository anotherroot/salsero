<!-- src/lib/components/exercises/kinds/drill/Content.svelte -->
<script lang="ts">
	import LinkList from '$lib/components/links/LinkList.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import { t } from '$lib/i18n/catalog';
	import DrillRecordings from '../../DrillRecordings.svelte';
	import { PROSE, SECTION_HEAD } from '../prose';
	import type { ContentProps } from '../index';

	// A drill is the one type whose links and sections are its own: on the page
	// they are its Recordings (`recordings`: + Add). The other types' are edited
	// on their owner's page.
	let {
		content,
		onPage = false,
		canEdit = true,
		recordings = null,
		practice
	}: ContentProps = $props();
</script>

{#if content.type === 'drill'}
	<div class="flex flex-col gap-3">
		{#if content.notes}
			{#if onPage}<h2 class={SECTION_HEAD}>{t().exercise.content.description}</h2>{/if}
			<LinkedText text={content.notes} class={PROSE} />
		{/if}
		{#if onPage}
			{@render practice?.()}
			<DrillRecordings
				sections={content.sections}
				links={content.links}
				{canEdit}
				editing={false}
				{recordings}
			/>
		{:else}
			<LinkList links={content.links} />
		{/if}
	</div>
{/if}
