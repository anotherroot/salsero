<!-- src/lib/components/lessons/VideoSections.svelte -->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import SectionPlayer from '$lib/components/ui/SectionPlayer.svelte';
	import LinkPopup, { type LinkStep } from '$lib/components/links/LinkPopup.svelte';
	import Icon from '$lib/components/video/Icon.svelte';
	import { icons } from '$lib/components/video/icons';
	import { spotLabel, spotTime } from '$lib/video/spots';
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
	}

	let { sections, src, owner, linking = false }: Props = $props();

	let playing = $state<Spot | null>(null);
	let linkingSpot = $state<number | null>(null);
	let step = $state<LinkStep>('list');

	const asSpot = (s: VideoSection): Spot => ({
		id: s.id,
		startMs: s.startMs,
		endMs: s.endMs,
		label: s.label,
		linkedTo: s.links.map((l) => l.label)
	});

	const linkLine = (s: VideoSection) =>
		s.links.map((l) => (l.archived ? `${l.label} (archived)` : l.label)).join(', ');
</script>

<div class="border-t border-line px-3 py-2">
	<h3 class="mb-1 text-[12px] font-medium tracking-wide text-muted uppercase">Sections</h3>
	{#if sections.length === 0}
		<p class="pb-1 text-[13px] text-muted">
			None yet. Open the video full screen and tap Section to mark one.
		</p>
	{:else}
		<ul class="divide-y divide-line">
			{#each sections as s (s.id)}
				<li class="flex items-center gap-2 py-2">
					<button
						type="button"
						class="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] text-accent-ink"
						aria-label="Play {spotLabel(s)}"
						onclick={() => (playing = asSpot(s))}>▶</button
					>
					<div class="min-w-0 flex-1">
						<span class="block truncate text-[15px]">{spotLabel(s)}</span>
						<span class="block truncate text-[12px] text-muted">
							{s.label
								? `${spotTime(s.startMs)}–${spotTime(s.endMs)}`
								: ''}{#if s.links.length > 0}{s.label ? ' · ' : ''}<span class="text-ink-2"
									><Icon d={icons.link} size={11} class="inline align-[-1px]" />
									{linkLine(s)}</span
								>{/if}
						</span>
					</div>
					{#if linking}
						<button
							type="button"
							class="grid size-11 shrink-0 place-items-center rounded-lg {s.links.length === 0
								? 'text-accent'
								: 'text-ink-2'}"
							aria-label="Link {spotLabel(s)}"
							onclick={() => {
								step = 'list';
								linkingSpot = s.id;
							}}><Icon d={icons.link} size={20} /></button
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
		{step}
		onstep={(s) => (step = s)}
		onclose={() => {
			linkingSpot = null;
			void invalidateAll();
		}}
	/>
{/if}

{#if playing}
	<SectionPlayer
		{src}
		{owner}
		spot={playing}
		{linking}
		onclose={() => {
			playing = null;
			// The player can rename or delete sections, and link them; the list shows them.
			void invalidateAll();
		}}
	/>
{/if}
