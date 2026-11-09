<script lang="ts">
	import { t } from '$lib/i18n/catalog';

	/**
	 * Who sees what you change in a group's view (spec 2026-11-09): up to three of
	 * the group's other people as overlapping initials, then how many people the
	 * group has, you included. On the band. The initials are decoration; the count
	 * is what a screen reader reads.
	 */
	let { faces, people }: { faces: string[]; people: number } = $props();
</script>

<span class="flex flex-none items-center gap-2" data-group-faces>
	{#if faces.length > 0}
		<span class="flex" aria-hidden="true">
			{#each faces as face, i (i)}
				<span
					class="flex size-[26px] items-center justify-center rounded-full bg-band-small text-[9.5px] font-extrabold text-band ring-2 ring-band {i >
					0
						? '-ml-2'
						: ''}">{face}</span
				>
			{/each}
		</span>
	{/if}
	<span class="text-[13px] font-bold whitespace-nowrap text-band-small"
		>{t().entry.classes.people(people)}</span
	>
</span>
