<script lang="ts">
	import { fade } from 'svelte/transition';
	import { t } from '$lib/i18n/catalog';
	import { goBack } from '$lib/motion/page-move.svelte';

	/**
	 * "Still trying… Go back": a page change that waits long offers the way back
	 * (page changes spec). On the phone's lifted card (`PageWait`) and the
	 * desktop's skeleton (`PageSkeleton`).
	 */
</script>

<button
	type="button"
	class="pointer-events-auto cursor-pointer px-4 py-[14px] text-[16px] leading-[1.2] font-semibold text-muted"
	onclick={goBack}
	in:fade={{ duration: 200 }}
>
	{t().shell.wait.still}
	<b class="ml-1 font-bold text-band">{t().shell.wait.back}</b>
</button>
