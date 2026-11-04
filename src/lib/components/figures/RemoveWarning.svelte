<script lang="ts">
	import Banner from '$lib/components/ui/Banner.svelte';

	/**
	 * What taking a figure's last figure away does: the move goes with it.
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
	{variation} is its last figure, and a move with no figures is gone. It leaves the Figures list.{kept
		? ' Its recordings and practice history are kept.'
		: ''}
</Banner>
