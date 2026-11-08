<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { levelStep } from '$lib/levels/first-run';
	import { LEVELS, levelWords, tabsFor, type Level } from '$lib/levels/levels';

	/**
	 * How much app? The three levels as large radio cards, each with its tabs
	 * drawn small (levels spec). Settings and the first run draw it; `value` null
	 * is nothing picked yet. `onpick` also fires on a tap on the card already
	 * picked, so a sheet around it can close.
	 */
	let { value, onpick }: { value: Level | null; onpick: (l: Level) => void } = $props();

	// One name per instance, so two sets of cards on a page never share a radio group.
	const id = $props.id();
	const name = `level-${id}`;
</script>

<fieldset class="flex flex-col gap-3">
	<legend class="sr-only">{levelStep().title}</legend>
	{#each LEVELS as l (l)}
		{@const words = levelWords(l)}
		<label
			class="flex cursor-pointer items-start gap-3.5 rounded-[18px] bg-surface px-4 py-3.5 ring-1 ring-hairline ring-inset has-checked:ring-2 has-checked:ring-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
		>
			<input
				type="radio"
				{name}
				value={l}
				checked={l === value}
				class="mt-0.5 size-[22px] flex-none cursor-pointer focus-visible:outline-none"
				style="accent-color: var(--color-accent)"
				onchange={() => onpick(l)}
				onclick={() => l === value && onpick(l)}
			/>
			<span class="flex min-w-0 flex-col gap-[5px]">
				<span class="text-[17px] leading-tight font-extrabold text-ink">{words.title}</span>
				<span class="text-[14px] leading-[1.45] text-ink-2">{words.body}</span>
				<span class="mt-0.5 flex flex-wrap gap-1.5">
					{#each tabsFor(l) as tab (tab.id)}
						<span
							class="inline-flex h-[26px] items-center gap-1 rounded-full bg-chip pr-[9px] pl-1.5 text-[12px] font-bold text-chip-ink"
						>
							<Icon name={tab.icon} size={16} />{tab.label}
						</span>
					{/each}
				</span>
				{#if words.small}
					<span class="text-[13px] leading-[1.4] text-muted">{words.small}</span>
				{/if}
			</span>
		</label>
	{/each}
</fieldset>
