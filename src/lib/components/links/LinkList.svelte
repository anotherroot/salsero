<!-- src/lib/components/links/LinkList.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import YouTubeCard from './YouTubeCard.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP } from '$lib/components/ui/styles';
	import { parseLink } from '$lib/links';
	import type { LinkRow } from '$lib/types';

	interface Props {
		links: LinkRow[];
		/** Per-link controls — the editor's Remove. A footer row on a YouTube card, a trailing control on a web row. */
		actions?: Snippet<[LinkRow, 'youtube' | 'web']>;
		/** The lesson page's denser YouTube row. */
		compact?: boolean;
	}

	let { links, actions, compact = false }: Props = $props();

	const parsedLinks = $derived(links.map((link) => ({ link, parsed: parseLink(link.url) })));
	const youtube = $derived(parsedLinks.filter((l) => l.parsed?.kind === 'youtube'));
	const others = $derived(parsedLinks.filter((l) => l.parsed?.kind !== 'youtube'));
</script>

{#if youtube.length > 0}
	<ul class="flex flex-col gap-3">
		{#each youtube as { link, parsed } (link.id)}
			{#if parsed?.kind === 'youtube'}
				<li class="overflow-hidden rounded-2xl bg-surface">
					<YouTubeCard id={parsed.id} start={parsed.start} title={link.title} {compact} />
					{#if actions}
						<div class="flex min-h-[52px] items-center gap-1 border-t border-hairline pr-1.5 pl-1">
							{@render actions(link, 'youtube')}
						</div>
					{/if}
				</li>
			{/if}
		{/each}
	</ul>
{/if}
{#if others.length > 0}
	<ul class="{GROUP} {youtube.length > 0 ? 'mt-3' : ''}">
		{#each others as { link, parsed } (link.id)}
			<li class="flex min-h-[60px] items-center">
				{#if parsed?.kind === 'web'}
					<a
						href={link.url}
						target="_blank"
						rel="external noopener noreferrer"
						class="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 pl-4 {actions ? '' : 'pr-4'}"
					>
						<span
							class="grid size-10 flex-none place-items-center rounded-xl bg-accent-soft text-accent-text"
							><Icon name="link" size={20} /></span
						>
						<span class="flex min-w-0 flex-1 flex-col gap-px py-2">
							<span class="truncate text-[16px] font-bold">{link.title ?? parsed.host}</span>
							<span class="truncate text-[13px] text-muted">{parsed.host}</span>
						</span>
						{#if !actions}
							<span class="flex text-chevron" aria-hidden="true"
								><Icon name="external" size={20} /></span
							>
						{/if}
					</a>
					{#if actions}
						<span class="flex flex-none items-center pr-1.5">{@render actions(link, 'web')}</span>
					{/if}
				{:else}
					<!-- Unreachable for a stored row; if it ever happens it is text, never a link. -->
					<p class="px-4 py-3 text-[13px] break-all text-muted">{link.url}</p>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
