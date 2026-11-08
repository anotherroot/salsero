<script lang="ts">
	import { t } from '$lib/i18n/catalog';

	/** The invite's QR as one SVG, on white with a quiet zone of 4 cells. `cells` is row by row. */
	let {
		size,
		cells,
		label = t().admin.qr
	}: { size: number; cells: boolean[]; label?: string } = $props();
	const QUIET = 4;
	const total = $derived(size + QUIET * 2);
	const path = $derived(
		cells
			.map((on, i) => (on ? `M${(i % size) + QUIET} ${Math.floor(i / size) + QUIET}h1v1h-1z` : ''))
			.join('')
	);
</script>

<svg
	viewBox="0 0 {total} {total}"
	role="img"
	aria-label={label}
	class="block w-full max-w-64"
	shape-rendering="crispEdges"
>
	<rect width={total} height={total} fill="#fff" />
	<path d={path} fill="#000" />
</svg>
