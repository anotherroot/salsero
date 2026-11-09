<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	/**
	 * The group view's badge (spec 2026-11-09): today's people icon in a round
	 * badge. `cream` on the band (the band's row, the slim band); `band` on cream
	 * (the side's card). Decorative: the group's name is always beside it.
	 */
	let { size = 30, tone = 'cream' }: { size?: number; tone?: 'cream' | 'band' } = $props();
</script>

<span
	data-group-badge
	aria-hidden="true"
	class="inline-flex flex-none items-center justify-center rounded-full {tone === 'cream'
		? 'bg-band-ink text-band'
		: 'bg-band text-band-ink'}"
	style="width: {size}px; height: {size}px"
>
	<Icon name="people" size={Math.round(size * 0.6)} />
</span>
