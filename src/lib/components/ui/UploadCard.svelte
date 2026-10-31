<script lang="ts">
	import Icon from './Icon.svelte';

	/** An upload on its way: percent, a bar, and the reassurance that the app stays usable. */
	interface Props {
		/** 0–100. */
		pct: number;
		/** What is going up, for the bar's accessible name. */
		label: string;
	}

	let { pct, label }: Props = $props();
	const shown = $derived(Math.floor(pct));
</script>

<div role="status" class="flex flex-col gap-3 rounded-2xl bg-surface p-4">
	<div class="flex items-center gap-3">
		<span
			class="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent-soft text-accent-text"
			><Icon name="upload" size={22} /></span
		>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-[16px] font-bold">Uploading… {shown}%</span>
			<span class="text-[13px] text-muted"
				>You can keep using the app; closing the tab stops it</span
			>
		</div>
	</div>
	<div
		role="progressbar"
		aria-label="Uploading {label}"
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow={shown}
		class="h-1.5 overflow-hidden rounded-[3px] bg-hairline"
	>
		<div class="h-full rounded-[3px] bg-accent transition-[width]" style="width: {pct}%"></div>
	</div>
</div>
