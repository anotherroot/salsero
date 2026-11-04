<!-- src/lib/components/lessons/VideoSections.svelte -->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import SectionPlayer from '$lib/components/ui/SectionPlayer.svelte';
	import LinkPopup from '$lib/components/links/LinkPopup.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { enhance } from '$app/forms';
	import { focusAfterRemoval } from '$lib/focus';
	import { button, iconButton } from '$lib/components/ui/styles';
	import { openingSteps, type LinkStep } from '$lib/video/link-steps';
	import { refreshWhenSettled } from '$lib/sheets/history.svelte';
	import { sectionMeta, spotLabel } from '$lib/video/spots';
	import type { Spot, SpotOwner, VideoSection } from '$lib/types';

	/**
	 * A video's sections, each with one small line saying what it is linked to.
	 * Sections are marked in the full-screen player; the link button opens the
	 * Link popup, where they get pointed at what they show — or what they show
	 * gets made.
	 */
	interface Props {
		sections: VideoSection[];
		src: string;
		owner: SpotOwner;
		/** The link button and the player's linking; without it the list only shows. */
		linking?: boolean;
		/** A section with exactly one link shows Unlink in place of the link button (the figure page). */
		unlink?: boolean;
		/** Marking and editing spots in its player: off for a reader of a group's video. */
		canEdit?: boolean;
	}

	let { sections, src, owner, linking = false, unlink = false, canEdit = true }: Props = $props();

	let playing = $state<Spot | null>(null);
	let linkingSpot = $state<number | null>(null);
	/** The Link popup's levels, bottom first; empty when it is closed. */
	let steps = $state<LinkStep[]>([]);

	function closeLink() {
		linkingSpot = null;
		steps = [];
		// Each level holds a history entry: refresh once the popup's own Backs have landed.
		void refreshWhenSettled();
	}

	const ownerKey = $derived(Object.entries(owner).join('-'));
	const asSpot = (s: VideoSection): Spot => ({
		id: s.id,
		startMs: s.startMs,
		endMs: s.endMs,
		label: s.label,
		linkedTo: s.links.map((l) => l.label)
	});
</script>

<div class="border-t border-hairline">
	<h3
		class="px-4 pt-2.5 text-[13px] font-bold text-muted"
		tabindex="-1"
		data-focus="sections-heading-{ownerKey}"
	>
		Sections · {sections.length}
	</h3>
	{#if sections.length === 0}
		<p class="px-4 pt-1 pb-3 text-[13px] text-muted">
			{canEdit ? 'None yet. Open the video full screen and tap Section to mark one.' : 'None yet.'}
		</p>
	{:else}
		<ul>
			{#each sections as s (s.id)}
				<li class="flex min-h-[58px] items-center gap-3 pr-1.5 pl-4">
					<button
						data-focus="section-{s.id}"
						type="button"
						class="flex size-11 flex-none cursor-pointer items-center justify-center"
						aria-label="Play {spotLabel(s)}"
						onclick={() => (playing = asSpot(s))}
						><span class="grid size-9 place-items-center rounded-full bg-accent text-on-accent"
							><Icon name="play" size={18} filled /></span
						></button
					>
					<div class="min-w-0 flex-1 py-2">
						<span class="block truncate text-[16px] font-bold">{spotLabel(s)}</span>
						<span class="line-clamp-2 block text-[13px] text-muted">{sectionMeta(s)}</span>
					</div>
					{#if unlink && s.links.length === 1}
						<form
							method="POST"
							action="?/unlinkSection"
							use:enhance={() => {
								const keys = sections.map((x) => `section-${x.id}`);
								return async ({ update, result }) => {
									await update();
									// Already removed elsewhere: show the list as it is now.
									if (result.type === 'failure' && result.status === 404) await invalidateAll();
									if (result.type === 'success')
										await focusAfterRemoval(
											keys,
											`section-${s.id}`,
											`sections-heading-${ownerKey}`
										);
								};
							}}
						>
							<input type="hidden" name="linkId" value={s.links[0].id} />
							<button
								type="submit"
								class={button('tertiary', 'sm')}
								aria-label="Unlink {spotLabel(s)} from {s.links[0].label}">Unlink</button
							>
						</form>
					{:else if linking}
						<button
							type="button"
							class={iconButton('bare', 'accent-text')}
							aria-label="Link {spotLabel(s)}"
							onclick={() => {
								steps = openingSteps(s.links.length);
								linkingSpot = s.id;
							}}><Icon name="link" size={22} /></button
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if linkingSpot !== null}
	<LinkPopup
		spotId={linkingSpot}
		theme="light"
		point={false}
		{steps}
		onpush={(s) => (steps = [...steps, s])}
		onback={() => {
			steps = steps.slice(0, -1);
			if (steps.length === 0) closeLink();
		}}
		onclose={closeLink}
	/>
{/if}

{#if playing}
	<SectionPlayer
		{src}
		{owner}
		spot={playing}
		{linking}
		{canEdit}
		onclose={() => {
			playing = null;
			// The player can rename or delete sections, and link them; the list shows them.
			void refreshWhenSettled();
		}}
	/>
{/if}
