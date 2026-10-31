<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import { GROUP } from '$lib/components/ui/styles';

	let {
		open,
		title,
		intro,
		legend,
		options,
		value,
		onpick,
		onclose
	}: {
		open: boolean;
		title: string;
		intro?: string;
		legend: string;
		options: readonly { value: string; label: string }[];
		value: string;
		/** The caller closes the sheet. */
		onpick: (value: string) => void;
		onclose: () => void;
	} = $props();

	// One name per instance, so two sheets on a page never share a radio group.
	const name = `choice-${Math.random().toString(36).slice(2, 8)}`;
</script>

<Sheet {title} {open} {onclose}>
	<div class="flex flex-col gap-3 pb-2">
		{#if intro}<p class="px-1 text-[15px] text-ink-2">{intro}</p>{/if}
		<fieldset>
			<legend class="px-4 pb-2 text-[13px] font-bold text-muted">{legend}</legend>
			<div class={GROUP}>
				{#each options as o (o.value)}
					<label class="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-2">
						<span class="min-w-0 flex-1 text-[16px] font-semibold text-ink">{o.label}</span>
						<input
							type="radio"
							{name}
							value={o.value}
							checked={o.value === value}
							class="size-[22px] flex-none cursor-pointer"
							style="accent-color: var(--color-accent)"
							onchange={() => onpick(o.value)}
						/>
					</label>
				{/each}
			</div>
		</fieldset>
	</div>
</Sheet>
