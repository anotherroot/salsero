<script lang="ts">
	import { GROUP } from '$lib/components/ui/styles';
	import { t } from '$lib/i18n/catalog';
	import type { DropsResult } from '$lib/hearing/drops';
	import type { SectionLine, TapAlongResult } from '$lib/hearing/judge';
	import { revealOf } from '$lib/hearing/round';
	import { sectionName } from '$lib/songs/sections';
	import BeatStrip from './BeatStrip.svelte';

	/** The lines under the score: per part of the song, or per drop, then the strip. */
	interface Props {
		tap: TapAlongResult | null;
		drops: DropsResult | null;
		positions: number[];
		beatS: number;
	}

	let { tap, drops, positions, beatS }: Props = $props();
	const w = $derived(t().hearing);

	function verdict(s: SectionLine): string {
		const v = w.result.verdict;
		if (s.verdict === 'other' && s.otherCount !== null) return v.other(s.otherCount);
		if (s.verdict === 'late') return v.late(s.meanMs ?? 0);
		if (s.verdict === 'early') return v.early(Math.abs(s.meanMs ?? 0));
		if (s.verdict === 'on') return v.on;
		return v.missed;
	}

	function reveal(i: number): string {
		const d = drops!.drops[i];
		if (d.tap === null) return w.result.noTap;
		const r = revealOf(d, positions);
		if (r.kind === 'spot') return w.reveal.spot;
		if (r.kind === 'late') return w.reveal.late(r.ms);
		if (r.kind === 'early') return w.reveal.early(r.ms);
		if (r.kind === 'other') return w.reveal.other(r.count);
		if (r.kind === 'pattern') return w.reveal.pattern(r.hits, r.of);
		return w.reveal.missed;
	}

	const tone = (ok: boolean) => (ok ? 'text-done' : 'text-danger');
</script>

{#if tap}
	<ul class={GROUP}>
		{#each tap.sections as s, i (i)}
			<li class="flex min-h-12 items-center gap-3 px-4 py-2">
				<span class="min-w-0 flex-1 truncate text-[15px] font-bold text-ink"
					>{tap.sections.length === 1 && !s.name ? w.result.wholeSong : sectionName(s)}</span
				>
				<span class="text-[14px] font-semibold {tone(s.verdict === 'on')}">{verdict(s)}</span>
			</li>
		{/each}
	</ul>
	<BeatStrip rows={tap.rows} {positions} {beatS} label={w.result.strip} />
{:else if drops}
	<ul class={GROUP}>
		{#each drops.drops as d, i (d.start)}
			<li class="flex min-h-12 items-center gap-3 px-4 py-2">
				<span class="flex-1 text-[15px] font-bold text-ink">{w.result.drop(i + 1)}</span>
				<span class="text-[14px] font-semibold {tone(d.hits * 4 >= d.of * 3)}">{reveal(i)}</span>
			</li>
		{/each}
	</ul>
{/if}
