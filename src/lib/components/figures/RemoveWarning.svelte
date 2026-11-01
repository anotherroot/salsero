<script lang="ts">
	import Banner from '$lib/components/ui/Banner.svelte';

	/**
	 * What taking a figure's last variation away does: the figure goes with it.
	 * Shown in a move or an archive that would empty a figure; `kept` adds that
	 * the history stays (archive only).
	 */
	let {
		figure,
		variation,
		kept = false
	}: { figure: string; variation: string; kept?: boolean } = $props();
</script>

<Banner kind="error" title="{figure} will be removed">
	{variation} is its last variation, and a figure with no variations is gone. It leaves the figures list.{kept
		? ' Its recordings and practice history are kept.'
		: ''}
</Banner>
