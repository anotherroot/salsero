<!-- src/lib/components/player/RunRows.svelte -->
<script lang="ts" module>
	import type { IconName } from '$lib/icons/icons';

	export type RunRowKey = 'routine' | 'about' | 'voice';
	export interface RunRow {
		key: RunRowKey;
		title: string;
		/** One muted line: what is inside, or what is set. */
		preview: string;
		icon: IconName;
	}
</script>

<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP } from '$lib/components/ui/styles';

	/*
	 * The rows under the band (one-player design, B2): Routine, About, Voice, each
	 * opening its full-screen layer. Music's "Count only" row's look: a 40 px
	 * tile, a bold title, a muted one-line preview, and a chevron pointing up.
	 */
	interface Props {
		rows: RunRow[];
		onopen: (key: RunRowKey) => void;
	}

	let { rows, onopen }: Props = $props();

	/** Back from a layer: focus returns to the row that opened it. */
	let buttons = $state<Partial<Record<RunRowKey, HTMLButtonElement>>>({});
	export function focusRow(key: RunRowKey) {
		buttons[key]?.focus({ preventScroll: true });
	}
</script>

{#if rows.length > 0}
	<div class={GROUP}>
		{#each rows as row (row.key)}
			<button
				bind:this={buttons[row.key]}
				type="button"
				aria-haspopup="dialog"
				class="focus-inset flex min-h-16 w-full cursor-pointer items-center gap-3 py-[9px] pr-3.5 pl-4 text-left active:bg-step"
				onclick={() => onopen(row.key)}
			>
				<span
					class="flex size-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
				>
					<Icon name={row.icon} size={22} />
				</span>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="truncate text-[16px] leading-[1.3] font-bold text-ink">{row.title}</span>
					<span class="truncate text-[13px] text-muted">{row.preview}</span>
				</span>
				<span class="flex flex-none text-chevron"><Icon name="chevron-up" size={20} /></span>
			</button>
		{/each}
	</div>
{/if}
