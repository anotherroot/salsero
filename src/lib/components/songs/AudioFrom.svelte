<script lang="ts">
	import type { SourceRow } from '$lib/songs/song-page';
	import { t } from '$lib/i18n/catalog';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP, LABEL, ROW } from '$lib/components/ui/styles';

	/** Song details' "Audio from" card: where the song came from, and the video it plays. */
	let { rows }: { rows: SourceRow[] } = $props();
</script>

{#if rows.length > 0}
	<div>
		<p class={LABEL}>{t().songs.source.audioFrom}</p>
		<ul class={GROUP}>
			{#each rows as row (row.kind)}
				<li>
					<a
						href={row.href}
						target="_blank"
						rel="external noopener noreferrer"
						class="{ROW} focus-inset hover:bg-step"
					>
						<span
							class="flex size-10 flex-none items-center justify-center rounded-full {row.kind ===
							'spotify'
								? 'bg-done-soft text-done'
								: 'bg-danger-soft text-danger'}"
						>
							<Icon name={row.kind === 'spotify' ? 'music' : 'youtube'} size={20} />
						</span>
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="text-[16px] font-bold text-ink">{row.title}</span>
							<span class="truncate text-[13px] text-muted">{row.meta}</span>
						</span>
						<span class="text-accent-text"><Icon name="external" size={20} /></span>
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}
