<!-- src/lib/components/links/LinkList.svelte -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import YouTubeCard from './YouTubeCard.svelte';
	import { parseLink } from '$lib/links';
	import type { LinkRow } from '$lib/types';

	interface Props {
		links: LinkRow[];
		/** Per-link controls under each row — the editor's Remove button. */
		actions?: Snippet<[LinkRow]>;
	}

	let { links, actions }: Props = $props();
</script>

{#if links.length > 0}
	<ul class="space-y-3">
		{#each links as link (link.id)}
			{@const parsed = parseLink(link.url)}
			<li class="overflow-hidden rounded-xl border border-line bg-raised">
				{#if parsed?.kind === 'youtube'}
					<YouTubeCard id={parsed.id} start={parsed.start} title={link.title} />
				{:else if parsed}
					<a
						href={link.url}
						target="_blank"
						rel="external noopener noreferrer"
						class="flex items-center gap-2 px-3 py-3"
					>
						<span class="min-w-0 flex-1 truncate text-[15px]">{link.title ?? parsed.host}</span>
						<span class="text-muted" aria-hidden="true">↗</span>
					</a>
				{:else}
					<!-- Unreachable for a stored row; if it ever happens it is text, never a link. -->
					<p class="px-3 py-3 text-[13px] break-all text-muted">{link.url}</p>
				{/if}
				{#if actions}
					<div class="flex justify-end border-t border-line px-2">{@render actions(link)}</div>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
