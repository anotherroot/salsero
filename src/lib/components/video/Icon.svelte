<!-- src/lib/components/video/Icon.svelte -->
<script lang="ts">
	/** A path from `icons.ts`. Decorative: the button around it carries the label. */
	let {
		d,
		size = 20,
		filled = false,
		weight = 2,
		class: cls = ''
	}: { d: string; size?: number; filled?: boolean; weight?: number; class?: string } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	aria-hidden="true"
	class="shrink-0 {cls}"
	fill={filled ? 'currentColor' : 'none'}
	stroke="currentColor"
	stroke-width={weight}
	stroke-linecap="round"
	stroke-linejoin="round"><path {d} /></svg
>
