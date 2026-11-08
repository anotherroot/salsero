<!-- src/lib/components/player/DetailsBody.svelte -->
<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import { GROUP } from '$lib/components/ui/styles';
	import type { RunDetails } from '$lib/types';
	import RunClip from './RunClip.svelte';

	/*
	 * What About shows (one-player design), read-only: the heading, the facts as
	 * chips, the notes, the videos, the links. Only the parts that hold
	 * something are drawn; nothing here edits.
	 */
	interface Props {
		details: RunDetails;
	}

	let { details }: Props = $props();

	const hostOf = (url: string) => {
		try {
			return new URL(url).host.replace(/^www\./, '');
		} catch {
			return url;
		}
	};
	/** The link's second line: where it goes, without the scheme. */
	const whereOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '');
</script>

<section class="flex flex-col gap-3.5" aria-label={details.heading}>
	<h2 class="px-1 font-display text-[22px] leading-[1.15] font-extrabold text-ink">
		{details.heading}
	</h2>
	{#if details.facts.length > 0}
		<ul class="flex flex-wrap gap-1.5 px-0.5">
			{#each details.facts as fact (fact)}
				<li class="rounded-full bg-chip px-3 py-1.5 text-[13px] font-bold text-ink-2">{fact}</li>
			{/each}
		</ul>
	{/if}
	{#if details.notes}
		<LinkedText
			text={details.notes}
			class="px-1 text-[17px] leading-[1.5] whitespace-pre-line text-ink"
		/>
	{/if}
	{#each details.clips as clip (clip.src + clip.startMs)}
		<RunClip {clip} />
	{/each}
	{#if details.links.length > 0}
		<div class={GROUP}>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- links go outside the app -->
			{#each details.links as link (link.url)}
				<a
					href={link.url}
					target="_blank"
					rel="noopener noreferrer"
					class="focus-inset flex min-h-16 items-center gap-3 py-[9px] pr-3.5 pl-4 active:bg-step"
				>
					<span
						class="flex size-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
					>
						<Icon name="link" size={20} />
					</span>
					<span class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="truncate text-[16px] leading-[1.3] font-bold text-ink"
							>{link.title ?? hostOf(link.url)}</span
						>
						<span class="truncate text-[13px] text-muted">{whereOf(link.url)}</span>
					</span>
					<span class="flex flex-none text-chevron"><Icon name="chevron-right" size={20} /></span>
				</a>
			{/each}
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	{/if}
</section>
