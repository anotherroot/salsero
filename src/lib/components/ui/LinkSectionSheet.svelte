<!-- src/lib/components/ui/LinkSectionSheet.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { dateLabel } from '$lib/format';
	import { spotLabel } from '$lib/video/spots';
	import Sheet from './Sheet.svelte';
	import SectionPlayer from './SectionPlayer.svelte';
	import type { SectionGroup, SectionVideo, Spot } from '$lib/types';

	/**
	 * "+ Link a section": every section of the dance not yet linked here,
	 * grouped by video, the lessons this is taught in first. ▶ previews one,
	 * looping; Link posts `spotId` with the page's own `hidden` fields to
	 * `?/linkSection`.
	 */
	interface Props {
		open: boolean;
		onclose: () => void;
		groups: SectionGroup[];
		hidden: Record<string, string | number>;
		message: string | null;
	}

	let { open, onclose, groups, hidden, message }: Props = $props();

	let preview = $state<{ video: SectionVideo; spot: Spot } | null>(null);

	const heading = (v: SectionVideo) =>
		v.from.kind === 'lesson'
			? `${v.from.title} · ${dateLabel(v.from.lessonDay)}`
			: `Recording · ${v.from.figure}`;
</script>

<Sheet title="Link a section" {open} {onclose}>
	{#if message}
		<p class="bg-danger-bg mb-3 rounded-lg px-3 py-2 text-[13px] text-danger" role="alert">
			{message}
		</p>
	{/if}
	{#if groups.length === 0}
		<p class="text-[14px] text-muted">
			No sections to link. Open a lesson video full screen and tap Section to mark one.
		</p>
	{:else}
		<div class="space-y-4">
			{#each groups as group (group.video.src)}
				<section>
					<h3 class="mb-1 flex items-center gap-2 text-[13px] font-medium text-ink-2">
						<span class="min-w-0 truncate">{heading(group.video)}</span>
						{#if group.taughtHere}
							<span class="shrink-0 rounded-full bg-accent/15 px-2 text-[11px] text-accent"
								>taught here</span
							>
						{/if}
					</h3>
					<ul class="divide-y divide-line rounded-xl border border-line">
						{#each group.sections as spot (spot.id)}
							<li class="flex items-center gap-2 px-3 py-2">
								<button
									type="button"
									class="grid size-9 shrink-0 place-items-center rounded-full border border-rule text-[13px]"
									aria-label="Preview {spotLabel(spot)}"
									onclick={() => (preview = { video: group.video, spot })}>▶</button
								>
								<div class="min-w-0 flex-1">
									<span class="block truncate text-[15px]">{spotLabel(spot)}</span>
									{#if spot.label}
										<span class="text-[12px] text-muted">{spotLabel({ ...spot, label: null })}</span
										>
									{/if}
									{#if spot.linkedTo.length > 0}
										<span class="block truncate text-[12px] text-muted"
											>→ {spot.linkedTo.join(', ')}</span
										>
									{/if}
								</div>
								<form
									method="POST"
									action="?/linkSection"
									use:enhance={() =>
										async ({ update, result }) => {
											await update();
											if (result.type === 'success') onclose();
										}}
								>
									{#each Object.entries(hidden) as [name, value] (name)}
										<input type="hidden" {name} {value} />
									{/each}
									<input type="hidden" name="spotId" value={spot.id} />
									<button
										type="submit"
										class="h-10 rounded-xl bg-accent px-4 text-[14px] font-semibold text-accent-ink"
										>Link</button
									>
								</form>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>
	{/if}
</Sheet>

{#if preview}
	<SectionPlayer
		src={preview.video.src}
		owner={preview.video.owner}
		spot={preview.spot}
		from={preview.video.from}
		onclose={() => (preview = null)}
	/>
{/if}
