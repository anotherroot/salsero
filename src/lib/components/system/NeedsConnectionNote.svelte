<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { t } from '$lib/i18n/catalog';

	/** At the top of a sheet or menu whose actions need a connection, once, while offline (look 4B). */
</script>

<p class="flex items-center gap-2 px-1 pb-2 text-[14px] font-semibold text-muted" role="note">
	<Icon name="info" size={18} />{t().shell.offline.needsConnectionFor}
</p>
