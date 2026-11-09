<script lang="ts">
	import type { DiffPart } from '$lib/ai-queue/diff';

	/** A suggested text change, word by word: struck out, then added. */
	let { parts }: { parts: DiffPart[] } = $props();
</script>

<span class="text-[15px] leading-normal whitespace-pre-wrap text-ink"
	>{#each parts as p, i (i)}{#if p.op === 'del'}<del
				class="rounded bg-danger-soft px-0.5 text-danger decoration-danger">{p.text}</del
			>{:else if p.op === 'ins'}<ins
				class="rounded bg-done-soft px-0.5 font-bold text-done no-underline">{p.text}</ins
			>{:else}{p.text}{/if}{/each}</span
>
