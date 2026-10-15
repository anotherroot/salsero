<!-- src/lib/components/lessons/VideoSections.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import SectionPlayer from '$lib/components/ui/SectionPlayer.svelte';
	import { spotLabel } from '$lib/video/spots';
	import type { SectionTargets, Spot, SpotOwner, VideoSection } from '$lib/types';

	/**
	 * A lesson video's sections, each with what it is linked to and a picker to
	 * link it to a figure version or a drill. Sections are marked in the
	 * full-screen player; this is where they get pointed at what they show.
	 */
	interface Props {
		sections: VideoSection[];
		src: string;
		owner: SpotOwner;
		targets: SectionTargets;
		/** A refused link, shown under its section. */
		failure: { spotId: number; message: string } | null;
	}

	let { sections, src, owner, targets, failure }: Props = $props();

	let playing = $state<Spot | null>(null);
	let picking = $state<number | null>(null);

	$effect(() => {
		if (failure) picking = failure.spotId;
	});

	const asSpot = (s: VideoSection): Spot => ({
		id: s.id,
		startMs: s.startMs,
		endMs: s.endMs,
		label: s.label,
		linkedTo: s.links.map((l) => l.label)
	});

	const groups = $derived([
		{ label: 'This lesson', options: targets.thisLesson },
		{ label: 'Other figures', options: targets.figures },
		{ label: 'Drills', options: targets.drills }
	]);

	const field =
		'w-full rounded-lg border border-rule bg-plane px-3 py-2.5 text-[15px] outline-none focus:border-accent';
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
				<li class="py-2">
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] text-accent-ink"
							aria-label="Play {spotLabel(s)}"
							onclick={() => (playing = asSpot(s))}>▶</button
						>
						<div class="min-w-0 flex-1">
							<span class="block truncate text-[15px]">{spotLabel(s)}</span>
							{#if s.label}
								<span class="text-[12px] text-muted">{spotLabel({ ...s, label: null })}</span>
							{/if}
						</div>
						<button
							type="button"
							class="h-9 shrink-0 px-2 text-[13px] font-medium text-accent"
							aria-expanded={picking === s.id}
							onclick={() => (picking = picking === s.id ? null : s.id)}>Link…</button
						>
					</div>
					{#if s.links.length > 0}
						<ul class="mt-1 flex flex-wrap gap-1.5 pl-11">
							{#each s.links as link (link.id)}
								<li
									class="flex items-center rounded-full border border-rule pl-2.5 text-[13px] {link.archived
										? 'text-muted'
										: 'text-ink-2'}"
								>
									→ {link.label}{link.archived ? ' (archived)' : ''}
									<form method="POST" action="?/unlinkSection" use:enhance>
										<input type="hidden" name="linkId" value={link.id} />
										<button
											type="submit"
											class="grid size-8 place-items-center text-muted"
											aria-label="Unlink {link.label}">×</button
										>
									</form>
								</li>
							{/each}
						</ul>
					{/if}
					{#if picking === s.id}
						<form
							method="POST"
							action="?/linkSection"
							class="mt-2 flex gap-2 pl-11"
							use:enhance={() =>
								async ({ update, result }) => {
									await update();
									if (result.type === 'success') picking = null;
								}}
						>
							<input type="hidden" name="spotId" value={s.id} />
							<select name="target" required aria-label="Link to" class="{field} flex-1">
								<option value="" selected disabled>Link to…</option>
								{#each groups as group (group.label)}
									{#if group.options.length > 0}
										<optgroup label={group.label}>
											{#each group.options as option (option.value)}
												<option value={option.value}>{option.label}</option>
											{/each}
										</optgroup>
									{/if}
								{/each}
							</select>
							<button
								type="submit"
								class="h-11 shrink-0 rounded-xl border border-rule px-4 text-[14px] font-medium"
								>Link</button
							>
						</form>
					{/if}
					{#if failure?.spotId === s.id}
						<p class="mt-1 pl-11 text-[13px] text-danger" role="alert">{failure.message}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

{#if playing}
	<SectionPlayer
		{src}
		{owner}
		spot={playing}
		onclose={() => {
			playing = null;
			// The player can rename or delete sections; the list shows them.
			void invalidateAll();
		}}
	/>
{/if}
