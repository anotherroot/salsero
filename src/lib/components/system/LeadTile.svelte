<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { IconName } from '$lib/icons/icons';

	let { icon }: { icon: IconName } = $props();
</script>

<!-- The leading mark of a settings row: a tonal rounded square. -->
<span
	class="flex size-9 flex-none items-center justify-center rounded-[10px] bg-accent-soft text-accent-text"
	aria-hidden="true"><Icon name={icon} size={20} /></span
>
