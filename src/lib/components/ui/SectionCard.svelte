<!-- src/lib/components/ui/SectionCard.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dateLabel } from '$lib/format';
	import { spotLabel } from '$lib/video/spots';
	import SectionPlayer from './SectionPlayer.svelte';
	import type { LinkedSection } from '$lib/types';

	/**
	 * A linked section: where it is from and what it is. A tap plays it full
	 * screen, looping. `unlink` is the page's own form, when it offers one.
	 */
	let { section, unlink }: { section: LinkedSection; unlink?: Snippet } = $props();

	let open = $state(false);

	const from = $derived(
		section.video.from.kind === 'lesson'
			? `${section.video.from.title} · ${dateLabel(section.video.from.lessonDay)}`
			: `Recording · ${section.video.from.figure}`
	);
</script>

<div class="flex items-center gap-2 rounded-xl border border-line bg-raised px-3 py-2">
	<button
		type="button"
		class="flex min-w-0 flex-1 items-center gap-3 text-left"
		onclick={() => (open = true)}
	>
		<span
			class="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-[14px] text-accent-ink"
			aria-hidden="true">▶</span
		>
		<span class="min-w-0">
			<span class="block truncate text-[12px] text-muted">{from}</span>
			<span class="block truncate text-[15px]">{spotLabel(section.spot)}</span>
			{#if section.spot.label}
				<span class="block text-[12px] text-muted"
					>{spotLabel({ ...section.spot, label: null })}</span
				>
			{/if}
		</span>
	</button>
	{@render unlink?.()}
</div>

{#if open}
	<SectionPlayer
		src={section.video.src}
		owner={section.video.owner}
		spot={section.spot}
		onclose={() => (open = false)}
	/>
{/if}
