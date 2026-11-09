<!-- src/lib/components/player/DetailsBody.svelte -->
<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';
	import LinkedText from '$lib/components/ui/LinkedText.svelte';
	import { GROUP } from '$lib/components/ui/styles';
	import type { RunDetails } from '$lib/types';
	import RunClip from './RunClip.svelte';
	import DetailsBody from './DetailsBody.svelte';

	/*
	 * What About shows (one-player design), read-only: the heading, the facts as
	 * chips, the notes, a lesson's figures, the videos, the links. Only the parts
	 * that hold something are drawn; nothing here edits. A lesson's figure opens
	 * its own details in place, under a row back to the lesson.
	 */
	interface Props {
		details: RunDetails;
	}

	let { details }: Props = $props();

	/** The lesson's figure open in place, by its index; null shows the lesson. */
	let opened = $state<number | null>(null);
	const openedDetails = $derived(
		opened === null ? null : (details.figures[opened]?.details ?? null)
	);

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

{#if openedDetails}
	<div class="flex flex-col gap-3.5">
		<button
			type="button"
			class="flex min-h-11 items-center gap-1 self-start pr-2 text-[15px] font-bold text-accent-text"
			onclick={() => (opened = null)}><Icon name="back" size={20} />{details.heading}</button
		>
		<DetailsBody details={openedDetails} />
	</div>
{:else}
	<section class="flex flex-col gap-3.5" aria-label={details.heading}>
		<h2 class="px-1 font-display text-[22px] leading-[1.15] font-extrabold text-ink">
			{details.heading}
		</h2>
		{#if details.facts.length > 0}
			<ul class="flex flex-wrap gap-1.5 px-0.5">
				{#each details.facts as fact, k (k)}
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
		{#if details.figures.length > 0}
			<div class="flex flex-col gap-2 px-0.5">
				<h3 class="px-0.5 text-[13px] font-bold text-muted">{t().exercise.content.figures}</h3>
				<ul class="flex flex-wrap gap-2">
					{#each details.figures as fig, k (k)}
						<li>
							{#if fig.details}
								<button
									type="button"
									class="inline-flex h-9 items-center gap-1 rounded-full bg-chip px-3.5 text-[14px] font-semibold text-chip-ink"
									onclick={() => (opened = k)}
									>{fig.name}<span class="text-muted"><Icon name="chevron-right" size={16} /></span
									></button
								>
							{:else}
								<span
									class="inline-flex h-9 items-center rounded-full bg-chip px-3.5 text-[14px] font-semibold text-chip-ink"
									>{fig.name}</span
								>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#each details.clips as clip, k (k)}
			<RunClip {clip} />
		{/each}
		{#if details.links.length > 0}
			<div class={GROUP}>
				{#each details.links as link, k (k)}
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
			</div>
		{/if}
	</section>
{/if}
