<script lang="ts">
	import FlipList from '$lib/components/ui/FlipList.svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { SubmitFunction } from '@sveltejs/kit';
	import AddRecordingSheet from '$lib/components/figures/AddRecordingSheet.svelte';
	import LinkRow from '$lib/components/figures/LinkRow.svelte';
	import SectionRow from '$lib/components/figures/SectionRow.svelte';
	import AddLinkSheet from '$lib/components/links/AddLinkSheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LinkSectionSheet from '$lib/components/ui/LinkSectionSheet.svelte';
	import { FIELD_ERROR, GROUP, SECTION_LABEL, button } from '$lib/components/ui/styles';
	import { focusAfterRemoval } from '$lib/focus';
	import { showRecordings } from '$lib/figures/page';
	import { recordingKeys } from '$lib/exercises/exercise-page';
	import { t } from '$lib/i18n/catalog';
	import { spotLabel } from '$lib/video/spots';
	import type { LinkedSection, LinkRow as LinkRowType } from '$lib/types';
	import type { ContentProps } from './kinds';

	// A section's link refuses in its own picker (LinkSectionSheet), never here.
	const REFUSED = new Set(['unlinkSection', 'deleteLink']);

	/**
	 * A drill's Recordings: its linked sections and links in one card, `+ Add` in
	 * the heading row (a section of a lesson video, or a link; a drill holds no
	 * video of its own). While editing: each section's Unlink and each link's
	 * trash. `recordings` is null when the person may not add (a reader, the
	 * simple page); the card then shows only when there is something in it.
	 */
	let {
		sections,
		links,
		canEdit,
		editing,
		recordings,
		after = []
	}: {
		sections: LinkedSection[];
		links: LinkRowType[];
		/** Marking and editing spots in a section's player: off for a reader. */
		canEdit: boolean;
		editing: boolean;
		recordings: ContentProps['recordings'];
		/**
		 * While editing: the focus keys the page draws around the card (its Archive,
		 * else its Settings heading), tried in order for a removal that empties it.
		 * + Add, the reading card's fallback, is not drawn then.
		 */
		after?: readonly string[];
	} = $props();

	let adding = $state(false);
	let linkingSection = $state(false);
	let addingLink = $state(false);

	const items = $derived(sections.length + links.length);
	/** The last refusal of an unlink or a removal, shown under the card. */
	const refusal = $derived.by(() => {
		const form = page.form as { action?: unknown; message?: unknown } | null;
		if (!form || typeof form.message !== 'string') return null;
		return REFUSED.has(String(form.action)) ? form.message : null;
	});

	/**
	 * After an unlink or a removal: the next row (sections, then links: the next
	 * section, else the next link), else the one before, else what follows.
	 */
	const removed =
		(key: string): SubmitFunction =>
		() => {
			// Taken at the tap: once the answer is in, the row is gone from the lists.
			const keys = recordingKeys(sections, links);
			const fallback = editing ? after : ['recordings-add'];
			return async ({ update, result }) => {
				await update();
				if (result.type === 'success') await focusAfterRemoval(keys, key, fallback);
			};
		};
</script>

{#if showRecordings({ canEdit, items })}
	<section class="flex flex-col gap-2">
		<div class="flex min-h-11 items-center justify-between">
			<h2 class={SECTION_LABEL}>{t().exercise.content.recordings(items)}</h2>
			{#if recordings && !editing}
				<button
					type="button"
					data-focus="recordings-add"
					class={button('tertiary', 'sm')}
					aria-haspopup="dialog"
					onclick={() => (adding = true)}><Icon name="plus" size={20} />{t().common.add}</button
				>
			{/if}
		</div>
		{#if items > 0}
			<FlipList
				class={GROUP}
				keys={[...sections.map((s) => `s${s.linkId}`), ...links.map((l) => `l${l.id}`)]}
			>
				{#each sections as s (s.linkId)}
					{#snippet unlink()}
						<form
							method="POST"
							action="?/unlinkSection"
							use:enhance={removed(`section-${s.linkId}`)}
						>
							<input type="hidden" name="linkId" value={s.linkId} />
							<button
								type="submit"
								class={button('tertiary', 'sm')}
								aria-label={t().exercise.content.unlinkNamed(spotLabel(s.spot))}
								>{t().exercise.content.unlink}</button
							>
						</form>
					{/snippet}
					<li data-flip="s{s.linkId}">
						<SectionRow
							section={s}
							focusKey="section-{s.linkId}"
							{canEdit}
							trailing={editing ? unlink : undefined}
						/>
					</li>
				{/each}
				{#each links as link (link.id)}
					<li data-flip="l{link.id}">
						<LinkRow {link} canSave={false} {editing} onremove={removed(`link-${link.id}`)} />
					</li>
				{/each}
			</FlipList>
		{/if}
		{#if refusal}
			<p class={FIELD_ERROR} role="alert">
				<Icon name="warning" size={16} filled />{refusal}
			</p>
		{/if}
	</section>
{/if}

{#if recordings}
	<LinkSectionSheet
		open={linkingSection}
		onclose={() => (linkingSection = false)}
		groups={recordings.linkable}
		hidden={{}}
	/>
	<AddLinkSheet
		open={addingLink}
		onclose={() => (addingLink = false)}
		action="?/addLink"
		message={recordings.message}
		entered={recordings.entered}
	/>
	<AddRecordingSheet
		open={adding}
		onclose={() => (adding = false)}
		figureLabel={recordings.label}
		video={false}
		onsection={() => (linkingSection = true)}
		onlink={() => (addingLink = true)}
	/>
{/if}
