<script lang="ts">
	import Banner from '$lib/components/ui/Banner.svelte';
	import { t } from '$lib/i18n/catalog';

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

<Banner kind="error" title={t().figure.remove.title(figure)}>
	{t().figure.remove.body(variation)}{kept ? t().figure.remove.kept : ''}
</Banner>
