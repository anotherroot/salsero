<script lang="ts">
	/**
	 * What taking a figure's last variation away does: the figure goes with it.
	 * Shown above the button of a move or an archive that would empty a figure.
	 */
	let { figure, variation }: { figure: string; variation: string } = $props();
</script>

<div class="flex gap-2.5 rounded-xl border border-danger/30 bg-danger/10 p-3" role="alert">
	<svg
		width="20"
		height="20"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
		class="mt-px shrink-0 text-danger"
		><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></svg
	>
	<div class="space-y-1.5">
		<p class="text-[15px] font-semibold text-danger">{figure} will be removed</p>
		<p class="text-[14px] leading-snug text-ink">
			{variation} is its last variation, and a figure with no variations is gone. It leaves the figures
			list.
		</p>
	</div>
</div>
