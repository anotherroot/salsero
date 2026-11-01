<script lang="ts">
	import Sheet from '$lib/components/ui/Sheet.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GROUP } from '$lib/components/ui/styles';

	/**
	 * The band's ⋯: a sheet titled with the routine's name. It holds the one way
	 * into selection that does not need a long-press. Not drawn at all on a
	 * routine with no slots — the page hides ⋯ then.
	 */
	let {
		open,
		title,
		canSelect,
		onselect,
		onclose
	}: {
		open: boolean;
		title: string;
		canSelect: boolean;
		onselect: () => void;
		onclose: () => void;
	} = $props();
</script>

{#if canSelect}
	<Sheet {title} {open} {onclose}>
		<div class={GROUP}>
			<button
				type="button"
				class="flex min-h-16 w-full cursor-pointer items-center gap-3 py-2 pr-3.5 pl-4 text-left"
				onclick={() => {
					onclose();
					onselect();
				}}
			>
				<span class="flex-none text-accent-text"><Icon name="check-circle" size={22} /></span>
				<span class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="text-[16px] leading-tight font-bold text-ink">Select slots</span>
					<span class="text-[13px] text-muted">Duplicate, delete or make a routine of several</span>
				</span>
			</button>
		</div>
	</Sheet>
{/if}
