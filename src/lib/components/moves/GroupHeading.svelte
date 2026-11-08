<script lang="ts">
	/**
	 * Where a group's rows start in a Moves list (Figures, Routines, Positions):
	 * a line above, the group's icon, its name larger than a move's, and
	 * "Group · 3 figures" under it, so the group is not lost among the moves.
	 */
	import Icon from '$lib/components/ui/Icon.svelte';

	let { name, meta }: { name: string; meta: string } = $props();
</script>

<div class="mt-4 flex items-center gap-3 border-t-2 border-hairline pt-4 pb-1">
	<span
		class="flex size-11 flex-none items-center justify-center rounded-[14px] bg-accent-soft text-accent-text"
		aria-hidden="true"><Icon name="people" size={22} /></span
	>
	<span class="flex min-w-0 flex-col gap-0.5">
		<h2 class="font-display text-[22px] leading-tight font-extrabold break-words text-ink">
			{name}
		</h2>
		<span class="text-[13px] text-muted">{meta}</span>
	</span>
</div>
